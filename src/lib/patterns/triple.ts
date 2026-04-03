import type { Candle, PatternResult, Timeframe } from './types';
import { signalColor } from './types';

function bodySize(c: Candle): number {
  return Math.abs(c.close - c.open);
}

function range(c: Candle): number {
  return c.high - c.low;
}

function isBullish(c: Candle): boolean {
  return c.close > c.open;
}

export function detectTriplePatterns(
  candles: Candle[],
  timeframe: Timeframe
): PatternResult[] {
  if (candles.length < 3) return [];

  const results: PatternResult[] = [];
  const c1 = candles[candles.length - 3];
  const c2 = candles[candles.length - 2];
  const c3 = candles[candles.length - 1];
  const time = c3.time;

  const body1 = bodySize(c1);
  const body2 = bodySize(c2);
  const body3 = bodySize(c3);
  const range1 = range(c1);
  const range2 = range(c2);
  const range3 = range(c3);

  // Morning Star: red candle, small-body candle, green candle. No gap required.
  if (
    !isBullish(c1) &&
    body1 > range1 * 0.4 &&
    body2 < range1 * 0.3 &&
    isBullish(c3) &&
    body3 > range3 * 0.4 &&
    c3.close > (c1.open + c1.close) / 2
  ) {
    const signal = 'bullish-reversal' as const;
    results.push({ name: 'Morning Star', signal, color: signalColor(signal), confidence: 'strong', candleCount: 3, time, timeframe });
  }

  // Evening Star: green candle, small-body candle, red candle. No gap required.
  if (
    isBullish(c1) &&
    body1 > range1 * 0.4 &&
    body2 < range1 * 0.3 &&
    !isBullish(c3) &&
    body3 > range3 * 0.4 &&
    c3.close < (c1.open + c1.close) / 2
  ) {
    const signal = 'bearish-reversal' as const;
    results.push({ name: 'Evening Star', signal, color: signalColor(signal), confidence: 'strong', candleCount: 3, time, timeframe });
  }

  // Three White Soldiers: 3 consecutive green with higher closes, each with long body (>60% of range)
  if (
    isBullish(c1) && isBullish(c2) && isBullish(c3) &&
    c2.close > c1.close && c3.close > c2.close &&
    c2.open > c1.open && c3.open > c2.open &&
    body1 > range1 * 0.6 &&
    body2 > range2 * 0.6 &&
    body3 > range3 * 0.6
  ) {
    const signal = 'bullish-continuation' as const;
    results.push({ name: 'Three White Soldiers', signal, color: signalColor(signal), confidence: 'strong', candleCount: 3, time, timeframe });
  }

  // Three Black Crows: 3 consecutive red with lower closes, each with long body (>60% of range)
  if (
    !isBullish(c1) && !isBullish(c2) && !isBullish(c3) &&
    c2.close < c1.close && c3.close < c2.close &&
    c2.open < c1.open && c3.open < c2.open &&
    body1 > range1 * 0.6 &&
    body2 > range2 * 0.6 &&
    body3 > range3 * 0.6
  ) {
    const signal = 'bearish-continuation' as const;
    results.push({ name: 'Three Black Crows', signal, color: signalColor(signal), confidence: 'strong', candleCount: 3, time, timeframe });
  }

  return results;
}
