import { config } from '../config/config.js';
import type { Position, TradeSide } from '../types/index.js';
import type { BinanceFuturesClient } from './binance.js';

export class OrderService {
  constructor(private readonly exchange: BinanceFuturesClient) {}

  async openPosition(position: Position): Promise<Position> {
    if (config.paperTrading || config.dryRun) {
      return {
        ...position,
        exchangeOrderId: `paper-${Date.now()}`,
      };
    }

    const side = position.side === 'LONG' ? 'buy' : 'sell';
    const orderId = await this.exchange.createMarketOrder(position.symbol, side, position.quantity);
    return {
      ...position,
      exchangeOrderId: orderId,
    };
  }

  async closePosition(position: Position): Promise<void> {
    if (config.paperTrading || config.dryRun) {
      return;
    }

    const side: 'buy' | 'sell' = position.side === 'LONG' ? 'sell' : 'buy';
    await this.exchange.createMarketOrder(position.symbol, side, position.quantity);
  }

  buildPosition(input: {
    symbol: string;
    side: TradeSide;
    entryPrice: number;
    quantity: number;
    stopLoss: number;
    takeProfit: number;
  }): Position {
    return {
      symbol: input.symbol,
      side: input.side,
      entryPrice: input.entryPrice,
      quantity: input.quantity,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      breakEvenActive: false,
      status: 'OPEN',
      unrealizedPnl: 0,
      openedAt: new Date().toISOString(),
    };
  }
}
