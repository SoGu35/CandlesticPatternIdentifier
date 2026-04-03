import { formatScore } from '../utils/format';

interface Props {
  score: number;
}

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
        <span className="text-xs text-gray-500 uppercase tracking-wider">Alignment Score</span>
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
