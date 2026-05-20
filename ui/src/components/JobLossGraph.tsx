'use client';

import { Job } from '@prisma/client';
import useJobLossLog, { LossPoint, LossStats } from '@/hooks/useJobLossLog';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

interface Props {
  job: Job;
}

function formatNum(v: number) {
  if (!Number.isFinite(v)) return '';
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(3);
  if (Math.abs(v) >= 1) return v.toFixed(4);
  return v.toPrecision(4);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

const FALLBACK_CANVAS_HEIGHT = 360;
const MIN_CANVAS_HEIGHT = 160;

function computeCanvasSize(host: HTMLElement): { width: number; height: number } | null {
  const { width, height } = host.getBoundingClientRect();
  if (width <= 0 || height <= 0) return null;
  const legend = host.querySelector('.u-legend') as HTMLElement | null;
  const legendH = legend?.getBoundingClientRect().height ?? 0;
  return { width, height: Math.max(MIN_CANVAS_HEIGHT, height - legendH) };
}

function emaWithNulls(ys: (number | null)[], alpha: number): (number | null)[] {
  const out: (number | null)[] = new Array(ys.length);
  let prev: number | null = null;
  for (let i = 0; i < ys.length; i++) {
    const v = ys[i];
    if (v === null || !Number.isFinite(v)) { out[i] = null; continue; }
    if (prev === null) prev = v as number;
    else prev = alpha * (v as number) + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}

const PALETTE = [
  'rgba(96,165,250,1)',   // blue
  'rgba(52,211,153,1)',   // emerald
  'rgba(167,139,250,1)',  // purple
  'rgba(251,191,36,1)',   // amber
  'rgba(244,114,182,1)',  // pink
  'rgba(248,113,113,1)',  // red
  'rgba(34,211,238,1)',   // cyan
  'rgba(129,140,248,1)',  // indigo
];

function strokeForKey(key: string) {
  return PALETTE[0]; // single key, use first color
}

function dulledColor(rgba: string): string {
  const m = rgba.match(/rgba?\((\d+),(\d+),(\d+)/);
  if (!m) return 'rgba(120,120,120,1)';
  const r = Math.round(Number(m[1]) * 0.55);
  const g = Math.round(Number(m[2]) * 0.55);
  const b = Math.round(Number(m[3]) * 0.55);
  return "rgba(" + r + "," + g + "," + b + ",1)";
}

function ToggleButton({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1 rounded-md text-xs border transition-colors',
        checked
          ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/15'
          : 'bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800/60',
      ].join(' ')}
      aria-pressed={checked}
    >
      {label}
    </button>
  );
}

export default function JobLossGraph({ job }: Props) {
  const { series, lossKeys, status, refreshLoss, hasLr, stats } = useJobLossLog(job.id, 2000);

  const [useLogScale, setUseLogScale] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [showSmoothed, setShowSmoothed] = useState(true);
  const [smoothing, setSmoothing] = useState(80);
  const [plotStride, setPlotStride] = useState(1);
  const [clipOutliers, setClipOutliers] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setEnabled(prev => {
      const next = { ...prev };
      for (const k of lossKeys) {
        if (next[k] === undefined) next[k] = true;
      }
      for (const k of Object.keys(next)) {
        if (!lossKeys.includes(k)) delete next[k];
      }
      return next;
    });
  }, [lossKeys]);

  const activeKeys = useMemo(() => lossKeys.filter(k => enabled[k] !== false), [lossKeys, enabled]);

  const built = useMemo(() => {
    const stride = Math.max(1, plotStride | 0);
    const t = clamp01(smoothing / 100);
    const alpha = 1.0 - t * 0.98;
    const fullAlpha = 0.005;

    const stepSet = new Set<number>();
    for (const key of activeKeys) {
      const pts: LossPoint[] = series[key] ?? [];
      for (const p of pts) {
        if (p.value === null || !Number.isFinite(p.value as number)) continue;
        if (useLogScale && (p.value as number) <= 0) continue;
        stepSet.add(p.step);
      }
    }
    let xs = Array.from(stepSet).sort((a, b) => a - b);
    if (stride > 1) xs = xs.filter((_, i) => i % stride === 0);
    const xsSet = new Set(xs);

    const data: (number[] | (number | null)[])[] = [xs];
    const seriesConfigs: uPlot.Series[] = [{}];

    for (const key of activeKeys) {
      const pts: LossPoint[] = series[key] ?? [];
      const map = new Map<number, number>();
      for (const p of pts) {
        if (p.value === null || !Number.isFinite(p.value as number)) continue;
        if (useLogScale && (p.value as number) <= 0) continue;
        if (!xsSet.has(p.step)) continue;
        map.set(p.step, p.value as number);
      }
      const raw: (number | null)[] = xs.map(s => (map.has(s) ? (map.get(s) as number) : null));
      const smooth = emaWithNulls(raw, alpha);
      const fullSmooth = emaWithNulls(raw, fullAlpha);

      const color = strokeForKey(key);
      const colorFaded = color.replace('1)', '0.40)');
      const colorDull = dulledColor(color);

      if (showRaw) {
        data.push(raw);
        seriesConfigs.push({ label: key + ' (raw)', stroke: colorFaded, width: 1.25, spanGaps: false, points: { show: false } });
      }
      if (showSmoothed) {
        data.push(smooth);
        seriesConfigs.push({ label: key, stroke: color, width: 2, spanGaps: false, points: { show: false } });
      }
      data.push(fullSmooth);
      seriesConfigs.push({ label: key + ' (trend)', stroke: colorDull, width: 2.5, spanGaps: false, points: { show: false } });
    }

    let yClip: { min: number; max: number } | null = null;
    if (clipOutliers && xs.length >= 10) {
      const vals: number[] = [];
      for (let s = 1; s < data.length; s++) {
        const arr = data[s] as (number | null)[];
        for (const v of arr) { if (v !== null && Number.isFinite(v)) vals.push(v as number); }
      }
      if (vals.length >= 10) {
        vals.sort((a, b) => a - b);
        const lo = vals[Math.floor(vals.length * 0.02)];
        const hi = vals[Math.ceil(vals.length * 0.98) - 1];
        if (Number.isFinite(lo) && Number.isFinite(hi) && lo !== hi) yClip = { min: lo, max: hi };
      }
    }

    return { data: data as uPlot.AlignedData, seriesConfigs, yClip };
  }, [series, activeKeys, smoothing, plotStride, useLogScale, showRaw, showSmoothed, clipOutliers]);

  const chartHostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const yClipRef = useRef<{ min: number; max: number } | null>(null);

  useEffect(() => { yClipRef.current = built.yClip; }, [built.yClip]);

  const isZoomedRef = useRef(false);
  useEffect(() => { isZoomedRef.current = isZoomed; }, [isZoomed]);

  const hasData = (built.data[0]?.length ?? 0) > 1;
  const structuralKey = useMemo(
    () => activeKeys.join('|') + '|raw=' + showRaw + '|sm=' + showSmoothed + '|log=' + useLogScale + '|has=' + hasData,
    [activeKeys, showRaw, showSmoothed, useLogScale, hasData],
  );

  useEffect(() => {
    if (uplotRef.current) { uplotRef.current.destroy(); uplotRef.current = null; }
    if (!containerRef.current || !chartHostRef.current) return;
    if (!hasData) return;

    const host = chartHostRef.current;
    const rect = host.getBoundingClientRect();
    const initialHeight = rect.height > 0 ? Math.max(MIN_CANVAS_HEIGHT, rect.height - 40) : FALLBACK_CANVAS_HEIGHT;
    const opts: uPlot.Options = {
      width: rect.width || 800,
      height: initialHeight,
      padding: [12, 16, 0, 4],
      series: built.seriesConfigs,
      scales: {
        x: { time: false },
        y: { distr: useLogScale ? 3 : 1, range: (_u, dataMin, dataMax) => {
          const c = yClipRef.current;
          return c ? [c.min, c.max] : [dataMin, dataMax];
        }},
      },
      axes: [
        { stroke: 'rgba(255,255,255,0.55)', grid: { stroke: 'rgba(255,255,255,0.06)' }, ticks: { stroke: 'rgba(255,255,255,0.15)' } },
        { stroke: 'rgba(255,255,255,0.55)', grid: { stroke: 'rgba(255,255,255,0.06)' }, ticks: { stroke: 'rgba(255,255,255,0.15)' }, size: 60, values: (_u: uPlot, ticks: number[]) => ticks.map(tk => formatNum(tk)) },
      ],
      cursor: { drag: { x: true, y: false, setScale: true }, points: { size: 6 } },
      legend: { show: true },
      hooks: {
        setScale: [(u: uPlot, key: string) => {
          if (key !== 'x') return;
          const xs = u.data[0] as number[];
          if (!xs || !xs.length) return;
          const sx = u.scales.x;
          setIsZoomed(sx.min !== xs[0] || sx.max !== xs[xs.length - 1]);
        }],
      },
    };

    uplotRef.current = new uPlot(opts, built.data, containerRef.current);
    setIsZoomed(false);
    const fitted = computeCanvasSize(host);
    if (fitted) uplotRef.current.setSize(fitted);

    return () => { uplotRef.current?.destroy(); uplotRef.current = null; };
  }, [structuralKey, built, useLogScale]);

  useEffect(() => {
    const u = uplotRef.current;
    if (!u) return;
    if (isZoomedRef.current) { u.setData(built.data, false); u.redraw(true, true); }
    else { u.setData(built.data, true); }
  }, [built]);

  useEffect(() => {
    const el = chartHostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const u = uplotRef.current;
      if (!u) return;
      const fitted = computeCanvasSize(el);
      if (fitted) u.setSize(fitted);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasData]);

  const handleResetZoom = useCallback(() => {
    const u = uplotRef.current;
    if (!u) return;
    const xs = u.data[0] as number[];
    if (!xs || !xs.length) return;
    u.setScale('x', { min: xs[0], max: xs[xs.length - 1] });
  }, []);

  const totalPoints = built.data[0]?.length ?? 0;

  return (
    <div className="bg-gray-900 rounded-xl shadow-lg overflow-hidden border border-gray-800 flex flex-col h-full">
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-400" />
          <h2 className="text-gray-100 text-sm font-medium">Loss Graph</h2>
          <span className="text-xs text-gray-400">
            {status === 'loading' && 'Loading...'}
            {status === 'refreshing' && 'Refreshing...'}
            {status === 'error' && 'Error'}
            {status === 'success' && hasData && totalPoints.toLocaleString() + ' steps'}
            {status === 'success' && !hasData && 'No data yet'}
          </span>
        </div>
        <button type="button" onClick={refreshLoss} className="px-3 py-1 rounded-md text-xs bg-gray-700/60 hover:bg-gray-700 text-gray-200 border border-gray-700">
          Refresh
        </button>
      </div>

      <div className="px-4 pt-4 pb-4 flex-1 min-h-0 flex flex-col">
        <div className="bg-gray-950 rounded-lg border border-gray-800 relative select-none flex-1 min-h-0" style={{ minHeight: 240 }}>
          {!hasData ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
              {status === 'error' ? 'Failed to load loss logs.' : status === 'loading' ? 'Loading loss data...' : 'Training has not started yet. Loss data will appear here once training begins.'}
            </div>
          ) : (
            <>
              {isZoomed && (
                <button type="button" onClick={handleResetZoom} className="absolute top-2 right-2 z-10 px-2 py-1 rounded text-xs bg-blue-600/80 hover:bg-blue-600 text-white border border-blue-500/50">
                  Reset zoom
                </button>
              )}
              <div ref={chartHostRef} className="absolute top-0 left-0 right-0 bottom-2 overflow-hidden">
                <div ref={containerRef} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-4 pb-2 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
            <label className="block text-xs text-gray-400 mb-2">Display</label>
            <div className="flex flex-wrap gap-2">
              <ToggleButton checked={showSmoothed} onClick={() => setShowSmoothed(v => !v)} label="Smoothed" />
              <ToggleButton checked={showRaw} onClick={() => setShowRaw(v => !v)} label="Raw" />
              <ToggleButton checked={useLogScale} onClick={() => setUseLogScale(v => !v)} label="Log Y" />
              <ToggleButton checked={clipOutliers} onClick={() => setClipOutliers(v => !v)} label="Clip" />
            </div>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-gray-400">Smoothing</label>
              <span className="text-xs text-gray-300">{smoothing}%</span>
            </div>
            <input type="range" min={0} max={100} value={smoothing} onChange={e => setSmoothing(Number(e.target.value))} className="w-full accent-blue-500" disabled={!showSmoothed} />
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-gray-400">Stride</label>
              <span className="text-xs text-gray-300">every {plotStride}</span>
            </div>
            <input type="range" min={1} max={20} value={plotStride} onChange={e => setPlotStride(Number(e.target.value))} className="w-full accent-blue-500" />
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
            <label className="block text-xs text-gray-400 mb-2">Series</label>
            <div className="flex flex-wrap gap-2">
              {lossKeys.map(k => (
                <button key={k} type="button" onClick={() => setEnabled(prev => ({ ...prev, [k]: !(prev[k] ?? true) }))}
                  className={['px-3 py-1 rounded-md text-xs border transition-colors',
                    enabled[k] === false
                      ? 'bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800/60'
                      : 'bg-gray-900 text-gray-200 border-gray-800 hover:bg-gray-800/60'].join(' ')}>
                  <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ background: strokeForKey(k) }} />
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .uplot, .uplot * { font-family: inherit; }
        .uplot .u-legend { color: rgba(255, 255, 255, 0.85); font-size: 12px; margin-top: 4px; }
        .uplot .u-legend th, .uplot .u-legend td { color: rgba(255, 255, 255, 0.85); }
        .uplot .u-legend .u-marker { border-radius: 2px; }
        .uplot .u-select { background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); }
      `}</style>
    </div>
  );
}
