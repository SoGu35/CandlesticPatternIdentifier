import type { AlignmentState } from '../lib/patterns/types';
import { formatTime } from '../utils/format';

interface Props {
  alignment: AlignmentState;
}

const colorClasses: Record<string, string> = {
  green: 'text-green-400',
  red: 'text-red-400',
  gray: 'text-gray-400',
};

const bgClasses: Record<string, string> = {
  green: 'bg-green-500/20',
  red: 'bg-red-500/20',
  gray: 'bg-gray-500/20',
};

export function AlignmentChart({ alignment }: Props) {
  if (!alignment.primaryPattern) {
    return (
      <div className="bg-[#12131a] rounded-lg border border-[#2e303a] p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Timeframe Alignment</h3>
        <div className="text-gray-600 text-xs text-center py-6">
          Waiting for 15min pattern to trigger alignment analysis...
        </div>
      </div>
    );
  }

  const { primaryPattern, lookbackMinutes, entries } = alignment;

  return (
    <div className="bg-[#12131a] rounded-lg border border-[#2e303a] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Timeframe Alignment</h3>
        <span className="text-xs text-gray-500">
          Lookback: {lookbackMinutes}min
        </span>
      </div>

      {/* Primary pattern trigger */}
      <div className={`rounded px-3 py-2 mb-3 border border-[#2e303a] ${bgClasses[primaryPattern.color]}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${colorClasses[primaryPattern.color]}`}>
            {primaryPattern.name}
          </span>
          <span className="text-xs text-gray-500">15min trigger</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {formatTime(primaryPattern.time)} &middot; {primaryPattern.confidence} confidence
        </div>
      </div>

      {/* Timeframe breakdown */}
      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.timeframe}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-400">{entry.timeframe}</span>
              <span className="text-xs text-gray-600">({entry.patterns.length} patterns)</span>
            </div>
            {entry.patterns.length === 0 ? (
              <div className="text-xs text-gray-700 pl-2">No patterns in window</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {entry.patterns.map((p, i) => (
                  <span
                    key={`${p.time}-${p.name}-${i}`}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${bgClasses[p.color]} ${colorClasses[p.color]}`}
                    title={`${formatTime(p.time)} - ${p.confidence}`}
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
