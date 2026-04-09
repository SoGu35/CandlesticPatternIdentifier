import { useEffect, useState } from 'react';
import type { Candle, PatternResult } from '../lib/patterns/types';
import { signalDirection } from '../lib/patterns/types';
import { processBar } from '../lib/bar-processor';
import { computeAlignment, selectPrimaryPattern } from '../lib/alignment';
import { getRecentTradingDays, type TradingDayBounds } from '../lib/trading-days';

const FORWARD_WINDOW_S = 60 * 60; // 1 hour

export interface AccuracyPoint {
  date: string;                    // 'YYYY-MM-DD'
  time: number;                    // unix seconds at trigger detection
  patternName: string;
  direction: number;               // +1 bullish, -1 bearish, 0 indecision
  score: number;                   // alignment score at trigger (-100..+100)
  pctChange: number;               // % change of close price 60 minutes later
  isOutlier: boolean;              // score and pctChange disagree on direction
  peakMovePct: number;             // best 1min close in signal direction before failure/1h cap
  adverseMovePct: number;          // worst 1min close against signal before failure/1h cap
  peakAdverseRatio: number | null; // peakMovePct / adverseMovePct; null if price never moved against
  alignmentDurationMin: number | null; // minutes until first 5min close crosses back; null = held >1h
  sessionMinute: number;           // minutes since market open (0 = 9:30 ET, 390 = 4:00 ET)
  // New fields
  rvol: number;                    // triggerBarVolume / avgVolForThatMinuteSlot
  twoBarStopAdversePct: number;    // adverse % at 2-candle stop exit (or adverseMovePct if never hit)
  twoBarStopHit: boolean;          // whether 2-candle stop triggered within 1h
  cleannessPct: number;            // peakMovePct / (peakMovePct + adverseMovePct) * 100
  timeTopeakMin: number;           // minutes from trigger to bar achieving peakMovePct
}

export interface AccuracyScorecardState {
  points: AccuracyPoint[];
  loading: boolean;
  error: string | null;
  daysCovered: number;
}

