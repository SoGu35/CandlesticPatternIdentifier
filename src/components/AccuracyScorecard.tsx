import { useMemo, useState } from 'react';
import { useAccuracyScorecard, type AccuracyPoint } from '../hooks/useAccuracyScorecard';

const VIEW_W = 320;
const VIEW_H = 250;
const PAD_L = 38;
const PAD_R = 12;
const PAD_T = 18;
const PAD_B = 26;
const PLOT_W = VIEW_W - PAD_L - PAD_R;
const PLOT_H = VIEW_H - PAD_T - PAD_B;
const X_DOMAIN = 100; // ±100 alignment score

type ChartMode = 'rvol' | 'rr' | 'clean';

function formatET(unixSeconds: number): string {
  return new Date(unixSeconds * 1000)
    .toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(', ', ' ');
}

function sessionColor(min: number): string {
  if (min < 120) return '#60a5fa'; // blue-400  — early (9:30–11:30)
  if (min < 240) return '#fbbf24'; // amber-400 — midday (11:30–13:30)
  return '#f97316';                // orange-500 — late (13:30–16:00)
}

function rrColor(rr: number): string {
  if (rr >= 2) return '#2dd4bf';   // teal-400
  if (rr >= 1) return '#fbbf24';   // amber-400
  return '#f87171';                // red-400
}

// ── Shared helpers ──────────────────────────────────────────────────────────

const xToSvg = (score: number) =>
  PAD_L + ((score + X_DOMAIN) / (2 * X_DOMAIN)) * PLOT_W;

// ── Chart 1: RVOL vs Fakeouts ────────────────────────────────────────────────

const LOG_MIN = Math.log(0.2);
const LOG_MAX = Math.log(6);

function yToSvgRvol(v: number): number {
  const clamped = Math.max(0.2, Math.min(6, v));
  const norm = (Math.log(clamped) - LOG_MIN) / (LOG_MAX - LOG_MIN);
  return PAD_T + (1 - norm) * PLOT_H;
}

