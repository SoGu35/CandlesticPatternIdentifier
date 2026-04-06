import { useEffect, useRef, useState, useCallback } from 'react';
import type { Candle } from '../lib/patterns/types';
import type { CandleStore } from '../store/candle-store';
import { initialStore } from '../store/candle-store';
import { aggregateCandles, isBucketComplete } from '../lib/candle-aggregator';
import { detectPatterns } from '../lib/patterns';
import { computeAlignment, selectPrimaryPattern } from '../lib/alignment';

const MAX_CANDLES = 500;
const SPEED_LEVELS = [0.25, 0.5, 1, 2, 5, 10, 20] as const;
const DEFAULT_SPEED_INDEX = 2; // 1x
const SKIP_BARS = 10;

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'done';

export interface PracticeReplayControls {
  state: PlaybackState;
  speedIndex: number;
  speed: number;
  currentBar: number;
  totalBars: number;
  tradingDate: string;
  play: () => void;
  pause: () => void;
  speedUp: () => void;
  slowDown: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  reload: () => void;
}

// ── Trading day helpers ───────────────────────────────────────────────────────

const US_MARKET_HOLIDAYS = new Set([
  '2024-01-01', '2024-01-15', '2024-02-19', '2024-03-29',
  '2024-05-27', '2024-06-19', '2024-07-04', '2024-09-02',
  '2024-11-28', '2024-11-29', '2024-12-25',
  '2025-01-01', '2025-01-09', '2025-01-20', '2025-02-17',
  '2025-04-18', '2025-05-26', '2025-06-19', '2025-07-04',
  '2025-09-01', '2025-11-27', '2025-12-25',
]);

function secondSundayOfMarch(year: number): Date {
  const march1 = new Date(Date.UTC(year, 2, 1));
  const dow = march1.getUTCDay();
  const firstSunday = dow === 0 ? 1 : 8 - dow;
  return new Date(Date.UTC(year, 2, firstSunday + 7));
}

function firstSundayOfNovember(year: number): Date {
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const dow = nov1.getUTCDay();
  const firstSunday = dow === 0 ? 1 : 8 - dow;
  return new Date(Date.UTC(year, 10, firstSunday));
}

function isEasternDST(date: Date): boolean {
  const year = date.getUTCFullYear();
  return date >= secondSundayOfMarch(year) && date < firstSundayOfNovember(year);
}

function pickRandomTradingDay(): { start: string; end: string; label: string } {
  const todayMs = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;

  for (let attempt = 0; attempt < 60; attempt++) {
    const offsetMs = Math.floor(Math.random() * (oneYearMs - 86400000)) + 86400000;
    const candidate = new Date(todayMs - offsetMs);
    const dow = candidate.getUTCDay();
    if (dow === 0 || dow === 6) continue;

    const dateStr = candidate.toISOString().slice(0, 10);
    if (US_MARKET_HOLIDAYS.has(dateStr)) continue;

    const dst = isEasternDST(candidate);
    const open = dst ? 'T13:30:00Z' : 'T14:30:00Z';
    const close = dst ? 'T20:00:00Z' : 'T21:00:00Z';

    return { start: `${dateStr}${open}`, end: `${dateStr}${close}`, label: dateStr };
  }

  // Fallback to a known good date
  return { start: '2024-10-15T13:30:00Z', end: '2024-10-15T20:00:00Z', label: '2024-10-15' };
}

// ── Bar fetching ──────────────────────────────────────────────────────────────

