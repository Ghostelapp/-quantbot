export const rsi = (values: number[], period = 14): number[] => {
  if (period <= 0) {
    throw new Error('RSI period must be positive.');
  }
  if (values.length === 0) {
    return [];
  }
  if (values.length <= period) {
    return values.map(() => 50);
  }

  const output: number[] = new Array(values.length).fill(50);

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = (values[i] ?? 0) - (values[i - 1] ?? 0);
    if (delta >= 0) {
      gains += delta;
    } else {
      losses -= delta;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  output[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i += 1) {
    const delta = (values[i] ?? 0) - (values[i - 1] ?? 0);
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    output[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return output;
};
