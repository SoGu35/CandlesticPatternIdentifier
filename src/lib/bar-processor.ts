import type { Candle } from './patterns/types';
import type { CandleStore } from '../store/candle-store';
import { aggregateCandles, isBucketComplete } from './candle-aggregator';
import { detectPatterns } from './patterns';

export const MAX_CANDLES = 500;

export interface BarProcessorState {
  oneMin: Candle[];
  patterns: CandleStore['patterns'];
  last5minBucket: number;
  last15minBucket: number;
}

export interface ProcessBarResult {
  fiveMin: Candle[];
  fifteenMin: Candle[];
}

/**
 * Accumulates a closed 1min bar into the processor state, running pattern
 * detection on completed 5min and 15min buckets. Returns the current
 * aggregated candles for both higher timeframes.
 */
export function processBar(bar: Candle, state: BarProcessorState): ProcessBarResult {
  const candles = state.oneMin;

  if (candles.length > 0 && candles[candles.length - 1].time === bar.time) {
    candles[candles.length - 1] = bar;
  } else {
    candles.push(bar);
  }
  if (candles.length > MAX_CANDLES) candles.splice(0, candles.length - MAX_CANDLES);

  const new1min = detectPatterns(candles, '1min');
  if (new1min.length > 0) {
    state.patterns['1min'] = [...state.patterns['1min'], ...new1min].slice(-100);
  }

  const fiveMin = aggregateCandles(candles, 5);
  const latest5 = fiveMin.length > 0 ? fiveMin[fiveMin.length - 1].time : 0;
  if (latest5 > state.last5minBucket && isBucketComplete(latest5, 5, candles)) {
    state.last5minBucket = latest5;
    const new5min = detectPatterns(fiveMin, '5min');
    if (new5min.length > 0) {
      state.patterns['5min'] = [...state.patterns['5min'], ...new5min].slice(-100);
    }
  }

  const fifteenMin = aggregateCandles(candles, 15);
  const latest15 = fifteenMin.length > 0 ? fifteenMin[fifteenMin.length - 1].time : 0;
  if (latest15 > state.last15minBucket && isBucketComplete(latest15, 15, candles)) {
    state.last15minBucket = latest15;
    const new15min = detectPatterns(fifteenMin, '15min');
    if (new15min.length > 0) {
      state.patterns['15min'] = [...state.patterns['15min'], ...new15min].slice(-100);
    }
  }

  return { fiveMin, fifteenMin };
}
