import type { TradeSide } from '../types/index.js';

interface PositionSizingInput {
  accountBalance: number;
  entryPrice: number;
  stopLossPrice: number;
  riskPerTradePct: number;
}

export const calculatePositionSize = (input: PositionSizingInput): number => {
  const riskAmount = input.accountBalance * (input.riskPerTradePct / 100);
  const slDistance = Math.abs(input.entryPrice - input.stopLossPrice);

  if (slDistance <= 0) {
    return 0;
  }

  return riskAmount / slDistance;
};

export const calculateStopLoss = (entryPrice: number, stopLossPct: number, side: TradeSide): number => {
  const ratio = stopLossPct / 100;
  return side === 'LONG' ? entryPrice * (1 - ratio) : entryPrice * (1 + ratio);
};

export const calculateTakeProfit = (
  entryPrice: number,
  stopLossPrice: number,
  riskRewardRatio: number,
  side: TradeSide,
): number => {
  const riskPerUnit = Math.abs(entryPrice - stopLossPrice);
  const reward = riskPerUnit * riskRewardRatio;
  return side === 'LONG' ? entryPrice + reward : entryPrice - reward;
};
