import { Job } from '@prisma/client';
import useGPUInfo from '@/hooks/useGPUInfo';
import useCPUInfo from '@/hooks/useCPUInfo';
import GPUWidget from '@/components/GPUWidget';
import CPUWidget from '@/components/CPUWidget';
import { getTotalSteps } from '@/utils/jobs';
import { Cpu, HardDrive, Info, Gauge, Hash, Clock, Circle, AlertTriangle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import useJobLog from '@/hooks/useJobLog';

interface JobOverviewProps {
  job: Job;
}

function statusConfig(status: string) {
  switch (status.toLowerCase()) {
    case 'running': return { bg: 'bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-400' };
    case 'stopping': return { bg: 'bg-amber-500/10 text-amber-400', dot: 'bg-amber-400' };
    case 'completed': return { bg: 'bg-blue-500/10 text-blue-400', dot: 'bg-blue-400' };
    case 'error': return { bg: 'bg-rose-500/10 text-rose-400', dot: 'bg-rose-400' };
    case 'stopped': return { bg: 'bg-gray-500/10 text-gray-400', dot: 'bg-gray-400' };
    default: return { bg: 'bg-gray-500/10 text-gray-400', dot: 'bg-gray-400' };
  }
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-gray-500 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-200 truncate">{value}</p>
      </div>
    </div>
  );
}

export default function JobOverview({ job }: JobOverviewProps) {
  const gpuIds = useMemo(() => {
    if (job.gpu_ids === 'mps') return [0];
    return job.gpu_ids.split(',').map(id => parseInt(id));
  }, [job.gpu_ids]);

  const { log, status: statusLog, refresh: refreshLog } = useJobLog(job.id, 2000);
  const logRef = useRef<HTMLDivElement>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);

  const { gpuList, isGPUInfoLoaded } = useGPUInfo(gpuIds, 5000);
  const { cpuInfo, isCPUInfoLoaded } = useCPUInfo(5000);

  const totalSteps = getTotalSteps(job);
  const progress = totalSteps > 0 ? (job.step / totalSteps) * 100 : 0;
  const isStopping = job.stop && job.status === 'running';
  const displayStatus = isStopping ? 'stopping' : job.status;
  const sc = statusConfig(displayStatus);

  const logLines: string[] = useMemo(() => {
    const splits = log.split(/\n|\r\n/).map(line => line.split(/\r/).pop() || '');
    return splits.length > 1000 ? splits.slice(splits.length - 1000) : splits;
  }, [log]);

  // Detect error lines in the log
  const hasErrors = useMemo(() => {
    return logLines.some(line =>
      /error|traceback|exception|failed/i.test(line) && !/warning/i.test(line)
    );
  }, [logLines]);

  const handleScroll = () => {
    if (logRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logRef.current;
      setIsScrolledToBottom(scrollHeight - scrollTop - clientHeight < 10);
    }
  };

  useEffect(() => {
    if (logRef.current && isScrolledToBottom) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log, isScrolledToBottom]);

  const errorLines = useMemo(() =>
    logLines.filter(line =>
      /error|traceback|exception|failed/i.test(line) && !/warning/i.test(line)
    ),
    [logLines]
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-3">
      {/* Main Panel: Info + Log */}
      <div className="md:col-span-2 bg-gray-900 rounded-xl shadow-lg border border-gray-800 flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
            <h2 className="text-sm font-semibold text-gray-200">{job.info || job.name}</h2>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.bg} capitalize`}>
            {displayStatus}
          </span>
        </div>

        <div className="p-4 space-y-4 flex flex-col flex-grow">
          {/* Progress Bar (training only) */}
          {job.job_type === 'train' && totalSteps > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Progress</span>
                <span className="text-gray-200">{job.step.toLocaleString()} / {totalSteps.toLocaleString()} steps</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="h-2 rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
              </div>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <InfoItem icon={HardDrive} label="Job Name" value={job.name} />
            <InfoItem icon={Cpu} label="GPU" value={job.gpu_ids === 'mps' ? 'Apple MPS' : job.gpu_ids} />
            <InfoItem icon={Gauge} label="Speed" value={job.speed_string || '?'} />
          </div>

          {/* Error Banner */}
          {displayStatus === 'error' && errorLines.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-rose-400 mb-1">Training Error</p>
                  <pre className="text-xs text-rose-300/80 whitespace-pre-wrap break-all font-mono">
                    {errorLines.slice(0, 5).join('\n')}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Training Log */}
          <div className="bg-gray-950 rounded-lg relative flex-grow min-h-[200px]">
            <div className="absolute top-0 left-0 right-0 bg-gray-900/80 px-3 py-1.5 flex items-center justify-between border-b border-gray-800 z-10">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Training Log</span>
                {statusLog === 'refreshing' && (
                  <span className="text-[10px] text-blue-400 animate-pulse">updating...</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isScrolledToBottom && (
                  <button
                    onClick={() => { if (logRef.current) { logRef.current.scrollTop = logRef.current.scrollHeight; setIsScrolledToBottom(true); } }}
                    className="text-[10px] text-blue-400 hover:text-blue-300"
                  >
                    jump to bottom
                  </button>
                )}
                {hasErrors && (
                  <span className="text-[10px] text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    errors
                  </span>
                )}
              </div>
            </div>
            <div
              ref={logRef}
              className="text-xs text-gray-300 absolute inset-0 pt-8 pb-2 px-3 overflow-y-auto font-mono"
              onScroll={handleScroll}
            >
              {statusLog === 'loading' && <span className="text-gray-500">Loading log...</span>}
              {statusLog === 'error' && <span className="text-rose-400">Error loading log</span>}
              {['success', 'refreshing'].includes(statusLog) && logLines.length === 0 && (
                <span className="text-gray-500">No log output yet</span>
              )}
              {['success', 'refreshing'].includes(statusLog) && logLines.map((line, index) => {
                const isError = /error|traceback|exception|failed/i.test(line) && !/warning/i.test(line);
                return (
                  <pre key={index} className={isError ? 'text-rose-400' : ''}>
                    {line}
                  </pre>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Side Panel: GPU / CPU */}
      <div className="md:col-span-1 space-y-4">
        {isCPUInfoLoaded && cpuInfo && <CPUWidget cpu={cpuInfo} />}
        {isGPUInfoLoaded && gpuList.length > 0 && <GPUWidget gpu={gpuList[0]} />}
      </div>
    </div>
  );
}
