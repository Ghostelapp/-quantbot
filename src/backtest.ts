import { BinanceFuturesClient } from './exchanges/binance.js';
import { evaluateEmaCrossover } from './strategies/ema-crossover.js';
import { config } from './config/config.js';

const runBacktest = async (): Promise<void> => {
  const exchange = new BinanceFuturesClient();
  await exchange.initialize();

  for (const symbol of config.tradingSymbols) {
    const candles = await exchange.fetchCandles(symbol, config.timeframe, 250);
    const signal = evaluateEmaCrossover(symbol, candles);
    // eslint-disable-next-line no-console
    console.log(`${symbol} latest signal=${signal.signal} price=${signal.price.toFixed(2)} rsi=${signal.indicators.rsi.toFixed(2)}`);
  }
};

runBacktest().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
