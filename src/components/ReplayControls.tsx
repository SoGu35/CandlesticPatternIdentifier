import type { PracticeReplayControls } from '../hooks/usePracticeReplay';
import { SPEED_LEVELS } from '../hooks/usePracticeReplay';

interface Props {
  controls: PracticeReplayControls;
}

export function ReplayControls({ controls }: Props) {
  const {
    state, speedIndex, speed, currentBar, totalBars,
    play, pause, speedUp, slowDown, skipForward, skipBackward, reload,
  } = controls;

  const isPlaying = state === 'playing';
  const isLoading = state === 'loading';
  const canInteract = state === 'playing' || state === 'paused' || state === 'done';
  const progressPct = totalBars > 0 ? (currentBar / totalBars) * 100 : 0;

  const btnBase = 'rounded bg-[#1e2030] hover:bg-[#2a2d3e] text-sm text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const smallBtn = 'rounded bg-[#1e2030] hover:bg-[#2a2d3e] text-xs text-gray-300 px-2.5 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="px-6 py-3 border-b border-[#2e303a] bg-[#0f1117] flex items-center gap-3 flex-wrap">
      {/* Play / Pause */}
      <button
        onClick={isPlaying ? pause : play}
        disabled={!canInteract || state === 'done'}
        className={`${btnBase} px-4 py-1.5 min-w-[72px]`}
      >
        {isLoading ? (
          <span className="animate-pulse">Loading…</span>
        ) : isPlaying ? (
          'Pause'
        ) : state === 'done' ? (
          'Done'
        ) : (
          'Play'
        )}
      </button>

      {/* Speed controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={slowDown}
          disabled={!canInteract || speedIndex === 0}
          className={`${smallBtn} w-7 text-center`}
          title="Slow down"
        >
          −
        </button>
        <span className="text-sm text-amber-400 font-mono w-14 text-center select-none">
          {speed}x
        </span>
        <button
          onClick={speedUp}
          disabled={!canInteract || speedIndex === SPEED_LEVELS.length - 1}
          className={`${smallBtn} w-7 text-center`}
          title="Speed up"
        >
          +
        </button>
      </div>

      {/* Skip controls */}
      <button
        onClick={skipBackward}
        disabled={!canInteract || currentBar === 0}
        className={smallBtn}
        title="Skip back 10 minutes"
      >
        −10min
      </button>
      <button
        onClick={skipForward}
        disabled={!canInteract || currentBar >= totalBars}
        className={smallBtn}
        title="Skip forward 10 minutes"
      >
        +10min
      </button>

      {/* Progress bar */}
      <div className="flex-1 min-w-[80px] h-1.5 bg-[#1e2030] rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-150"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Bar counter */}
      <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
        {currentBar}/{totalBars}
      </span>

      {/* New Day */}
      <button
        onClick={reload}
        disabled={isLoading}
        className="rounded border border-[#2e303a] hover:border-gray-500 text-xs text-gray-400 hover:text-white px-3 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        New Day
      </button>
    </div>
  );
}
