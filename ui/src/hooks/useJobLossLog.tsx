'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

export interface LossPoint {
  step: number;
  wall_time?: number;
  value: number | null;
}

type SeriesMap = Record<string, LossPoint[]>;

export interface LossStats {
  min: number;
  max: number;
  avg: number;
  last: number;
  count: number;
  firstStep: number;
  lastStep: number;
}

export default function useJobLossLog(jobID: string, reloadInterval: null | number = null) {
  const [series, setSeries] = useState<SeriesMap>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'refreshing'>('idle');
  const [hasLr, setHasLr] = useState(false);

  const didInitialLoadRef = useRef(false);
  const inFlightRef = useRef(false);
  const lastStepRef = useRef<number | null>(null);

  const lossKeys = useMemo(() => ['loss'], []);

  const stats: LossStats | null = useMemo(() => {
    const lossPoints = series['loss'] ?? [];
    if (lossPoints.length === 0) return null;
    const vals = lossPoints.filter(p => p.value !== null && Number.isFinite(p.value)).map(p => p.value as number);
    if (vals.length === 0) return null;
    vals.sort((a, b) => a - b);
    return {
      min: vals[0],
      max: vals[vals.length - 1],
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      last: (lossPoints.find(p => p.step === Math.max(...lossPoints.map(x => x.step)))?.value ?? lossPoints[lossPoints.length - 1].value) || 0,
      count: vals.length,
      firstStep: lossPoints[0].step,
      lastStep: lossPoints[lossPoints.length - 1].step,
    };
  }, [series]);

  const refreshLoss = useCallback(async () => {
    if (!jobID) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const loadStatus: 'loading' | 'refreshing' = didInitialLoadRef.current ? 'refreshing' : 'loading';
    setStatus(loadStatus);

    try {
      const res = await fetch('/api/jobs/' + jobID + '/metrics');
      const data = await res.json();
      const metrics: { step: number; loss: number; lr?: number }[] = data.metrics ?? [];

      setHasLr(data.hasLr === true && metrics.some((m: { lr?: number }) => m.lr !== undefined));

      setSeries(prev => {
        const existing = prev['loss'] ?? [];
        const existingLr = prev['loss/lr'] ?? [];

        if (!didInitialLoadRef.current) {
          const points: LossPoint[] = metrics.map(m => ({ step: m.step, value: m.loss }));
          const lrPoints: LossPoint[] = metrics
            .filter(m => m.lr !== undefined)
            .map(m => ({ step: m.step, value: m.lr! }));
          return { loss: points, ...(lrPoints.length ? { 'loss/lr': lrPoints } : {}) };
        }

        const lastStep = lastStepRef.current;
        const newPoints: LossPoint[] = metrics
          .filter(m => lastStep == null || m.step > lastStep)
          .map(m => ({ step: m.step, value: m.loss }));
        const newLrPoints: LossPoint[] = metrics
          .filter(m => lastStep == null || m.step > lastStep)
          .filter(m => m.lr !== undefined)
          .map(m => ({ step: m.step, value: m.lr! }));

        return {
          loss: newPoints.length ? [...existing, ...newPoints] : existing,
          'loss/lr': newLrPoints.length ? [...existingLr, ...newLrPoints] : existingLr,
        };
      });

      if (metrics.length > 0) {
        lastStepRef.current = metrics[metrics.length - 1].step;
      }
      setStatus('success');
      didInitialLoadRef.current = true;
    } catch (err) {
      console.error('Error fetching loss logs:', err);
      setStatus('error');
    } finally {
      inFlightRef.current = false;
    }
  }, [jobID]);

  useEffect(() => {
    didInitialLoadRef.current = false;
    lastStepRef.current = null;
    setSeries({});
    setStatus('idle');
    refreshLoss();

    if (reloadInterval) {
      const interval = setInterval(refreshLoss, reloadInterval);
      return () => clearInterval(interval);
    }
  }, [jobID, reloadInterval, refreshLoss]);

  return { series, keys: lossKeys, lossKeys, status, refreshLoss, setSeries, hasLr, stats };
}