function RvolChart({ points, setHovered }: { points: AccuracyPoint[]; setHovered: (p: AccuracyPoint | null) => void }) {
  // Fakeout-rate strip: bucket RVOL into 5 quintiles
  const STRIP_H = 10;
  const stripBuckets = useMemo(() => {
    const sorted = [...points].sort((a, b) => a.rvol - b.rvol);
    const size = Math.ceil(sorted.length / 5);
    return Array.from({ length: 5 }, (_, i) => {
      const slice = sorted.slice(i * size, (i + 1) * size);
      if (slice.length === 0) return 0;
      return slice.filter((p) => p.isOutlier).length / slice.length;
    });
  }, [points]);

  const refY05 = yToSvgRvol(0.5);
  const refY2 = yToSvgRvol(2);

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H + STRIP_H}`} className="w-full" style={{ height: 'auto' }} onMouseLeave={() => setHovered(null)}>
      {/* Fakeout-rate strip */}
      {stripBuckets.map((rate, i) => (
        <rect
          key={i}
          x={PAD_L + (i / 5) * PLOT_W}
          y={2}
          width={PLOT_W / 5 - 1}
          height={STRIP_H - 2}
          fill={`rgba(248,113,113,${0.15 + rate * 0.75})`}
          rx="1"
        />
      ))}
      <text x={PAD_L - 2} y={8} fill="#4b5563" fontSize="7" textAnchor="end">fakeout%</text>

      {/* Plot area (offset by STRIP_H) */}
      <g transform={`translate(0,${STRIP_H})`}>
        {/* Quadrant tints: green = correct, red = fakeout */}
        <rect x={PAD_L} y={PAD_T} width={PLOT_W} height={PLOT_H} fill="none" stroke="#2e303a" strokeWidth="1" />

        {/* Reference lines */}
        <line x1={PAD_L} y1={refY05} x2={PAD_L + PLOT_W} y2={refY05} stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={PAD_L} y1={refY2} x2={PAD_L + PLOT_W} y2={refY2} stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={xToSvg(0)} y1={PAD_T} x2={xToSvg(0)} y2={PAD_T + PLOT_H} stroke="#3a3d4a" strokeWidth="1" strokeDasharray="2 3" />

        {/* Reference labels */}
        <text x={PAD_L - 3} y={refY05 + 3} fill="#4b5563" fontSize="8" textAnchor="end">0.5×</text>
        <text x={PAD_L - 3} y={refY2 + 3} fill="#4b5563" fontSize="8" textAnchor="end">2×</text>

        {/* Y axis labels */}
        <text x={PAD_L - 3} y={PAD_T + 4} fill="#6b7280" fontSize="8" textAnchor="end">6×</text>
        <text x={PAD_L - 3} y={PAD_T + PLOT_H} fill="#6b7280" fontSize="8" textAnchor="end">0.2×</text>

        {/* X axis */}
        <text x={PAD_L} y={VIEW_H - 10} fill="#6b7280" fontSize="9" textAnchor="start">−100</text>
        <text x={xToSvg(0)} y={VIEW_H - 10} fill="#6b7280" fontSize="9" textAnchor="middle">0</text>
        <text x={PAD_L + PLOT_W} y={VIEW_H - 10} fill="#6b7280" fontSize="9" textAnchor="end">+100</text>
        <text x={PAD_L + PLOT_W / 2} y={VIEW_H - 1} fill="#9ca3af" fontSize="9" textAnchor="middle">alignment score</text>

        {/* Data points */}
        {points.map((p, i) => {
          const cx = xToSvg(Math.max(-X_DOMAIN, Math.min(X_DOMAIN, p.score)));
          const cy = yToSvgRvol(p.rvol);
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={4}
              fill={p.isOutlier ? '#f87171' : '#4ade80'}
              fillOpacity={0.7}
              onMouseEnter={() => setHovered(p)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
      </g>
    </svg>
  );
}

// ── Chart 2: Risk / Reward ────────────────────────────────────────────────────

const RR_CAP = 5;

function yToSvgRR(v: number): number {
  return PAD_T + ((RR_CAP - Math.min(v, RR_CAP)) / RR_CAP) * PLOT_H;
}

function RRChart({ points, setHovered }: { points: AccuracyPoint[]; setHovered: (p: AccuracyPoint | null) => void }) {
  // Expectancy bar per score quartile
  const quartiles = useMemo(() => {
    const ranges = [[-100, -50], [-50, 0], [0, 50], [50, 100]] as [number, number][];
    return ranges.map(([lo, hi]) => {
      const bucket = points.filter((p) => p.score >= lo && p.score < hi && p.twoBarStopAdversePct > 0);
      if (bucket.length === 0) return null;
      const wins = bucket.filter((p) => !p.isOutlier);
      const losses = bucket.filter((p) => p.isOutlier);
      const winRate = wins.length / bucket.length;
      const avgRRWin = wins.length > 0
        ? wins.reduce((s, p) => s + p.peakMovePct / Math.max(p.twoBarStopAdversePct, 0.01), 0) / wins.length
        : 0;
      const avgRRLoss = losses.length > 0
        ? losses.reduce((s, p) => s + p.twoBarStopAdversePct / Math.max(p.peakMovePct, 0.01), 0) / losses.length
        : 0;
      const ev = winRate * avgRRWin - (1 - winRate) * avgRRLoss;
      return { lo, hi, ev };
    });
  }, [points]);

  const BAND_H = 8;
  const ref1 = yToSvgRR(1);
  const ref2 = yToSvgRR(2);

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H + BAND_H}`} className="w-full" style={{ height: 'auto' }} onMouseLeave={() => setHovered(null)}>
      {/* Expectancy band */}
      {quartiles.map((q, i) => {
        if (!q) return null;
        const bx = PAD_L + ((q.lo + 100) / 200) * PLOT_W;
        const bw = (50 / 200) * PLOT_W;
        const positive = q.ev > 0;
        return (
          <g key={i}>
            <rect
              x={bx} y={VIEW_H + BAND_H - BAND_H + 2}
              width={bw - 1} height={BAND_H - 2}
              fill={positive ? `rgba(74,222,128,${Math.min(0.8, 0.2 + Math.abs(q.ev) * 0.3)})` : `rgba(248,113,113,${Math.min(0.8, 0.2 + Math.abs(q.ev) * 0.3)})`}
              rx="1"
            />
            <text x={bx + bw / 2} y={VIEW_H + BAND_H - 1} fill="#6b7280" fontSize="7" textAnchor="middle">
              {q.ev > 0 ? '+' : ''}{q.ev.toFixed(1)}
            </text>
          </g>
        );
      })}
      <text x={PAD_L - 2} y={VIEW_H + BAND_H - 1} fill="#4b5563" fontSize="7" textAnchor="end">EV</text>

      <g>
        <rect x={PAD_L} y={PAD_T} width={PLOT_W} height={PLOT_H} fill="none" stroke="#2e303a" strokeWidth="1" />

        {/* Reference lines */}
        <line x1={PAD_L} y1={ref1} x2={PAD_L + PLOT_W} y2={ref1} stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={PAD_L} y1={ref2} x2={PAD_L + PLOT_W} y2={ref2} stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={xToSvg(0)} y1={PAD_T} x2={xToSvg(0)} y2={PAD_T + PLOT_H} stroke="#3a3d4a" strokeWidth="1" strokeDasharray="2 3" />

        <text x={PAD_L - 3} y={ref1 + 3} fill="#4b5563" fontSize="8" textAnchor="end">1×</text>
        <text x={PAD_L - 3} y={ref2 + 3} fill="#4b5563" fontSize="8" textAnchor="end">2×</text>

        {/* Y axis labels */}
        <text x={PAD_L - 3} y={PAD_T + 4} fill="#6b7280" fontSize="8" textAnchor="end">{RR_CAP}×</text>
        <text x={PAD_L - 3} y={PAD_T + PLOT_H} fill="#6b7280" fontSize="8" textAnchor="end">0×</text>

        {/* X axis */}
        <text x={PAD_L} y={VIEW_H - 10} fill="#6b7280" fontSize="9" textAnchor="start">−100</text>
        <text x={xToSvg(0)} y={VIEW_H - 10} fill="#6b7280" fontSize="9" textAnchor="middle">0</text>
        <text x={PAD_L + PLOT_W} y={VIEW_H - 10} fill="#6b7280" fontSize="9" textAnchor="end">+100</text>
        <text x={PAD_L + PLOT_W / 2} y={VIEW_H - 1} fill="#9ca3af" fontSize="9" textAnchor="middle">alignment score</text>

        {/* Data points */}
        {points.map((p, i) => {
          const cx = xToSvg(Math.max(-X_DOMAIN, Math.min(X_DOMAIN, p.score)));
          const rr = p.twoBarStopAdversePct > 0
            ? p.peakMovePct / p.twoBarStopAdversePct
            : RR_CAP;
          const cy = yToSvgRR(rr);
          const color = rrColor(rr);
          const r = 4;
          if (!p.twoBarStopHit) {
            // Open circle — stop never triggered
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                onMouseEnter={() => setHovered(p)}
                style={{ cursor: 'pointer' }}
              />
            );
          }
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill={color}
              fillOpacity={0.75}
              onMouseEnter={() => setHovered(p)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
      </g>
    </svg>
  );
}

// ── Chart 3: Follow-through Cleanness ────────────────────────────────────────

function yToSvgClean(v: number): number {
  return PAD_T + ((100 - Math.max(0, Math.min(100, v))) / 100) * PLOT_H;
}

function CleanChart({ points, setHovered }: { points: AccuracyPoint[]; setHovered: (p: AccuracyPoint | null) => void }) {
  const ref50 = yToSvgClean(50);
  const ref75 = yToSvgClean(75);

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full" style={{ height: 'auto' }} onMouseLeave={() => setHovered(null)}>
      <rect x={PAD_L} y={PAD_T} width={PLOT_W} height={PLOT_H} fill="none" stroke="#2e303a" strokeWidth="1" />

      {/* Green zone above 75% */}
      <rect x={PAD_L} y={PAD_T} width={PLOT_W} height={ref75 - PAD_T} fill="rgba(34,197,94,0.04)" />
      {/* Red zone below 50% */}
      <rect x={PAD_L} y={ref50} width={PLOT_W} height={PAD_T + PLOT_H - ref50} fill="rgba(239,68,68,0.04)" />

      {/* Reference lines */}
      <line x1={PAD_L} y1={ref50} x2={PAD_L + PLOT_W} y2={ref50} stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
      <line x1={PAD_L} y1={ref75} x2={PAD_L + PLOT_W} y2={ref75} stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
      <line x1={xToSvg(0)} y1={PAD_T} x2={xToSvg(0)} y2={PAD_T + PLOT_H} stroke="#3a3d4a" strokeWidth="1" strokeDasharray="2 3" />

      <text x={PAD_L - 3} y={ref50 + 3} fill="#4b5563" fontSize="8" textAnchor="end">50%</text>
      <text x={PAD_L - 3} y={ref75 + 3} fill="#4b5563" fontSize="8" textAnchor="end">75%</text>

      {/* Y axis labels */}
      <text x={PAD_L - 3} y={PAD_T + 4} fill="#6b7280" fontSize="8" textAnchor="end">100%</text>
      <text x={PAD_L - 3} y={PAD_T + PLOT_H} fill="#6b7280" fontSize="8" textAnchor="end">0%</text>

      {/* X axis */}
      <text x={PAD_L} y={VIEW_H - 10} fill="#6b7280" fontSize="9" textAnchor="start">−100</text>
      <text x={xToSvg(0)} y={VIEW_H - 10} fill="#6b7280" fontSize="9" textAnchor="middle">0</text>
      <text x={PAD_L + PLOT_W} y={VIEW_H - 10} fill="#6b7280" fontSize="9" textAnchor="end">+100</text>
      <text x={PAD_L + PLOT_W / 2} y={VIEW_H - 1} fill="#9ca3af" fontSize="9" textAnchor="middle">alignment score</text>

      {/* Data points — radius encodes time to peak (larger = faster peak, max 20min) */}
      {points.map((p, i) => {
        const cx = xToSvg(Math.max(-X_DOMAIN, Math.min(X_DOMAIN, p.score)));
        const cy = yToSvgClean(p.cleannessPct);
        const r = Math.max(2.5, 5.5 - (Math.min(p.timeTopeakMin, 40) / 40) * 3);
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill={sessionColor(p.sessionMinute)}
            fillOpacity={0.75}
            onMouseEnter={() => setHovered(p)}
            style={{ cursor: 'pointer' }}
          />
        );
      })}
    </svg>
  );
}

