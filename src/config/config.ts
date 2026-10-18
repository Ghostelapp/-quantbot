import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export interface BotConfig {
  binanceApiKey: string;
  binanceApiSecret: string;
  binanceTestnet: boolean;
  tradingSymbols: string[];
  timeframe: string;
  leverage: number;
  pollIntervalSeconds: number;
  emaFastPeriod: number;
  emaSlowPeriod: number;
  rsiPeriod: number;
  rsiLongLower: number;
  rsiLongUpper: number;
  rsiShortLower: number;
  rsiShortUpper: number;
  riskPerTradePct: number;
  stopLossPct: number;
  riskRewardRatio: number;
  trailingBreakEvenPct: number;
  circuitBreakerMaxDdPct: number;
  maxOpenPositions: number;
  databasePath: string;
  logLevel: string;
  port: number;
  paperTrading: boolean;
  dryRun: boolean;
}

export const config: BotConfig = {
  binanceApiKey: process.env.BINANCE_API_KEY ?? '',
  binanceApiSecret: process.env.BINANCE_API_SECRET ?? '',
  binanceTestnet: toBool(process.env.BINANCE_TESTNET, true),
  tradingSymbols: (process.env.TRADING_SYMBOLS ?? 'BTC/USDT,ETH/USDT')
    .split(',')
    .map((symbol) => symbol.trim())
    .filter(Boolean),
  timeframe: process.env.TIMEFRAME ?? '15m',
  leverage: toNumber(process.env.LEVERAGE, 5),
  pollIntervalSeconds: toNumber(process.env.POLL_INTERVAL_SECONDS, 15),
  emaFastPeriod: toNumber(process.env.EMA_FAST_PERIOD, 20),
  emaSlowPeriod: toNumber(process.env.EMA_SLOW_PERIOD, 50),
  rsiPeriod: toNumber(process.env.RSI_PERIOD, 14),
  rsiLongLower: toNumber(process.env.RSI_LONG_LOWER, 50),
  rsiLongUpper: toNumber(process.env.RSI_LONG_UPPER, 70),
  rsiShortLower: toNumber(process.env.RSI_SHORT_LOWER, 30),
  rsiShortUpper: toNumber(process.env.RSI_SHORT_UPPER, 50),
  riskPerTradePct: toNumber(process.env.RISK_PER_TRADE_PCT, 1.5),
  stopLossPct: toNumber(process.env.STOP_LOSS_PCT, 1.5),
  riskRewardRatio: toNumber(process.env.RRR, 2),
  trailingBreakEvenPct: toNumber(process.env.TRAILING_BREAK_EVEN_PCT, 1.5),
  circuitBreakerMaxDdPct: toNumber(process.env.CIRCUIT_BREAKER_MAX_DD_PCT, 5),
  maxOpenPositions: toNumber(process.env.MAX_OPEN_POSITIONS, 2),
  databasePath: process.env.DATABASE_PATH ?? 'quantbot.db',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  port: toNumber(process.env.PORT, 3000),
  paperTrading: toBool(process.env.PAPER_TRADING, false) || process.argv.includes('--paper'),
  dryRun: toBool(process.env.DRY_RUN, true),
};

export const validateConfig = (): void => {
  if (config.emaFastPeriod >= config.emaSlowPeriod) {
    throw new Error('EMA fast period must be lower than EMA slow period.');
  }
  if (config.riskPerTradePct <= 0 || config.riskPerTradePct > 5) {
    throw new Error('RISK_PER_TRADE_PCT must be within (0,5].');
  }
  if (config.maxOpenPositions < 1) {
    throw new Error('MAX_OPEN_POSITIONS must be at least 1.');
  }
};
