import type { Candle, PatternResult, Timeframe } from './types';
import { signalColor } from './types';

function bodySize(c: Candle): number {
  return Math.abs(c.close - c.open);
}

function range(c: Candle): number {
  return c.high - c.low;
}

function upperWick(c: Candle): number {
  return c.high - Math.max(c.open, c.close);
}

function lowerWick(c: Candle): number {
  return Math.min(c.open, c.close) - c.low;
}

function isBullish(c: Candle): boolean {
  return c.close > c.open;
}

function isDowntrend(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  let declining = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close < candles[i - 1].close) declining++;
  }
  return declining >= Math.floor(candles.length * 0.6);
}

function isUptrend(candles: Candle[]): boolean {
  if (candles.length < 3) return false;
  let rising = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) rising++;
  }
  return rising >= Math.floor(candles.length * 0.6);
}

export function detectSinglePatterns(
  candles: Candle[],
  timeframe: Timeframe
): PatternResult[] {
  if (candles.length < 6) return [];

  const results: PatternResult[] = [];
  const current = candles[candles.length - 1];
  const prior = candles.slice(-6, -1);
  const r = range(current);
  const body = bodySize(current);
  const uWick = upperWick(current);
  const lWick = lowerWick(current);

  if (r === 0) return results;

  const bodyRatio = body / r;
  const time = current.time;

  // Hammer - requires downtrend
  if (
    isDowntrend(prior) &&
    bodyRatio < 0.35 &&
    lWick >= body * 2 &&
    uWick < body * 0.5 &&
    body > 0
  ) {
    const signal = 'bullish-reversal' as const;
    results.push({ name: 'Hammer', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 1, time, timeframe });
  }

  // Inverted Hammer - requires downtrend
  if (
    isDowntrend(prior) &&
    bodyRatio < 0.35 &&
    uWick >= body * 2 &&
    lWick < body * 0.5 &&
    body > 0
  ) {
    const signal = 'bullish-reversal' as const;
    results.push({ name: 'Inverted Hammer', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 1, time, timeframe });
  }

  // Hanging Man - requires uptrend
  if (
    isUptrend(prior) &&
    bodyRatio < 0.35 &&
    lWick >= body * 2 &&
    uWick < body * 0.5 &&
    body > 0
  ) {
    const signal = 'bearish-reversal' as const;
    results.push({ name: 'Hanging Man', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 1, time, timeframe });
  }

  // Shooting Star - requires uptrend
  if (
    isUptrend(prior) &&
    bodyRatio < 0.35 &&
    uWick >= body * 2 &&
    lWick < body * 0.5 &&
    body > 0
  ) {
    const signal = 'bearish-reversal' as const;
    results.push({ name: 'Shooting Star', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 1, time, timeframe });
  }

  // Doji
  if (bodyRatio < 0.05 && r > 0) {
    // Check for dragonfly / gravestone variants
    if (lWick > r * 0.6 && uWick < r * 0.1) {
      const signal = 'bullish-reversal' as const;
      results.push({ name: 'Dragonfly Doji', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 1, time, timeframe });
    } else if (uWick > r * 0.6 && lWick < r * 0.1) {
      const signal = 'bearish-reversal' as const;
      results.push({ name: 'Gravestone Doji', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 1, time, timeframe });
    } else {
      const signal = 'indecision' as const;
      results.push({ name: 'Doji', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 1, time, timeframe });
    }
  }

  // Bullish Marubozu
  if (
    isBullish(current) &&
    bodyRatio > 0.9 &&
    uWick < body * 0.05 &&
    lWick < body * 0.05
  ) {
    const signal = 'bullish-continuation' as const;
    results.push({ name: 'Bullish Marubozu', signal, color: signalColor(signal), confidence: 'strong', candleCount: 1, time, timeframe });
  }

  // Bearish Marubozu
  if (
    !isBullish(current) &&
    bodyRatio > 0.9 &&
    uWick < body * 0.05 &&
    lWick < body * 0.05
  ) {
    const signal = 'bearish-continuation' as const;
    results.push({ name: 'Bearish Marubozu', signal, color: signalColor(signal), confidence: 'strong', candleCount: 1, time, timeframe });
  }

  return results;
}
