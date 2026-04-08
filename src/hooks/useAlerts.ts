import { useEffect, useRef } from 'react';
import type { PatternResult, AlignmentState } from '../lib/patterns/types';

const ALERT_THRESHOLD = 50;
// Cooldown for alignment alerts (seconds) — avoids spam while score stays extreme
const ALIGNMENT_COOLDOWN_S = 300;

export function useAlerts(
  patterns: { '1min': PatternResult[]; '5min': PatternResult[]; '15min': PatternResult[] },
  alignment: AlignmentState
) {
  // Tracks the candle timestamp of the last 15min pattern we alerted on.
  // Using the pattern's own time (not wall clock) guarantees exactly one
  // notification per 15min bucket, regardless of how many re-renders occur.
  const last15minPatternTimeRef = useRef(0);
  const lastAlignmentAlertRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // ── 15min pattern alert (once per pattern bucket) ────────────────────────
    const recent15 = patterns['15min'];
    if (recent15.length > 0) {
      const latest = recent15[recent15.length - 1];
      if (latest.time > last15minPatternTimeRef.current) {
        triggerAlert(`${latest.name} on 15min (${latest.confidence})`);
        last15minPatternTimeRef.current = latest.time;
        return;
      }
    }

    // ── Alignment alert (cooldown-based, still useful context) ───────────────
    const now = Date.now() / 1000;
    if (
      now - lastAlignmentAlertRef.current > ALIGNMENT_COOLDOWN_S &&
      Math.abs(alignment.score) >= ALERT_THRESHOLD &&
      alignment.primaryPattern
    ) {
      const direction = alignment.score > 0 ? 'Bullish' : 'Bearish';
      triggerAlert(`${direction} alignment: ${alignment.score}`);
      lastAlignmentAlertRef.current = now;
    }
  }, [patterns, alignment]);

  function triggerAlert(message: string) {
    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification('Candlestick Alert', { body: message });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    // Audio chime
    playChime();

    console.log('ALERT:', message);
  }

  function playChime() {
    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }
      const ctx = audioRef.current;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gain.gain.value = 0.3;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio not available
    }
  }
}
