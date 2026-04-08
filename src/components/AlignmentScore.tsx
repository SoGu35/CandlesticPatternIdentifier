import { formatScore } from '../utils/format';

interface Props {
  score: number;
}

const TOOLTIP_TEXT = [
  {
    heading: 'What it measures',
    body: 'How strongly the 1min and 5min patterns confirm the most recent 15min trigger pattern. A snapshot is taken the moment the 15min candle closes — only patterns within that candle\'s lookback window count.',
  },
  {
    heading: 'How it\'s calculated',
    body: 'Each pattern is weighted by timeframe (15min = 3×, 5min = 2×, 1min = 1×) and confidence (weak = 0.5×, moderate = 1×, strong = 1.5×). Bullish signals add weight, bearish signals subtract. The sum is normalised to −100 → +100.',
  },
  {
    heading: 'How each vote is weighted',
    body: null,
    weightTable: [
      { factor: 'Timeframe', values: '15min = 3×  ·  5min = 2×  ·  1min = 1×' },
      { factor: 'Confidence', values: 'strong = 1.5×  ·  moderate = 1×  ·  weak = 0.5×' },
      { factor: 'Direction', values: 'bullish = +1  ·  bearish = −1  ·  neutral = 0' },
    ],
  },
  {
    heading: 'What the number means',
    body: null,
    table: [
      { range: '+70 to +100', label: 'Strong Bullish', color: 'text-green-400' },
      { range: '+30 to +70', label: 'Bullish', color: 'text-green-400' },
      { range: '−30 to +30', label: 'Neutral — mixed signals', color: 'text-gray-400' },
      { range: '−30 to −70', label: 'Bearish', color: 'text-red-400' },
      { range: '−70 to −100', label: 'Strong Bearish', color: 'text-red-400' },
    ],
  },
];

export function AlignmentScore({ score }: Props) {
  const absScore = Math.abs(score);
  let bgColor = 'bg-gray-800';
  let textColor = 'text-gray-400';
  let label = 'Neutral';

  if (score > 30) {
    bgColor = 'bg-green-500/20';
    textColor = 'text-green-400';
    label = absScore >= 70 ? 'Strong Bullish' : 'Bullish';
  } else if (score < -30) {
    bgColor = 'bg-red-500/20';
    textColor = 'text-red-400';
    label = absScore >= 70 ? 'Strong Bearish' : 'Bearish';
  }

  // Bar width for visual gauge
  const barWidth = Math.min(absScore, 100);
  const barColor = score > 0 ? 'bg-green-500' : score < 0 ? 'bg-red-500' : 'bg-gray-600';

  return (
    <div className={`rounded-lg border border-[#2e303a] p-4 ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Alignment Score</span>
          {/* Info tooltip */}
          <div className="relative group">
            <button
              className="w-4 h-4 rounded-full border border-gray-600 text-gray-500 hover:text-gray-300 hover:border-gray-400 text-[10px] font-bold leading-none flex items-center justify-center transition-colors cursor-default"
              tabIndex={-1}
              aria-label="Alignment score explanation"
            >
              ?
            </button>
            <div className="absolute right-0 top-full mt-2 z-50 w-72 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
              <div className="bg-[#1a1c28] border border-[#2e303a] rounded-lg shadow-xl p-3 space-y-3 text-left">
                {TOOLTIP_TEXT.map(({ heading, body, table, weightTable }) => (
                  <div key={heading}>
                    <div className="text-xs font-semibold text-gray-300 mb-1">{heading}</div>
                    {body && <p className="text-xs text-gray-400 leading-relaxed">{body}</p>}
                    {weightTable && (
                      <div className="space-y-1 mt-1">
                        {weightTable.map(({ factor, values }) => (
                          <div key={factor}>
                            <span className="text-xs text-gray-500">{factor}: </span>
                            <span className="text-xs text-gray-300 font-mono">{values}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {table && (
                      <div className="space-y-0.5 mt-1">
                        {table.map(({ range, label: tLabel, color }) => (
                          <div key={range} className="flex justify-between text-xs">
                            <span className="text-gray-500 font-mono">{range}</span>
                            <span className={color}>{tLabel}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Arrow */}
              <div className="absolute right-1.5 bottom-full -mb-px w-2 h-2 rotate-45 bg-[#1a1c28] border-l border-t border-[#2e303a]" />
            </div>
          </div>
        </div>
        <span className={`text-2xl font-bold ${textColor}`}>{formatScore(score)}</span>
      </div>
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className="h-2 bg-[#1e2030] rounded-full overflow-hidden relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-px h-full bg-gray-600" />
        </div>
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{
            width: `${barWidth / 2}%`,
            marginLeft: score >= 0 ? '50%' : `${50 - barWidth / 2}%`,
          }}
        />
      </div>
    </div>
  );
}
