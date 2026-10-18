import type { SignalType } from '../types/index.js';

interface SignalInput {
  prevFast: number;
  prevSlow: number;
  currentFast: number;
  currentSlow: number;
  currentRsi: number;
  rsiLongLower: number;
  rsiLongUpper: number;
  rsiShortLower: number;
  rsiShortUpper: number;
}

export const generateSignal = (input: SignalInput): SignalType => {
  const bullishCross = input.prevFast <= input.prevSlow && input.currentFast > input.currentSlow;
  const bearishCross = input.prevFast >= input.prevSlow && input.currentFast < input.currentSlow;

  if (bullishCross && input.currentRsi >= input.rsiLongLower && input.currentRsi <= input.rsiLongUpper) {
    return 'LONG';
  }

  if (bearishCross && input.currentRsi >= input.rsiShortLower && input.currentRsi <= input.rsiShortUpper) {
    return 'SHORT';
  }

  return 'NEUTRAL';
};
