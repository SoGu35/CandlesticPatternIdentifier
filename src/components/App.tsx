import { CandleContext } from '../store/candle-store';
import { useCandleData } from '../hooks/useWebSocket';
import { useAlerts } from '../hooks/useAlerts';
import { Header } from './Header';
import { ChartPanel } from './ChartPanel';
import { AlignmentChart } from './AlignmentChart';
import { AlignmentScore } from './AlignmentScore';
import { AccuracyScorecard } from './AccuracyScorecard';
import { isDataToday } from '../utils/format';

export function App() {
  const store = useCandleData();
  useAlerts(store.patterns, store.alignment);

  const latestBar = store.oneMin[store.oneMin.length - 1];
  const isStale = latestBar != null && !isDataToday(latestBar.time);

  return (
    <CandleContext.Provider value={store}>
      <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
        <Header connected={store.connected} />
        {isStale && (
          <div className="bg-amber-900/40 border-b border-amber-700/50 px-4 py-2 text-center text-xs text-amber-300">
            ⚠ Chart data is from a previous session — not today's market
          </div>
        )}

        <main className="p-4 space-y-4 max-w-[1800px] mx-auto">
          {/* Alignment section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <AlignmentChart alignment={store.alignment} />
            </div>
            <div className="space-y-4">
              <AlignmentScore score={store.alignment.score} />
              <AccuracyScorecard />
            </div>
          </div>

          {/* Chart panels */}
          <div className="space-y-4">
            <ChartPanel
              title="15 Minute"
              timeframe="15min"
              candles={store.fifteenMin}
              formingBar={null}
              patterns={store.patterns['15min']}
            />
            <ChartPanel
              title="5 Minute"
              timeframe="5min"
              candles={store.fiveMin}
              formingBar={null}
              patterns={store.patterns['5min']}
            />
            <ChartPanel
              title="1 Minute"
              timeframe="1min"
              candles={store.oneMin}
              formingBar={store.formingBar}
              patterns={store.patterns['1min']}
            />
          </div>
        </main>
      </div>
    </CandleContext.Provider>
  );
}
