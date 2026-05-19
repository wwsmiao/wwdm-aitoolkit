'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

export interface LossPoint {
  step: number;
  wall_time?: number;
  value: number | null;
}

type SeriesMap = Record<string, LossPoint[]>;

export default function useJobLossLog(jobID: string, reloadInterval: null | number = null) {
  const [series, setSeries] = useState<SeriesMap>({});
  const [keys] = useState<string[]>(['loss']);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'refreshing'>('idle');
  const didInitialLoadRef = useRef(false);
  const inFlightRef = useRef(false);
  const lastStepRef = useRef<number | null>(null);

  const lossKeys = useMemo(() => ['loss'], []);

  const refreshLoss = useCallback(async () => {
    if (!jobID) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const loadStatus: 'loading' | 'refreshing' = didInitialLoadRef.current ? 'refreshing' : 'loading';
    setStatus(loadStatus);

    try {
      const params = new URLSearchParams();
      if (reloadInterval && lastStepRef.current != null) {
        params.set('since_step', String(lastStepRef.current));
      }
      const res = await fetch('/api/jobs/' + jobID + '/metrics' + (params.toString() ? '?' + params.toString() : ''));
      const data = await res.json();
      const metrics: { step: number; loss: number }[] = data.metrics ?? [];

      setSeries(prev => {
        const existing = prev['loss'] ?? [];
        if (!didInitialLoadRef.current) {
          const points: LossPoint[] = metrics.map(m => ({
            step: m.step,
            value: m.loss,
          }));
          return { loss: points };
        }
        // Filter new points
        const lastStep = lastStepRef.current;
        const newPoints: LossPoint[] = metrics
          .filter(m => lastStep == null || m.step > lastStep)
          .map(m => ({ step: m.step, value: m.loss }));
        return {
          loss: newPoints.length ? [...existing, ...newPoints] : existing,
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
  }, [jobID, reloadInterval]);

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

  return { series, keys, lossKeys, status, refreshLoss, setSeries };
}
