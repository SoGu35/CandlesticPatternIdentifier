import type { Candle, PatternResult, Timeframe } from '../lib/patterns/types';
import { CandlestickChart } from './CandlestickChart';
import { PatternHistory } from './PatternHistory';

interface Props {
  title: string;
  timeframe: Timeframe;
  candles: Candle[];
  formingBar: Candle | null;
  patterns: PatternResult[];
}

export function ChartPanel({ title, candles, formingBar, patterns }: Props) {
  return (
    <div className="bg-[#12131a] rounded-lg border border-[#2e303a] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2e303a]">
        <h3 className="text-sm font-medium text-gray-300">{title}</h3>
        <span className="text-xs text-gray-500">{candles.length} bars</span>
      </div>
      <div className="flex">
        <div className="flex-1 min-w-0 overflow-hidden">
          <CandlestickChart candles={candles} formingBar={formingBar} height={280} />
        </div>
        <div className="w-[240px] border-l border-[#2e303a] p-2 shrink-0">
          <div className="text-xs text-gray-500 mb-2 font-medium">Pattern History</div>
          <PatternHistory patterns={patterns} />
        </div>
      </div>
    </div>
  );
}
