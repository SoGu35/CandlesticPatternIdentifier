import type { Candle, PatternResult, Timeframe } from './types';
import { detectSinglePatterns } from './single';
import { detectDoublePatterns } from './double';
import { detectTriplePatterns } from './triple';
import { refineConfidence } from './confidence';

export function detectPatterns(
  candles: Candle[],
  timeframe: Timeframe
): PatternResult[] {
  const results: PatternResult[] = [
    ...detectSinglePatterns(candles, timeframe),
    ...detectDoublePatterns(candles, timeframe),
    ...detectTriplePatterns(candles, timeframe),
  ];

  return results.map((p) => refineConfidence(p, candles));
}

export type { Candle, PatternResult, Timeframe, SignalType, SignalColor, ConfidenceLevel } from './types';
export { signalColor, signalDirection } from './types';