async function fetchDayBars(start: string, end: string, signal: AbortSignal): Promise<Candle[]> {
  const params = new URLSearchParams({ timeframe: '1Min', start, end, limit: '390' });
  const res = await fetch(`/api/bars/SPY?${params}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { bars: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }> };
  return (data.bars ?? []).map((bar) => ({
    time: Math.floor(new Date(bar.t).getTime() / 1000),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePracticeReplay(): [CandleStore, PracticeReplayControls] {
  // Candle accumulation refs
  const allBarsRef = useRef<Candle[]>([]);
  const oneMinRef = useRef<Candle[]>([]);
  const patternsRef = useRef<CandleStore['patterns']>({ '1min': [], '5min': [], '15min': [] });
  const last5minBucketRef = useRef(0);
  const last15minBucketRef = useRef(0);
  const cursorRef = useRef(0);

  // Timer refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedIndexRef = useRef(DEFAULT_SPEED_INDEX);

  // React state
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [tradingDate, setTradingDate] = useState('');
  const [store, setStore] = useState<CandleStore>(initialStore);
  const [totalBars, setTotalBars] = useState(0);
  const [currentBarIndex, setCurrentBarIndex] = useState(0);

  // Keep speedIndexRef in sync
  useEffect(() => { speedIndexRef.current = speedIndex; }, [speedIndex]);

  // ── Inner helpers (stable, use refs only) ──────────────────────────────────

  function processBar(bar: Candle) {
    const candles = oneMinRef.current;

    if (candles.length > 0 && candles[candles.length - 1].time === bar.time) {
      candles[candles.length - 1] = bar;
    } else {
      candles.push(bar);
    }
    if (candles.length > MAX_CANDLES) candles.splice(0, candles.length - MAX_CANDLES);

    // 1min patterns
    const new1min = detectPatterns(candles, '1min');
    if (new1min.length > 0) {
      patternsRef.current['1min'] = [...patternsRef.current['1min'], ...new1min].slice(-100);
    }

    // 5min bucket
    const fiveMin = aggregateCandles(candles, 5);
    const latest5 = fiveMin.length > 0 ? fiveMin[fiveMin.length - 1].time : 0;
    if (latest5 > last5minBucketRef.current && isBucketComplete(latest5, 5, candles)) {
      last5minBucketRef.current = latest5;
      const new5min = detectPatterns(fiveMin, '5min');
      if (new5min.length > 0) {
        patternsRef.current['5min'] = [...patternsRef.current['5min'], ...new5min].slice(-100);
      }
    }

    // 15min bucket
    const fifteenMin = aggregateCandles(candles, 15);
    const latest15 = fifteenMin.length > 0 ? fifteenMin[fifteenMin.length - 1].time : 0;
    if (latest15 > last15minBucketRef.current && isBucketComplete(latest15, 15, candles)) {
      last15minBucketRef.current = latest15;
      const new15min = detectPatterns(fifteenMin, '15min');
      if (new15min.length > 0) {
        patternsRef.current['15min'] = [...patternsRef.current['15min'], ...new15min].slice(-100);
      }
    }
  }

  function flushStore() {
    const candles = oneMinRef.current;
    const fiveMin = aggregateCandles(candles, 5);
    const fifteenMin = aggregateCandles(candles, 15);
    const primaryPattern = selectPrimaryPattern(patternsRef.current['15min']);
    const alignment = computeAlignment(primaryPattern, patternsRef.current);
    setStore({
      oneMin: [...candles],
      fiveMin,
      fifteenMin,
      formingBar: null,
      patterns: { ...patternsRef.current },
      alignment,
      connected: true,
    });
  }

  function stopTimer() {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer(spdIdx: number) {
    stopTimer();
    const multiplier = SPEED_LEVELS[spdIdx];
    const intervalMs = Math.round(1000 / multiplier);
    timerRef.current = setInterval(() => {
      const allBars = allBarsRef.current;
      const cursor = cursorRef.current;

      if (cursor >= allBars.length) {
        stopTimer();
        setPlaybackState('done');
        return;
      }

      processBar(allBars[cursor]);
      cursorRef.current = cursor + 1;
      setCurrentBarIndex(cursor + 1);
      flushStore();
    }, intervalMs);
  }

  function resetAccumulated() {
    oneMinRef.current = [];
    patternsRef.current = { '1min': [], '5min': [], '15min': [] };
    last5minBucketRef.current = 0;
    last15minBucketRef.current = 0;
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  const play = useCallback(() => {
    if (cursorRef.current >= allBarsRef.current.length) return;
    startTimer(speedIndexRef.current);
    setPlaybackState('playing');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pause = useCallback(() => {
    stopTimer();
    setPlaybackState('paused');
  }, []);

  const speedUp = useCallback(() => {
    setSpeedIndex((prev) => {
      const next = Math.min(prev + 1, SPEED_LEVELS.length - 1);
      speedIndexRef.current = next;
      // Restart timer only if playing — check ref to avoid stale closure on state
      if (timerRef.current !== null) startTimer(next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slowDown = useCallback(() => {
    setSpeedIndex((prev) => {
      const next = Math.max(prev - 1, 0);
      speedIndexRef.current = next;
      if (timerRef.current !== null) startTimer(next);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipForward = useCallback(() => {
    const allBars = allBarsRef.current;
    const from = cursorRef.current;
    const to = Math.min(from + SKIP_BARS, allBars.length);
    for (let i = from; i < to; i++) processBar(allBars[i]);
    cursorRef.current = to;
    setCurrentBarIndex(to);
    flushStore();
    if (to >= allBars.length) {
      stopTimer();
      setPlaybackState('done');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipBackward = useCallback(() => {
    const newCursor = Math.max(cursorRef.current - SKIP_BARS, 0);
    resetAccumulated();
    const allBars = allBarsRef.current;
    for (let i = 0; i < newCursor; i++) processBar(allBars[i]);
    cursorRef.current = newCursor;
    setCurrentBarIndex(newCursor);
    flushStore();
    // If we were 'done', go back to paused
    setPlaybackState((prev) => (prev === 'done' ? 'paused' : prev));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDay = useCallback(() => {
    stopTimer();
    resetAccumulated();
    cursorRef.current = 0;
    setCurrentBarIndex(0);
    setTotalBars(0);
    setTradingDate('');
    setStore({ ...initialStore, connected: false });
    setPlaybackState('loading');

    const { start, end, label } = pickRandomTradingDay();
    setTradingDate(label);

    const controller = new AbortController();

    fetchDayBars(start, end, controller.signal)
      .then((bars) => {
        if (bars.length === 0) throw new Error('No bars returned');
        allBarsRef.current = bars;
        setTotalBars(bars.length);
        setStore((prev) => ({ ...prev, connected: true }));
        setPlaybackState('paused');
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        console.error('Practice load error:', err);
        setPlaybackState('idle');
      });

    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-load on mount
  useEffect(() => {
    const cleanup = loadDay();
    return () => {
      stopTimer();
      cleanup?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [
    store,
    {
      state: playbackState,
      speedIndex,
      speed: SPEED_LEVELS[speedIndex],
      currentBar: currentBarIndex,
      totalBars,
      tradingDate,
      play,
      pause,
      speedUp,
      slowDown,
      skipForward,
      skipBackward,
      reload: loadDay,
    },
  ];
}