// ── Hover panel (unified, cross-chart) ───────────────────────────────────────

function rvolLabel(p: AccuracyPoint): string {
  const base = p.rvol < 0.75 ? 'Low RVOL' : p.rvol < 1.5 ? 'Avg RVOL' : 'High RVOL';
  return p.isOutlier ? `${base} + fakeout` : base;
}

function rrLabel(p: AccuracyPoint): string {
  const rr = p.twoBarStopAdversePct > 0
    ? p.peakMovePct / p.twoBarStopAdversePct
    : null;
  const tier = rr === null ? 'No stop hit' : rr >= 2 ? 'Ideal R:R' : rr >= 1 ? 'Decent R:R' : 'Poor R:R';
  const val = rr !== null ? ` ${rr.toFixed(1)}×` : '';
  return `${tier}${val}`;
}

function cleanLabel(p: AccuracyPoint): string {
  if (p.cleannessPct >= 75) return 'Clean';
  if (p.cleannessPct >= 50) return 'Mixed';
  return 'Choppy';
}

function computeEV(p: AccuracyPoint): number {
  const impliedWinRate = (p.score + 100) / 200;
  return impliedWinRate * p.peakMovePct - (1 - impliedWinRate) * p.twoBarStopAdversePct;
}

function HoverPanel({ p }: { p: AccuracyPoint }) {
  const ev = computeEV(p);
  const rr = p.twoBarStopAdversePct > 0 ? p.peakMovePct / p.twoBarStopAdversePct : null;

  return (
    <div className="bg-[#1a1c28] border border-[#2e303a] rounded px-2 py-1.5 text-gray-300 space-y-1">
      {/* Line 1: identity */}
      <div className="text-[11px]">
        <span className="text-gray-500">{formatET(p.time)}</span>
        <span className="font-medium ml-2">{p.patternName}</span>
        {p.isOutlier && <span className="text-red-400 ml-1">(fakeout)</span>}
      </div>

      {/* Line 2: cross-chart labels */}
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
        <span className={p.rvol < 0.75 ? 'text-red-400' : p.rvol < 1.5 ? 'text-gray-400' : 'text-green-400'}>
          {rvolLabel(p)}
        </span>
        <span className="text-gray-600">·</span>
        <span className={rr !== null && rr >= 2 ? 'text-teal-400' : rr !== null && rr >= 1 ? 'text-amber-400' : 'text-red-400'}>
          {rrLabel(p)}
        </span>
        <span className="text-gray-600">·</span>
        <span className={p.cleannessPct >= 75 ? 'text-green-400' : p.cleannessPct >= 50 ? 'text-amber-400' : 'text-red-400'}>
          {cleanLabel(p)}
        </span>
      </div>

      {/* Line 3: raw metrics */}
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
        <span>score <span className={p.score >= 0 ? 'text-green-400' : 'text-red-400'}>{p.score >= 0 ? '+' : ''}{p.score}</span></span>
        <span>rvol <span className="text-gray-300">{p.rvol.toFixed(2)}×</span></span>
        <span>peak <span className="text-blue-400">+{p.peakMovePct.toFixed(2)}%</span></span>
        <span>clean <span className="text-gray-300">{p.cleannessPct.toFixed(0)}%</span></span>
        <span>held <span className="text-gray-300">{p.alignmentDurationMin !== null ? `${p.alignmentDurationMin}m` : '>1h'}</span></span>
      </div>

      {/* Line 4: EV */}
      <div className="text-[10px] font-medium">
        <span className="text-gray-500">EV: </span>
        <span className={ev >= 0 ? 'text-green-400' : 'text-red-400'}>
          {ev >= 0 ? '+' : ''}{ev.toFixed(2)}
        </span>
        <span className="text-gray-600 ml-2 font-normal text-[9px]">implied {((p.score + 100) / 2).toFixed(0)}% win rate</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const CHART_TABS: { mode: ChartMode; label: string; title: string }[] = [
  { mode: 'rvol', label: 'RVOL', title: 'Does volume predict fakeouts?' },
  { mode: 'rr', label: 'R:R', title: 'Risk/reward with 2-candle stop' },
  { mode: 'clean', label: 'Clean', title: 'Is follow-through clean?' },
];

export function AccuracyScorecard() {
  const { points, loading, error, daysCovered, refresh } = useAccuracyScorecard(5);
  const [hovered, setHovered] = useState<AccuracyPoint | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('rvol');

  const stats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    for (const p of points) {
      if (p.score === 0 || p.pctChange === 0) continue;
      if (p.isOutlier) wrong += 1;
      else correct += 1;
    }
    const total = correct + wrong;
    return { correct, wrong, total, pct: total > 0 ? Math.round((correct / total) * 100) : 0 };
  }, [points]);

  const activeTab = CHART_TABS.find((t) => t.mode === chartMode)!;

  return (
    <div className="bg-[#12131a] rounded-lg border border-[#2e303a] p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-300">Accuracy Scorecard</h3>
            <button
              onClick={refresh}
              disabled={loading}
              title="Refresh scorecard"
              className="text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors leading-none"
            >
              ↻
            </button>
          </div>
          <div className="text-[10px] text-gray-500">
            {activeTab.title} · last {daysCovered || 5} sessions
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && stats.total > 0 && (
            <div className="text-right">
              <div className="text-lg font-mono text-amber-400">{stats.pct}%</div>
              <div className="text-[10px] text-gray-500">{stats.correct}/{stats.total}</div>
            </div>
          )}
        </div>
      </div>

      {/* Chart tabs */}
      {!loading && (
        <div className="flex rounded overflow-hidden border border-[#2e303a] text-[10px] mb-2">
          {CHART_TABS.map((t) => (
            <button
              key={t.mode}
              onClick={() => setChartMode(t.mode)}
              className={`flex-1 px-2 py-1 transition-colors ${
                chartMode === t.mode
                  ? 'bg-[#2e303a] text-gray-200'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-xs text-gray-500 text-center py-12">Loading 5 days of data…</div>
      )}
      {error && (
        <div className="text-xs text-red-400 text-center py-12">Error: {error}</div>
      )}

      {!loading && !error && (
        <>
          {chartMode === 'rvol' && <RvolChart points={points} setHovered={setHovered} />}
          {chartMode === 'rr' && <RRChart points={points} setHovered={setHovered} />}
          {chartMode === 'clean' && <CleanChart points={points} setHovered={setHovered} />}

          {/* Legend */}
          <div className="flex items-center justify-between text-[10px] mt-1">
            {chartMode === 'rvol' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> correct
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> fakeout
                </span>
              </div>
            )}
            {chartMode === 'rr' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> ≥2:1
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 1–2:1
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {'<'}1:1
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full ring-1 ring-teal-400 inline-block" /> no stop
                </span>
              </div>
            )}
            {chartMode === 'clean' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> early
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> midday
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> late
                </span>
                <span className="text-gray-500">size = time to peak</span>
              </div>
            )}
            <div className="text-gray-500">{points.length} triggers</div>
          </div>

          {/* Hover detail */}
          <div className="mt-2">
            {hovered ? (
              <HoverPanel p={hovered} />
            ) : (
              <div className="text-[11px] text-gray-600 italic">Hover a point for details</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
