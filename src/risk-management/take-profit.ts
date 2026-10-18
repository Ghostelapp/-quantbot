import type { Position } from '../types/index.js';

export const hasHitTakeProfit = (position: Position, currentPrice: number): boolean => {
  return position.side === 'LONG' ? currentPrice >= position.takeProfit : currentPrice <= position.takeProfit;
};

export const applyBreakEven = (position: Position, currentPrice: number, triggerPct: number): Position => {
  if (position.breakEvenActive) {
    return position;
  }

  const profitPct = position.side === 'LONG'
    ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
    : ((position.entryPrice - currentPrice) / position.entryPrice) * 100;

  if (profitPct < triggerPct) {
    return position;
  }

  const bufferedStop = position.side === 'LONG'
    ? position.entryPrice * 1.0005
    : position.entryPrice * 0.9995;

  return {
    ...position,
    stopLoss: bufferedStop,
    breakEvenActive: true,
  };
};
