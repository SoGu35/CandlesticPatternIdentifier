import type { Candle, ConfidenceLevel, PatternResult } from './types';

export function refineConfidence(
  pattern: PatternResult,
  candles: Candle[]
): PatternResult {
  if (candles.length < 20) return pattern;

  let score = 1; // start at moderate (0=weak, 1=moderate, 2=strong)

  const current = candles[candles.length - 1];
  const recentCandles = candles.slice(-20);

  // Volume factor: compare current volume to 20-period average
  const avgVolume = recentCandles.reduce((s, c) => s + c.volume, 0) / recentCandles.length;
  if (avgVolume > 0) {
    const volumeRatio = current.volume / avgVolume;
    if (volumeRatio > 1.5) score++;
    else if (volumeRatio < 0.5) score--;
  }

  // Body size factor: compare body to average true range
  const avgRange = recentCandles.reduce((s, c) => s + (c.high - c.low), 0) / recentCandles.length;
  const body = Math.abs(current.close - current.open);
  if (avgRange > 0) {
    const bodyRatio = body / avgRange;
    if (bodyRatio > 0.7) score++;
    else if (bodyRatio < 0.2) score--;
  }

  const level: ConfidenceLevel =
    score <= 0 ? 'weak' : score >= 2 ? 'strong' : 'moderate';

  return { ...pattern, confidence: level };
}
