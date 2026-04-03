interface Props {
  connected: boolean;
}

export function Header({ connected }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[#2e303a] bg-[#0f1117]">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-white">SPY Candlestick Analyzer</h1>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
          />
          <span className="text-xs text-gray-500">
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
      <div className="text-xs text-gray-600">
        Real-time pattern detection
      </div>
    </header>
  );
}
