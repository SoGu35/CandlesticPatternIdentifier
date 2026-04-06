import { Link } from 'react-router-dom';

interface Props {
  connected?: boolean;
  practiceMode?: boolean;
  practiceDate?: string;
}

export function Header({ connected, practiceMode, practiceDate }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[#2e303a] bg-[#0f1117]">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-white">SPY Candlestick Analyzer</h1>
        {practiceMode ? (
          <span className="text-xs text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded">
            Practice{practiceDate ? ` · ${practiceDate}` : ''}
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
            />
            <span className="text-xs text-gray-500">
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        {practiceMode ? (
          <Link
            to="/"
            className="text-xs text-gray-400 hover:text-white border border-[#2e303a] hover:border-gray-500 px-3 py-1 rounded transition-colors"
          >
            ← Home
          </Link>
        ) : (
          <Link
            to="/practice"
            className="text-xs text-amber-400 hover:text-amber-300 border border-amber-400/30 hover:border-amber-400/60 px-3 py-1 rounded transition-colors"
          >
            Practice Mode
          </Link>
        )}
        <div className="text-xs text-gray-600">
          Real-time pattern detection
        </div>
      </div>
    </header>
  );
}
