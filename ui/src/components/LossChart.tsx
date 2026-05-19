'use client';

import { useEffect, useState, useRef } from 'react';
import { TrendingDown } from 'lucide-react';

interface MetricsPoint {
  step: number;
  loss: number;
}

interface LossChartProps {
  jobId: string;
}

export default function LossChart({ jobId }: LossChartProps) {
  const [metrics, setMetrics] = useState<MetricsPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ w: 500, h: 200 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/jobs/' + jobId + '/metrics');
        const data = await res.json();
        if (data.metrics && data.metrics.length > 0) {
          setMetrics(data.metrics);
        }
      } catch (e) {
        console.error('Failed to fetch metrics:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    // Poll every 5 seconds during training
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [jobId]);

  // Responsive resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ w: Math.max(200, rect.width - 4), h: 200 });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-700/60 p-4 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-24 mb-4" />
        <div className="h-[200px] bg-gray-800/50 rounded" />
      </div>
    );
  }

  if (metrics.length === 0) {
    return null; // Hide if no data
  }

  const { w, h } = dimensions;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const steps = metrics.map(m => m.step);
  const losses = metrics.map(m => m.loss);
  const minStep = steps[0];
  const maxStep = steps[steps.length - 1];
  const minLoss = Math.min(...losses) * 0.95;
  const maxLoss = Math.max(...losses) * 1.05;

  const xScale = (step: number) => padding.left + ((step - minStep) / (maxStep - minStep || 1)) * chartW;
  const yScale = (loss: number) => padding.top + chartH - ((loss - minLoss) / (maxLoss - minLoss || 1)) * chartH;

  // Build SVG path
  const pathD = metrics.map((m, i) => {
    const x = xScale(m.step);
    const y = yScale(m.loss);
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ');

  // Y-axis ticks (4 ticks)
  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) {
    yTicks.push(minLoss + (maxLoss - minLoss) * (i / 4));
  }

  // Latest values
  const latest = metrics[metrics.length - 1];
  const first = metrics[0];
  const lossDiff = first.loss - latest.loss;
  const lossPct = first.loss > 0 ? ((lossDiff / first.loss) * 100).toFixed(1) : '0';

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-700/60 p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
          <h3 className="text-sm font-semibold text-gray-200">Loss 曲线</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">
            <span className="text-gray-300">{losses.length}</span> 采样点
          </span>
          {lossDiff > 0 && (
            <span className="text-green-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              下降 {lossPct}%
            </span>
          )}
        </div>
      </div>

      {/* Latest value badge */}
      <div className="flex items-center gap-3 mb-3 text-xs">
        <div className="px-2.5 py-1 rounded-md bg-blue-600/10 border border-blue-600/20">
          <span className="text-gray-500 mr-1">当前 Loss</span>
          <span className="text-blue-300 font-semibold">{latest.loss.toFixed(6)}</span>
        </div>
        <div className="px-2.5 py-1 rounded-md bg-gray-800/50 border border-gray-700/40">
          <span className="text-gray-500 mr-1">Step</span>
          <span className="text-gray-200 font-semibold">{latest.step}</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div ref={containerRef} className="w-full" style={{ height: h }}>
        {w > 100 && (
          <svg width={w} height={h} className="overflow-visible">
            {/* Grid lines (horizontal) */}
            {yTicks.map((val, i) => (
              <g key={i}>
                <line
                  x1={padding.left} y1={yScale(val)}
                  x2={w - padding.right} y2={yScale(val)}
                  stroke="rgb(55, 65, 81)" strokeWidth="1" strokeDasharray="3,3"
                />
                <text
                  x={padding.left - 6} y={yScale(val) + 4}
                  textAnchor="end" fill="rgb(107, 114, 128)" fontSize="10"
                >
                  {val.toFixed(4)}
                </text>
              </g>
            ))}

            {/* X-axis labels (start, middle, end) */}
            {[steps[0], steps[Math.floor(steps.length / 2)], steps[steps.length - 1]].map((val, i) => (
              <text
                key={i}
                x={xScale(val)} y={h - 6}
                textAnchor="middle" fill="rgb(107, 114, 128)" fontSize="10"
              >
                {val}
              </text>
            ))}

            {/* X-axis label */}
            <text x={padding.left + chartW / 2} y={h - 2} textAnchor="middle" fill="rgb(75, 85, 99)" fontSize="10">
              Step
            </text>

            {/* Area fill */}
            <defs>
              <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path
              d={pathD + ' L' + xScale(maxStep).toFixed(1) + ' ' + (padding.top + chartH) + ' L' + xScale(minStep).toFixed(1) + ' ' + (padding.top + chartH) + ' Z'}
              fill="url(#lossGradient)"
            />

            {/* Loss line */}
            <path
              d={pathD}
              fill="none" stroke="rgb(59, 130, 246)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />

            {/* Data dots (show fewer for performance) */}
            {metrics.filter((_, i) => i % Math.max(1, Math.floor(metrics.length / 50)) === 0).map((m, i) => (
              <circle key={i} cx={xScale(m.step)} cy={yScale(m.loss)} r="1.5" fill="rgb(96, 165, 250)" />
            ))}

            {/* Last point highlight */}
            <circle cx={xScale(latest.step)} cy={yScale(latest.loss)} r="3" fill="rgb(59, 130, 246)" stroke="rgb(30, 41, 59)" strokeWidth="2" />
          </svg>
        )}
      </div>
    </div>
  );
}
