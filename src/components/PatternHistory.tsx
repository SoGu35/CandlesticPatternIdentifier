import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { PatternResult } from '../lib/patterns/types';
import { formatTime } from '../utils/format';

interface Props {
  patterns: PatternResult[];
}

const colorClasses: Record<string, string> = {
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const PATTERN_DESCRIPTIONS: Record<string, string> = {
  'Hammer':               'Bounced off lows',
  'Inverted Hammer':      'Tested higher, held',
  'Hanging Man':          'Warning at the top',
  'Shooting Star':        'Rejected at highs',
  'Doji':                 'Buyers and sellers tied',
  'Dragonfly Doji':       'Rejected the lows hard',
  'Gravestone Doji':      'Rejected the highs hard',
  'Bullish Marubozu':     'Pure buying, no resistance',
  'Bearish Marubozu':     'Pure selling, no support',
  'Bullish Engulfing':    'Bears overwhelmed by bulls',
  'Bearish Engulfing':    'Bulls overwhelmed by bears',
  'Tweezer Top':          'Failed twice at the same high',
  'Tweezer Bottom':       'Held twice at the same low',
  'Piercing Line':        'Buyers pushed back into prior range',
  'Dark Cloud Cover':     'Sellers pushed back into prior range',
  'Morning Star':         'Indecision then reversal up',
  'Evening Star':         'Indecision then reversal down',
  'Three White Soldiers': 'Three straight strong up closes',
  'Three Black Crows':    'Three straight strong down closes',
};

const confidenceDots: Record<string, string> = {
  weak: 'opacity-30',
  moderate: 'opacity-60',
  strong: 'opacity-100',
};

interface TooltipState {
  text: string;
  x: number;
  y: number;
  placeBelow: boolean;
}

export function PatternHistory({ patterns }: Props) {
  // Tooltip is rendered via portal so it's not clipped by the scroll container's
  // overflow-y-auto. Position is computed from the row's bounding rect on hover.
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>, desc: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Prefer placing the tooltip above the row; flip below if there's no room
    const placeBelow = rect.top < 40;
    setTooltip({
      text: desc,
      x: rect.left,
      y: placeBelow ? rect.bottom + 4 : rect.top - 4,
      placeBelow,
    });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <>
      <div className="flex flex-col gap-1 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin">
        {patterns.length === 0 && (
          <div className="text-gray-600 text-xs text-center py-4">
            No patterns detected yet
          </div>
        )}
        {Array.from({ length: patterns.length }, (_, i) => {
          const p = patterns[patterns.length - 1 - i];
          const desc = PATTERN_DESCRIPTIONS[p.name];
          return (
            <div
              key={`${p.time}-${p.name}-${i}`}
              onMouseEnter={desc ? (e) => handleMouseEnter(e, desc) : undefined}
              onMouseLeave={desc ? handleMouseLeave : undefined}
              className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs ${colorClasses[p.color]}`}
            >
              <span className="text-gray-500 shrink-0 w-[72px]">{formatTime(p.time)}</span>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium truncate">{p.name}</span>
                {PATTERN_DESCRIPTIONS[p.name] && (
                  <span className="text-[10px] opacity-50 truncate">{PATTERN_DESCRIPTIONS[p.name]}</span>
                )}
              </div>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.color === 'green' ? 'bg-green-400' : p.color === 'red' ? 'bg-red-400' : 'bg-gray-400'} ${confidenceDots[p.confidence]}`}
                title={p.confidence}
              />
            </div>
          );
        })}
      </div>

      {tooltip && createPortal(
        <div
          className="pointer-events-none fixed z-[100]"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: tooltip.placeBelow ? 'none' : 'translateY(-100%)',
          }}
        >
          <div className="bg-[#1a1c28] border border-[#2e303a] rounded px-2 py-1 text-xs text-gray-300 whitespace-nowrap shadow-lg">
            {tooltip.text}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