async function fetchDayBars(day: TradingDayBounds, signal: AbortSignal): Promise<Candle[]> {
  const params = new URLSearchParams({
    timeframe: '1Min',
    start: day.start,
    end: day.end,
    limit: '500',
  });
  const res = await fetch(`/api/bars/SPY?${params}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as {
    bars: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>;
  };
  return (data.bars ?? []).map((bar) => ({
    time: Math.floor(new Date(bar.t).getTime() / 1000),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }));
}

interface PendingTrigger {
  time: number;
  triggerPrice: number;
  triggerVolume: number;
  avgVol: number;
  patternName: string;
  direction: number;
  score: number;
}

interface TriggerStats {
  peakMovePct: number;
  adverseMovePct: number;
  peakAdverseRatio: number | null;
  alignmentDurationMin: number | null;
  sessionMinute: number;
  rvol: number;
  twoBarStopAdversePct: number;
  twoBarStopHit: boolean;
  cleannessPct: number;
  timeTopeakMin: number;
}

function computeTriggerStats(
  trigger: PendingTrigger,
  bars: Candle[],
  marketOpenSec: number,
): TriggerStats {
  const avgVol = trigger.avgVol;
  const postBars = bars.filter(
    (b) => b.time > trigger.time && b.time <= trigger.time + FORWARD_WINDOW_S,
  );

  let peakMovePct = 0;
  let adverseMovePct = 0;
  let timeToPeakBar: number = trigger.time;

  const bucketMap = new Map<number, Candle[]>();
  for (const bar of postBars) {
    const key = Math.floor(bar.time / 300) * 300;
    if (!bucketMap.has(key)) bucketMap.set(key, []);
    bucketMap.get(key)!.push(bar);
  }

  let alignmentEnd: number | null = null;
  let twoBarStopHit = false;
  let twoBarStopAdversePct = 0;
  let consecutiveFails = 0;

  for (const key of Array.from(bucketMap.keys()).sort((a, b) => a - b)) {
    const bkBars = bucketMap.get(key)!;

    for (const bar of bkBars) {
      let move: number;
      let adv: number;
      if (trigger.direction > 0) {
        move = (bar.close - trigger.triggerPrice) / trigger.triggerPrice * 100;
        adv = (trigger.triggerPrice - bar.close) / trigger.triggerPrice * 100;
      } else if (trigger.direction < 0) {
        move = (trigger.triggerPrice - bar.close) / trigger.triggerPrice * 100;
        adv = (bar.close - trigger.triggerPrice) / trigger.triggerPrice * 100;
      } else {
        continue;
      }
      if (move > peakMovePct) {
        peakMovePct = move;
        timeToPeakBar = bar.time;
      }
      if (adv > 0) adverseMovePct = Math.max(adverseMovePct, adv);
    }

    // 5-min candle alignment check (need full 5 bars in bucket)
    if (bkBars.length >= 5) {
      const fiveClose = bkBars[bkBars.length - 1].close;
      const failed =
        (trigger.direction > 0 && fiveClose < trigger.triggerPrice) ||
        (trigger.direction < 0 && fiveClose > trigger.triggerPrice);

      if (failed) {
        consecutiveFails += 1;
        if (alignmentEnd === null) {
          alignmentEnd = bkBars[bkBars.length - 1].time;
        }
        if (consecutiveFails >= 2 && !twoBarStopHit) {
          twoBarStopHit = true;
          twoBarStopAdversePct =
            Math.abs(fiveClose - trigger.triggerPrice) / trigger.triggerPrice * 100;
          break;
        }
      } else {
        consecutiveFails = 0;
        alignmentEnd = null; // reset — alignment recovered
      }
    }
  }

  // If 2-candle stop never hit, use max adverse as risk proxy
  if (!twoBarStopHit) {
    twoBarStopAdversePct = adverseMovePct;
  }

  const cleannessPct =
    peakMovePct + adverseMovePct > 0
      ? (peakMovePct / (peakMovePct + adverseMovePct)) * 100
      : 100;

  const rvol = avgVol > 0 ? trigger.triggerVolume / avgVol : 1;

  return {
    peakMovePct,
    adverseMovePct,
    peakAdverseRatio: adverseMovePct > 0 ? peakMovePct / adverseMovePct : null,
    alignmentDurationMin:
      alignmentEnd !== null ? Math.round((alignmentEnd - trigger.time) / 60) : null,
    sessionMinute: Math.round((trigger.time - marketOpenSec) / 60),
    rvol,
    twoBarStopAdversePct,
    twoBarStopHit,
    cleannessPct,
    timeTopeakMin: Math.round((timeToPeakBar - trigger.time) / 60),
  };
}

/**
 * Replays one day of 1min bars through the bar-processor, recording every
 * 15min pattern trigger together with the alignment score at that moment.
 */
function computeDayPoints(
  bars: Candle[],
  day: TradingDayBounds,
  minuteVolumeMap: Map<number, number>,
): AccuracyPoint[] {
  if (bars.length === 0) return [];

  const marketOpenSec = Math.floor(new Date(day.start).getTime() / 1000);

  const state = {
    oneMin: [] as Candle[],
    patterns: { '1min': [] as PatternResult[], '5min': [] as PatternResult[], '15min': [] as PatternResult[] },
    last5minBucket: 0,
    last15minBucket: 0,
  };

  const triggers: PendingTrigger[] = [];

  for (const bar of bars) {
    const before15 = state.patterns['15min'].length;
    processBar(bar, state);
    const after15 = state.patterns['15min'].length;

    if (after15 > before15) {
      const primary = selectPrimaryPattern(state.patterns['15min']);
      if (!primary) continue;
      const alignment = computeAlignment(primary, state.patterns);
      const minuteOfDay = Math.round((bar.time - marketOpenSec) / 60);
      const avgVol = minuteVolumeMap.get(minuteOfDay) ?? 0;
      triggers.push({
        time: bar.time,
        triggerPrice: bar.close,
        triggerVolume: bar.volume ?? 0,
        avgVol,
        patternName: primary.name,
        direction: signalDirection(primary.signal),
        score: alignment.score,
      });
    }
  }

  const points: AccuracyPoint[] = [];
  for (const t of triggers) {
    const targetTime = t.time + FORWARD_WINDOW_S;
    const futureBar = bars.find((b) => b.time >= targetTime);
    if (!futureBar) continue;

    const pctChange = ((futureBar.close - t.triggerPrice) / t.triggerPrice) * 100;
    const isOutlier =
      (t.score > 0 && pctChange < 0) || (t.score < 0 && pctChange > 0);

    const stats = computeTriggerStats(t, bars, marketOpenSec);

    points.push({
      date: day.label,
      time: t.time,
      patternName: t.patternName,
      direction: t.direction,
      score: t.score,
      pctChange,
      isOutlier,
      ...stats,
    });
  }
  return points;
}

/** Build a map of minuteOfDay → average volume across all fetched bars. */
function buildMinuteVolumeMap(
  allResults: Array<{ day: TradingDayBounds; bars: Candle[] }>,
): Map<number, number> {
  const buckets = new Map<number, number[]>();
  for (const { day, bars } of allResults) {
    if (bars.length === 0) continue;
    const marketOpenSec = Math.floor(new Date(day.start).getTime() / 1000);
    for (const bar of bars) {
      const minuteOfDay = Math.round((bar.time - marketOpenSec) / 60);
      if (minuteOfDay < 0 || minuteOfDay > 389) continue;
      if (!buckets.has(minuteOfDay)) buckets.set(minuteOfDay, []);
      buckets.get(minuteOfDay)!.push(bar.volume ?? 0);
    }
  }
  const result = new Map<number, number>();
  for (const [min, vols] of buckets) {
    result.set(min, vols.reduce((a, b) => a + b, 0) / vols.length);
  }
  return result;
}

export interface AccuracyScorecardResult extends AccuracyScorecardState {
  refresh: () => void;
}

export function useAccuracyScorecard(days = 5): AccuracyScorecardResult {
  const [state, setState] = useState<AccuracyScorecardState>({
    points: [],
    loading: true,
    error: null,
    daysCovered: 0,
  });
  const [tick, setTick] = useState(0);

  const refresh = () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setTick((t) => t + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    const tradingDays = getRecentTradingDays(days);

    Promise.all(
      tradingDays.map(async (day) => {
        try {
          const bars = await fetchDayBars(day, controller.signal);
          return { day, bars, error: null as string | null };
        } catch (err) {
          if ((err as Error).name === 'AbortError') throw err;
          return { day, bars: [] as Candle[], error: (err as Error).message };
        }
      })
    )
      .then((results) => {
        const minuteVolumeMap = buildMinuteVolumeMap(results);
        const allPoints: AccuracyPoint[] = [];
        let covered = 0;
        for (const { day, bars } of results) {
          if (bars.length === 0) continue;
          covered += 1;
          allPoints.push(...computeDayPoints(bars, day, minuteVolumeMap));
        }
        allPoints.sort((a, b) => a.time - b.time);
        setState({ points: allPoints, loading: false, error: null, daysCovered: covered });
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setState({
          points: [],
          loading: false,
          error: (err as Error).message,
          daysCovered: 0,
        });
      });

    return () => controller.abort();
  }, [days, tick]);

  return { ...state, refresh };
}
