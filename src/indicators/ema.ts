export const ema = (values: number[], period: number): number[] => {
  if (period <= 0) {
    throw new Error('EMA period must be positive.');
  }
  if (values.length === 0) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const output: number[] = [];
  let previous = values[0] ?? 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? previous;
    previous = index === 0 ? value : (value - previous) * multiplier + previous;
    output.push(previous);
  }

  return output;
};
