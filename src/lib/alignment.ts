import type { PatternResult, AlignmentState, AlignmentEntry, Timeframe } from './patterns/types';
import { signalDirection } from './patterns/types';

export function computeAlignment(
  primaryPattern: PatternResult | null,
  allPatterns: { '1min': PatternResult[]; '5min': PatternResult[]; '15min': PatternResult[] }
): AlignmentState {
  if (!primaryPattern) {
    return {
      primaryPattern: null,
      lookbackMinutes: 0,
      entries: [],
      score: 0,
    };
  }

  // Lookback window scales with the 15min pattern's candle count
  const lookbackMinutes = primaryPattern.candleCount * 15;
  const cutoff = primaryPattern.time - lookbackMinutes * 60;

  const entries: AlignmentEntry[] = (['1min', '5min', '15min'] as Timeframe[]).map((tf) => ({
    timeframe: tf,
    patterns: allPatterns[tf].filter((p) => p.time >= cutoff),
  }));

  // Calculate alignment score (-100 to +100)
  const score = calculateScore(entries);

  return {
    primaryPattern,
    lookbackMinutes,
    entries,
    score,
  };
}

function calculateScore(entries: AlignmentEntry[]): number {
  const weights: Record<Timeframe, number> = {
    '15min': 3,
    '5min': 2,
    '1min': 1,
  };

  const confidenceMultiplier: Record<string, number> = {
    weak: 0.5,
    moderate: 1,
    strong: 1.5,
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const entry of entries) {
    for (const pattern of entry.patterns) {
      const direction = signalDirection(pattern.signal);
      const weight = weights[entry.timeframe];
      const confMult = confidenceMultiplier[pattern.confidence];
      weightedSum += direction * weight * confMult;
      totalWeight += weight * confMult;
    }
  }

  if (totalWeight === 0) return 0;

  // Normalize to -100..+100
  return Math.round((weightedSum / totalWeight) * 100);
}
