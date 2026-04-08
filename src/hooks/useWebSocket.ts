import { useEffect, useRef, useCallback, useState } from 'react';
import type { Candle } from '../lib/patterns/types';
import type { CandleStore } from '../store/candle-store';
import { initialStore } from '../store/candle-store';
import { aggregateCandles } from '../lib/candle-aggregator';
import { computeAlignment, selectPrimaryPattern } from '../lib/alignment';
import { processBar, MAX_CANDLES } from '../lib/bar-processor';

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
    const processorState = {
      oneMin: oneMinRef.current,
      patterns: patternsRef.current,
      last5minBucket: last5minBucketRef.current,
      last15minBucket: last15minBucketRef.current,
    };
    const { fiveMin, fifteenMin } = processBar(bar, processorState);
    last5minBucketRef.current = processorState.last5minBucket;
    last15minBucketRef.current = processorState.last15minBucket;

    persistPatterns(patternsRef.current);

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
