import type { Candle } from './patterns/types';

/**
 * Aggregates completed 1-min candles into higher timeframe candles (5min, 15min).
 * Called on the frontend side to roll up 1min bars.
 */
export function aggregateCandles(
  oneMinCandles: Candle[],
  intervalMinutes: number
): Candle[] {
  if (oneMinCandles.length === 0) return [];

  const result: Candle[] = [];
  const intervalSeconds = intervalMinutes * 60;

  // Group candles by interval bucket
  const buckets = new Map<number, Candle[]>();

  for (const candle of oneMinCandles) {
    const bucketTime = Math.floor(candle.time / intervalSeconds) * intervalSeconds;
    if (!buckets.has(bucketTime)) {
      buckets.set(bucketTime, []);
    }
    buckets.get(bucketTime)!.push(candle);
  }

  // Convert buckets to aggregated candles
  const sortedBuckets = [...buckets.entries()].sort((a, b) => a[0] - b[0]);

  for (const [bucketTime, candles] of sortedBuckets) {
    if (candles.length === 0) continue;

    result.push({
      time: bucketTime,
      open: candles[0].open,
      high: Math.max(...candles.map((c) => c.high)),
      low: Math.min(...candles.map((c) => c.low)),
      close: candles[candles.length - 1].close,
      volume: candles.reduce((sum, c) => sum + c.volume, 0),
    });
  }

  return result;
}

/**
 * Check if a bucket is complete (all expected 1-min candles received).
 */
export function isBucketComplete(
  bucketTime: number,
  intervalMinutes: number,
  oneMinCandles: Candle[]
): boolean {
  const intervalSeconds = intervalMinutes * 60;
  const bucketEnd = bucketTime + intervalSeconds;
  const candlesInBucket = oneMinCandles.filter(
    (c) => c.time >= bucketTime && c.time < bucketEnd
  );
  return candlesInBucket.length >= intervalMinutes;
}
