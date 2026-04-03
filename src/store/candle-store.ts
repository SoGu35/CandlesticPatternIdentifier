import { createContext, useContext } from 'react';
import type { Candle, PatternResult, AlignmentState } from '../lib/patterns/types';

export interface CandleStore {
  oneMin: Candle[];
  fiveMin: Candle[];
  fifteenMin: Candle[];
  formingBar: Candle | null;
  patterns: {
    '1min': PatternResult[];
    '5min': PatternResult[];
    '15min': PatternResult[];
  };
  alignment: AlignmentState;
  connected: boolean;
}

export const initialStore: CandleStore = {
  oneMin: [],
  fiveMin: [],
  fifteenMin: [],
  formingBar: null,
  patterns: { '1min': [], '5min': [], '15min': [] },
  alignment: {
    primaryPattern: null,
    lookbackMinutes: 0,
    entries: [],
    score: 0,
  },
  connected: false,
};

export const CandleContext = createContext<CandleStore>(initialStore);

export function useCandleStore() {
  return useContext(CandleContext);
}
