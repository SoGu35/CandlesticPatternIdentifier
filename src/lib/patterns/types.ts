export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type SignalType =
  | 'bullish-reversal'
  | 'bearish-reversal'
  | 'bullish-continuation'
  | 'bearish-continuation'
  | 'indecision';

export type SignalColor = 'green' | 'red' | 'gray';

export type ConfidenceLevel = 'weak' | 'moderate' | 'strong';

export interface PatternResult {
  name: string;
  signal: SignalType;
  color: SignalColor;
  confidence: ConfidenceLevel;
  candleCount: 1 | 2 | 3;
  time: number;
  timeframe: Timeframe;
}

export type Timeframe = '1min' | '5min' | '15min';

export interface AlignmentEntry {
  timeframe: Timeframe;
  patterns: PatternResult[];
}

export interface AlignmentState {
  primaryPattern: PatternResult | null;
  lookbackMinutes: number;
  entries: AlignmentEntry[];
  score: number; // -100 to +100
}

export function signalColor(signal: SignalType): SignalColor {
  if (signal === 'indecision') return 'gray';
  return signal.startsWith('bullish') ? 'green' : 'red';
}

export function signalDirection(signal: SignalType): number {
  if (signal === 'indecision') return 0;
  return signal.startsWith('bullish') ? 1 : -1;
}
