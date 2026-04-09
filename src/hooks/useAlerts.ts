import { useEffect, useRef } from 'react';
import type { PatternResult, AlignmentState } from '../lib/patterns/types';

const ALERT_THRESHOLD = 50;

export function useAlerts(
  patterns: { '1min': PatternResult[]; '5min': PatternResult[]; '15min': PatternResult[] },
  alignment: AlignmentState
) {
  // Both refs store the candle timestamp of the last event we alerted on.
  // Keying on pattern time (not wall clock) guarantees exactly one notification
  // per trigger — no re-firing while the same pattern/alignment stays active.
  const last15minPatternTimeRef = useRef(0);
  const lastAlignmentPatternTimeRef = useRef(0);
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

    // ── Alignment alert (once per primary pattern) ───────────────────────────
    // Only fires when a new 15min primary pattern drives the alignment above
    // the threshold — not repeatedly while the same pattern stays active.
    if (
      alignment.primaryPattern &&
      alignment.primaryPattern.time > lastAlignmentPatternTimeRef.current &&
      Math.abs(alignment.score) >= ALERT_THRESHOLD
    ) {
      const direction = alignment.score > 0 ? 'Bullish' : 'Bearish';
      triggerAlert(`${direction} alignment: ${alignment.score}`);
      lastAlignmentPatternTimeRef.current = alignment.primaryPattern.time;
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
