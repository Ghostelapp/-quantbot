import { config } from './config.js';

export const emaRsiStrategyConfig = {
  name: 'EMA_20_50_RSI_14',
  emaFastPeriod: config.emaFastPeriod,
  emaSlowPeriod: config.emaSlowPeriod,
  rsiPeriod: config.rsiPeriod,
  rsiLongLower: config.rsiLongLower,
  rsiLongUpper: config.rsiLongUpper,
  rsiShortLower: config.rsiShortLower,
  rsiShortUpper: config.rsiShortUpper,
};
