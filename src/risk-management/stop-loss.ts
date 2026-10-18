import type { Position } from '../types/index.js';

export const hasHitStopLoss = (position: Position, currentPrice: number): boolean => {
  return position.side === 'LONG' ? currentPrice <= position.stopLoss : currentPrice >= position.stopLoss;
};
