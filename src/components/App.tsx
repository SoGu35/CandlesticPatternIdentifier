import { CandleContext } from '../store/candle-store';
import { useCandleData } from '../hooks/useWebSocket';
import { useAlerts } from '../hooks/useAlerts';
import { Header } from './Header';
import { ChartPanel } from './ChartPanel';
import { AlignmentChart } from './AlignmentChart';
import { AlignmentScore } from './AlignmentScore';

export function App() {
  const store = useCandleData();
  useAlerts(store.patterns, store.alignment);

  return (
    <CandleContext.Provider value={store}>
      <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
        <Header connected={store.connected} />

        <main className="p-4 space-y-4 max-w-[1800px] mx-auto">
          {/* Alignment section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <AlignmentChart alignment={store.alignment} />
            </div>
            <div>
              <AlignmentScore score={store.alignment.score} />
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
