import type { Candle, PatternResult, Timeframe } from './types';
import { signalColor } from './types';

function bodySize(c: Candle): number {
  return Math.abs(c.close - c.open);
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

function isSustainedDowntrend(candles: Candle[]): boolean {
  if (candles.length < 5) return false;
  let declining = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close < candles[i - 1].close) declining++;
  }
  return declining >= Math.floor(candles.length * 0.7);
}

function isSustainedUptrend(candles: Candle[]): boolean {
  if (candles.length < 5) return false;
  let rising = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) rising++;
  }
  return rising >= Math.floor(candles.length * 0.7);
}

export function detectDoublePatterns(
  candles: Candle[],
  timeframe: Timeframe
): PatternResult[] {
  if (candles.length < 7) return [];

  const results: PatternResult[] = [];
  const c1 = candles[candles.length - 2];
  const c2 = candles[candles.length - 1];
  const prior = candles.slice(-7, -2);
  const time = c2.time;

  const body1 = bodySize(c1);
  const body2 = bodySize(c2);

  // Bullish Engulfing
  if (
    !isBullish(c1) &&
    isBullish(c2) &&
    c2.open <= c1.close &&
    c2.close >= c1.open &&
    body2 > body1
  ) {
    const signal = 'bullish-reversal' as const;
    results.push({ name: 'Bullish Engulfing', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 2, time, timeframe });
  }

  // Bearish Engulfing
  if (
    isBullish(c1) &&
    !isBullish(c2) &&
    c2.open >= c1.close &&
    c2.close <= c1.open &&
    body2 > body1
  ) {
    const signal = 'bearish-reversal' as const;
    results.push({ name: 'Bearish Engulfing', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 2, time, timeframe });
  }

  // Tweezer Top - matching highs at uptrend top
  const highTolerance = (c1.high + c2.high) / 2 * 0.001;
  if (
    isUptrend(prior) &&
    Math.abs(c1.high - c2.high) <= highTolerance &&
    isBullish(c1) &&
    !isBullish(c2)
  ) {
    const signal = 'bearish-reversal' as const;
    results.push({ name: 'Tweezer Top', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 2, time, timeframe });
  }

  // Tweezer Bottom - matching lows at downtrend bottom
  const lowTolerance = (c1.low + c2.low) / 2 * 0.001;
  if (
    isDowntrend(prior) &&
    Math.abs(c1.low - c2.low) <= lowTolerance &&
    !isBullish(c1) &&
    isBullish(c2)
  ) {
    const signal = 'bullish-reversal' as const;
    results.push({ name: 'Tweezer Bottom', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 2, time, timeframe });
  }

  // Piercing Line - requires sustained downtrend (5+ candles declining)
  if (
    isSustainedDowntrend(prior) &&
    !isBullish(c1) &&
    isBullish(c2) &&
    c2.open < c1.close &&
    c2.close > (c1.open + c1.close) / 2 &&
    c2.close < c1.open
  ) {
    const signal = 'bullish-reversal' as const;
    results.push({ name: 'Piercing Line', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 2, time, timeframe });
  }

  // Dark Cloud Cover - requires sustained uptrend (5+ candles rising)
  if (
    isSustainedUptrend(prior) &&
    isBullish(c1) &&
    !isBullish(c2) &&
    c2.open > c1.close &&
    c2.close < (c1.open + c1.close) / 2 &&
    c2.close > c1.open
  ) {
    const signal = 'bearish-reversal' as const;
    results.push({ name: 'Dark Cloud Cover', signal, color: signalColor(signal), confidence: 'moderate', candleCount: 2, time, timeframe });
  }

  return results;
}
