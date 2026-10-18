import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePositionSize, calculateStopLoss, calculateTakeProfit } from '../src/risk-management/position-sizing.js';

test('position sizing uses 1.5% account risk', () => {
  const stopLoss = calculateStopLoss(100, 1.5, 'LONG');
  const size = calculatePositionSize({
    accountBalance: 10000,
    entryPrice: 100,
    stopLossPrice: stopLoss,
    riskPerTradePct: 1.5,
  });

  assert.ok(Math.abs(size - 100) < 0.0001);
});

test('take profit respects 1:2 risk reward', () => {
  const stopLoss = calculateStopLoss(100, 1.5, 'LONG');
  const takeProfit = calculateTakeProfit(100, stopLoss, 2, 'LONG');

  assert.ok(Math.abs(takeProfit - 103) < 0.0001);
});
