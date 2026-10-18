import assert from 'node:assert/strict';
import test from 'node:test';
import { ema } from '../src/indicators/ema.js';
import { rsi } from '../src/indicators/rsi.js';

test('EMA returns a smooth series with same length as input', () => {
  const values = [100, 101, 102, 101, 103, 104];
  const result = ema(values, 3);

  assert.equal(result.length, values.length);
  assert.ok(result[0] === values[0]);
  assert.ok(result[result.length - 1]! > result[0]!);
});

test('RSI returns bounded values', () => {
  const closes = [100, 101, 102, 100, 99, 100, 101, 103, 102, 101, 102, 104, 105, 106, 107, 108];
  const result = rsi(closes, 14);

  assert.equal(result.length, closes.length);
  const latest = result[result.length - 1]!;
  assert.ok(latest >= 0 && latest <= 100);
});
