import ccxt from 'ccxt';
import { config } from '../config/config.js';
import type { Candle } from '../types/index.js';

export class BinanceFuturesClient {
  private readonly exchange: any;

  constructor() {
    this.exchange = new ccxt.binance({
      apiKey: config.binanceApiKey,
      secret: config.binanceApiSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'future',
      },
    });

    if (config.binanceTestnet) {
      this.exchange.setSandboxMode(true);
    }
  }

  async initialize(): Promise<void> {
    try {
      await this.exchange.loadMarkets();
    } catch (error) {
      if (config.paperTrading || config.dryRun) {
        return;
      }
      throw error;
    }
  }

  async fetchCandles(symbol: string, timeframe: string, limit = 120): Promise<Candle[]> {
    const ohlcv = (await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit)) as number[][];
    return ohlcv.map((item) => ({
      timestamp: item[0],
      open: item[1],
      high: item[2],
      low: item[3],
      close: item[4],
      volume: item[5],
    }));
  }

  async fetchTickerPrice(symbol: string): Promise<number> {
    const ticker = await this.exchange.fetchTicker(symbol);
    return ticker.last ?? 0;
  }

  async fetchUsdtBalance(): Promise<number> {
    if (!config.binanceApiKey || !config.binanceApiSecret || config.paperTrading || config.dryRun) {
      return 10000;
    }

    try {
      const balance = await this.exchange.fetchBalance({ type: 'future' });
      const usdt = balance.USDT as { total?: number } | undefined;
      return usdt?.total ?? 0;
    } catch {
      return 10000;
    }
  }

  async createMarketOrder(symbol: string, side: 'buy' | 'sell', quantity: number): Promise<string> {
    const response = await this.exchange.createOrder(symbol, 'market', side, quantity);
    return String(response.id ?? '');
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    await this.exchange.setLeverage(leverage, symbol);
  }
}
