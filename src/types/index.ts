export type TradeSide = 'LONG' | 'SHORT';
export type SignalType = TradeSide | 'NEUTRAL';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorSnapshot {
  emaFast: number;
  emaSlow: number;
  rsi: number;
}

export interface SignalResult {
  symbol: string;
  signal: SignalType;
  price: number;
  indicators: IndicatorSnapshot;
}

export interface Position {
  id?: number;
  symbol: string;
  side: TradeSide;
  entryPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  breakEvenActive: boolean;
  status: 'OPEN' | 'CLOSED';
  exchangeOrderId?: string;
  unrealizedPnl: number;
  openedAt: string;
  closedAt?: string;
}

export interface Trade {
  id?: number;
  symbol: string;
  side: TradeSide;
  entryPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice?: number;
  pnl?: number;
  openedAt: string;
  closedAt?: string;
}

export interface PerformanceStat {
  tradeDate: string;
  maxDrawdown: number;
  winRate: number;
  realizedPnl: number;
}

export interface BotRuntimeFlags {
  paperTrading: boolean;
  dryRun: boolean;
}
