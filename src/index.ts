import express from 'express';
import { validateConfig, config } from './config/config.js';
import { BinanceFuturesClient } from './exchanges/binance.js';
import { OrderService } from './exchanges/orders.js';
import { PositionService } from './exchanges/positions.js';
import { TradingDatabase } from './database/db.js';
import { StrategyExecutor } from './scheduler/strategy-executor.js';
import { createMarketListener } from './scheduler/market-listener.js';
import { logger } from './logger/logger.js';

const app = express();
app.use(express.json());

const db = new TradingDatabase();
const exchange = new BinanceFuturesClient();
const orderService = new OrderService(exchange);
const positionService = new PositionService(db);
const executor = new StrategyExecutor({ exchange, orderService, positionService });

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', symbols: config.tradingSymbols, paperTrading: config.paperTrading || config.dryRun });
});

const start = async (): Promise<void> => {
  validateConfig();

  await exchange.initialize();
  for (const symbol of config.tradingSymbols) {
    await exchange.setLeverage(symbol, config.leverage).catch(() => undefined);
  }
  await executor.initialize();

  const task = createMarketListener(executor);
  task.start();

  app.listen(config.port, () => {
    logger.info(`Quantbot trading server listening on port ${config.port}`);
  });
};

start().catch((error) => {
  logger.error('Startup failed', { error });
  process.exit(1);
});
