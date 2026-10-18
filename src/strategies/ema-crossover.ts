import { emaRsiStrategyConfig } from '../config/strategies.js';
import { ema } from '../indicators/ema.js';
import { rsi } from '../indicators/rsi.js';
import { generateSignal } from './signal-generator.js';
import type { Candle, SignalResult } from '../types/index.js';

export const evaluateEmaCrossover = (symbol: string, candles: Candle[]): SignalResult => {
  const closes = candles.map((candle) => candle.close);

  if (closes.length < emaRsiStrategyConfig.emaSlowPeriod + 2) {
    return {
      symbol,
      signal: 'NEUTRAL',
      price: closes[closes.length - 1] ?? 0,
      indicators: { emaFast: 0, emaSlow: 0, rsi: 50 },
    };
  }

  const fast = ema(closes, emaRsiStrategyConfig.emaFastPeriod);
  const slow = ema(closes, emaRsiStrategyConfig.emaSlowPeriod);
  const rsiValues = rsi(closes, emaRsiStrategyConfig.rsiPeriod);

  const lastIndex = closes.length - 1;
  const signal = generateSignal({
    prevFast: fast[lastIndex - 1] ?? 0,
    prevSlow: slow[lastIndex - 1] ?? 0,
    currentFast: fast[lastIndex] ?? 0,
    currentSlow: slow[lastIndex] ?? 0,
    currentRsi: rsiValues[lastIndex] ?? 50,
    rsiLongLower: emaRsiStrategyConfig.rsiLongLower,
    rsiLongUpper: emaRsiStrategyConfig.rsiLongUpper,
    rsiShortLower: emaRsiStrategyConfig.rsiShortLower,
    rsiShortUpper: emaRsiStrategyConfig.rsiShortUpper,
  });

  return {
    symbol,
    signal,
    price: closes[lastIndex] ?? 0,
    indicators: {
      emaFast: fast[lastIndex] ?? 0,
      emaSlow: slow[lastIndex] ?? 0,
      rsi: rsiValues[lastIndex] ?? 50,
    },
  };
};
