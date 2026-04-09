import { useEffect, useRef, useState, useCallback } from 'react';
import type { Candle } from '../lib/patterns/types';
import type { CandleStore } from '../store/candle-store';
import { initialStore } from '../store/candle-store';
import { computeAlignment, selectPrimaryPattern } from '../lib/alignment';
import { processBar as sharedProcessBar } from '../lib/bar-processor';
import type { ProcessBarResult } from '../lib/bar-processor';
import { pickRandomTradingDay } from '../lib/trading-days';

export const SPEED_LEVELS = [0.25, 0.5, 1, 2, 5, 10, 20] as const;
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

  // ── Inner helpers (stable, use refs only) ──────────────────────────────────

  function advanceBar(bar: Candle): ProcessBarResult {
    const state = {
      oneMin: oneMinRef.current,
      patterns: patternsRef.current,
      last5minBucket: last5minBucketRef.current,
      last15minBucket: last15minBucketRef.current,
    };
    const result = sharedProcessBar(bar, state);
    last5minBucketRef.current = state.last5minBucket;
    last15minBucketRef.current = state.last15minBucket;
    return result;
  }

  function flushStore({ fiveMin, fifteenMin }: ProcessBarResult) {
    const primaryPattern = selectPrimaryPattern(patternsRef.current['15min']);
    const alignment = computeAlignment(primaryPattern, patternsRef.current);
    setStore({
      oneMin: [...oneMinRef.current],
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

      const result = advanceBar(allBars[cursor]);
      cursorRef.current = cursor + 1;
      setCurrentBarIndex(cursor + 1);
      flushStore(result);
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
    let lastResult: ProcessBarResult = { fiveMin: [], fifteenMin: [] };
    for (let i = from; i < to; i++) lastResult = advanceBar(allBars[i]);
    cursorRef.current = to;
    setCurrentBarIndex(to);
    flushStore(lastResult);
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
    let lastResult: ProcessBarResult = { fiveMin: [], fifteenMin: [] };
    for (let i = 0; i < newCursor; i++) lastResult = advanceBar(allBars[i]);
    cursorRef.current = newCursor;
    setCurrentBarIndex(newCursor);
    flushStore(lastResult);
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
