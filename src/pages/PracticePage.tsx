import { CandleContext } from '../store/candle-store';
import { usePracticeReplay } from '../hooks/usePracticeReplay';
import { Header } from '../components/Header';
import { ReplayControls } from '../components/ReplayControls';
import { ChartPanel } from '../components/ChartPanel';
import { AlignmentChart } from '../components/AlignmentChart';
import { AlignmentScore } from '../components/AlignmentScore';

export function PracticePage() {
  const [store, controls] = usePracticeReplay();

  return (
    <CandleContext.Provider value={store}>
      <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
        <Header practiceMode={true} practiceDate={controls.tradingDate} />
        <ReplayControls controls={controls} />

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
              formingBar={null}
              patterns={store.patterns['1min']}
            />
          </div>
        </main>
      </div>
    </CandleContext.Provider>
  );
}
