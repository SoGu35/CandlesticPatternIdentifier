import { useEffect, useRef, useCallback, useState } from 'react';
import type { Candle } from '../lib/patterns/types';
import type { CandleStore } from '../store/candle-store';
import { initialStore } from '../store/candle-store';
import { aggregateCandles, isBucketComplete } from '../lib/candle-aggregator';
import { detectPatterns } from '../lib/patterns';
import { computeAlignment, selectPrimaryPattern } from '../lib/alignment';

const MAX_CANDLES = 500;
const STORAGE_KEY = 'candlestick-patterns';

function loadPersistedPatterns(): CandleStore['patterns'] {
  const empty = { '1min': [], '5min': [], '15min': [] };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return empty;
    const parsed = JSON.parse(stored);
    if (
      parsed && typeof parsed === 'object' &&
      Array.isArray(parsed['1min']) &&
      Array.isArray(parsed['5min']) &&
      Array.isArray(parsed['15min'])
    ) {
      return parsed as CandleStore['patterns'];
    }
  } catch { /* ignore */ }
  return empty;
}

function persistPatterns(patterns: CandleStore['patterns']) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
  } catch { /* ignore */ }
}

export function useCandleData(): CandleStore {
  const [store, setStore] = useState<CandleStore>(() => ({
    ...initialStore,
    patterns: loadPersistedPatterns(),
  }));

  const oneMinRef = useRef<Candle[]>([]);
  const patternsRef = useRef(store.patterns);
  const lastClosedMinuteRef = useRef(0);
  const last5minBucketRef = useRef(0);
  const last15minBucketRef = useRef(0);

  const handleBarClose = useCallback((bar: Candle) => {
    const candles = oneMinRef.current;
    // Avoid duplicates
    if (candles.length > 0 && candles[candles.length - 1].time === bar.time) {
      candles[candles.length - 1] = bar;
    } else {
      candles.push(bar);
    }
    if (candles.length > MAX_CANDLES) candles.splice(0, candles.length - MAX_CANDLES);

    // Detect 1min patterns
    const newPatterns1min = detectPatterns(candles, '1min');
    if (newPatterns1min.length > 0) {
      patternsRef.current['1min'] = [...patternsRef.current['1min'], ...newPatterns1min].slice(-100);
    }

    // Check 5min bucket
    const fiveMinCandles = aggregateCandles(candles, 5);
    const latest5bucket = fiveMinCandles.length > 0 ? fiveMinCandles[fiveMinCandles.length - 1].time : 0;
    if (latest5bucket > last5minBucketRef.current && isBucketComplete(latest5bucket, 5, candles)) {
      last5minBucketRef.current = latest5bucket;
      const newPatterns5min = detectPatterns(fiveMinCandles, '5min');
      if (newPatterns5min.length > 0) {
        patternsRef.current['5min'] = [...patternsRef.current['5min'], ...newPatterns5min].slice(-100);
      }
    }

    // Check 15min bucket
    const fifteenMinCandles = aggregateCandles(candles, 15);
    const latest15bucket = fifteenMinCandles.length > 0 ? fifteenMinCandles[fifteenMinCandles.length - 1].time : 0;
    if (latest15bucket > last15minBucketRef.current && isBucketComplete(latest15bucket, 15, candles)) {
      last15minBucketRef.current = latest15bucket;
      const newPatterns15min = detectPatterns(fifteenMinCandles, '15min');
      if (newPatterns15min.length > 0) {
        patternsRef.current['15min'] = [...patternsRef.current['15min'], ...newPatterns15min].slice(-100);
      }
    }

    persistPatterns(patternsRef.current);

    // Compute alignment based on most recent 15min pattern
    const primaryPattern = selectPrimaryPattern(patternsRef.current['15min']);
    const alignment = computeAlignment(primaryPattern, patternsRef.current);

    setStore({
      oneMin: [...candles],
      fiveMin: fiveMinCandles,
      fifteenMin: fifteenMinCandles,
      formingBar: null,
      patterns: { ...patternsRef.current },
      alignment,
      connected: true,
    });
  }, []);

  const handleBarUpdate = useCallback((bar: Candle) => {
    setStore((prev) => ({
      ...prev,
      formingBar: bar,
    }));
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connectWs() {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStore((prev) => ({ ...prev, connected: true }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'history') {
            // Load historical bars
            for (const bar of data.bars) {
              const candle: Candle = {
                time: bar.time,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: bar.volume,
              };
              oneMinRef.current.push(candle);
            }
            if (oneMinRef.current.length > MAX_CANDLES) {
              oneMinRef.current.splice(0, oneMinRef.current.length - MAX_CANDLES);
            }

            // Initial aggregation
            const fiveMin = aggregateCandles(oneMinRef.current, 5);
            const fifteenMin = aggregateCandles(oneMinRef.current, 15);

            if (fiveMin.length > 0) last5minBucketRef.current = fiveMin[fiveMin.length - 1].time;
            if (fifteenMin.length > 0) last15minBucketRef.current = fifteenMin[fifteenMin.length - 1].time;

            const recent15 = patternsRef.current['15min'];
            const primaryPattern = recent15.length > 0 ? recent15[recent15.length - 1] : null;
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
          } else if (data.type === 'bar_close') {
            const candle: Candle = {
              time: data.time,
              open: data.open,
              high: data.high,
              low: data.low,
              close: data.close,
              volume: data.volume,
            };
            if (data.time > lastClosedMinuteRef.current) {
              lastClosedMinuteRef.current = data.time;
              handleBarClose(candle);
            }
          } else if (data.type === 'bar_update') {
            const candle: Candle = {
              time: data.time,
              open: data.open,
              high: data.high,
              low: data.low,
              close: data.close,
              volume: data.volume,
            };
            handleBarUpdate(candle);
          }
        } catch (err) {
          console.error('WS message parse error:', err);
        }
      };

      ws.onclose = () => {
        setStore((prev) => ({ ...prev, connected: false }));
        retryTimeout = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectWs();

    return () => {
      clearTimeout(retryTimeout);
      ws?.close();
    };
  }, [handleBarClose, handleBarUpdate]);

  return store;
}
