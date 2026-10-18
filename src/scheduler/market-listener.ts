import cron from 'node-cron';
import { config } from '../config/config.js';
import { logger } from '../logger/logger.js';
import type { StrategyExecutor } from './strategy-executor.js';

export const createMarketListener = (executor: StrategyExecutor) => {
  let running = false;

  const expression = `*/${Math.max(config.pollIntervalSeconds, 1)} * * * * *`;

  return cron.schedule(expression, async () => {
    if (running) {
      return;
    }

    running = true;

    try {
      await Promise.all(config.tradingSymbols.map((symbol) => executor.runCycle(symbol)));
    } catch (error) {
      logger.error('Strategy cycle failed', { error });
    } finally {
      running = false;
    }
  });
};
