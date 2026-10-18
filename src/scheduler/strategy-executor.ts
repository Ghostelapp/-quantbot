import { config } from '../config/config.js';
import { evaluateEmaCrossover } from '../strategies/ema-crossover.js';
import { calculatePositionSize, calculateStopLoss, calculateTakeProfit } from '../risk-management/position-sizing.js';
import { hasHitStopLoss } from '../risk-management/stop-loss.js';
import { applyBreakEven, hasHitTakeProfit } from '../risk-management/take-profit.js';
import { CircuitBreaker } from '../risk-management/circuit-breaker.js';
import { logger } from '../logger/logger.js';
import type { BinanceFuturesClient } from '../exchanges/binance.js';
import type { OrderService } from '../exchanges/orders.js';
import type { PositionService } from '../exchanges/positions.js';
import type { Position } from '../types/index.js';

interface ExecutorDependencies {
  exchange: BinanceFuturesClient;
  orderService: OrderService;
  positionService: PositionService;
}

export class StrategyExecutor {
  private readonly circuitBreaker = new CircuitBreaker(config.circuitBreakerMaxDdPct, 0);

  constructor(private readonly deps: ExecutorDependencies) {}

  async initialize(): Promise<void> {
    const balance = await this.deps.exchange.fetchUsdtBalance();
    this.circuitBreaker.setStartEquity(balance || 10000);
  }

  async runCycle(symbol: string): Promise<void> {
    const accountBalance = (await this.deps.exchange.fetchUsdtBalance()) || 10000;
    if (this.circuitBreaker.isTripped(accountBalance)) {
      logger.warn('Circuit breaker tripped, skipping new entries.');
      return;
    }

    const openPositions = this.deps.positionService.listOpenPositions();
    await this.checkOpenPositions(openPositions);

    if (openPositions.length >= config.maxOpenPositions) {
      return;
    }

    const candles = await this.deps.exchange.fetchCandles(symbol, config.timeframe, 150);
    const signal = evaluateEmaCrossover(symbol, candles);

    if (signal.signal === 'NEUTRAL') {
      return;
    }

    const stopLoss = calculateStopLoss(signal.price, config.stopLossPct, signal.signal);
    const takeProfit = calculateTakeProfit(signal.price, stopLoss, config.riskRewardRatio, signal.signal);
    const quantity = calculatePositionSize({
      accountBalance,
      entryPrice: signal.price,
      stopLossPrice: stopLoss,
      riskPerTradePct: config.riskPerTradePct,
    });

    if (quantity <= 0) {
      return;
    }

    const draft = this.deps.orderService.buildPosition({
      symbol,
      side: signal.signal,
      entryPrice: signal.price,
      quantity,
      stopLoss,
      takeProfit,
    });

    const placed = await this.deps.orderService.openPosition(draft);
    this.deps.positionService.save(placed);

    logger.info('Opened new position', { symbol, side: signal.signal, price: signal.price, quantity });
  }

  private async checkOpenPositions(positions: Position[]): Promise<void> {
    for (const position of positions) {
      const currentPrice = await this.deps.exchange.fetchTickerPrice(position.symbol);
      const next = applyBreakEven(position, currentPrice, config.trailingBreakEvenPct);

      next.unrealizedPnl = position.side === 'LONG'
        ? (currentPrice - position.entryPrice) * position.quantity
        : (position.entryPrice - currentPrice) * position.quantity;

      if (next.breakEvenActive !== position.breakEvenActive || next.stopLoss !== position.stopLoss) {
        this.deps.positionService.save(next);
      }

      if (hasHitStopLoss(next, currentPrice) || hasHitTakeProfit(next, currentPrice)) {
        await this.deps.orderService.closePosition(next);
        this.deps.positionService.close(next, currentPrice);
        logger.info('Closed position', { symbol: next.symbol, side: next.side, exitPrice: currentPrice });
      }
    }
  }
}
