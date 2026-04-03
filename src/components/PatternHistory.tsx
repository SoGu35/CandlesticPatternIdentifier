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

const confidenceDots: Record<string, string> = {
  weak: 'opacity-30',
  moderate: 'opacity-60',
  strong: 'opacity-100',
};

export function PatternHistory({ patterns }: Props) {
  const reversed = [...patterns].reverse();

  return (
    <div className="flex flex-col gap-1 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin">
      {reversed.length === 0 && (
        <div className="text-gray-600 text-xs text-center py-4">
          No patterns detected yet
        </div>
      )}
      {reversed.map((p, i) => (
        <div
          key={`${p.time}-${p.name}-${i}`}
          className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs ${colorClasses[p.color]}`}
        >
          <span className="text-gray-500 shrink-0 w-[72px]">{formatTime(p.time)}</span>
          <span className="font-medium truncate flex-1">{p.name}</span>
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.color === 'green' ? 'bg-green-400' : p.color === 'red' ? 'bg-red-400' : 'bg-gray-400'} ${confidenceDots[p.confidence]}`}
            title={p.confidence}
          />
        </div>
      ))}
    </div>
  );
}
