import { useEffect, useRef } from 'react';
import type { PatternResult, AlignmentState } from '../lib/patterns/types';

const ALERT_THRESHOLD = 50;

export function useAlerts(
  patterns: { '1min': PatternResult[]; '5min': PatternResult[]; '15min': PatternResult[] },
  alignment: AlignmentState
) {
  const lastAlertTimeRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Check for alert-worthy conditions
    const now = Date.now() / 1000;

    // Don't alert more than once per 30 seconds
    if (now - lastAlertTimeRef.current < 30) return;

    // Alert on high-confidence 15min patterns
    const recent15 = patterns['15min'];
    if (recent15.length > 0) {
      const latest = recent15[recent15.length - 1];
      if (latest.confidence === 'strong' && latest.time > lastAlertTimeRef.current) {
        triggerAlert(`Strong ${latest.name} on 15min`);
        lastAlertTimeRef.current = now;
        return;
      }
    }

    // Alert on extreme alignment scores
    if (Math.abs(alignment.score) >= ALERT_THRESHOLD && alignment.primaryPattern) {
      const direction = alignment.score > 0 ? 'Bullish' : 'Bearish';
      triggerAlert(`${direction} alignment: ${alignment.score}`);
      lastAlertTimeRef.current = now;
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
