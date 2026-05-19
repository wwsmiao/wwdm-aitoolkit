'use client';

import LossChart from '@/components/LossChart';
import { Job } from '@prisma/client';

interface LossViewProps {
  job: Job;
}

export default function LossView({ job }: LossViewProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
        <h2 className="text-lg font-semibold text-gray-100">Loss 训练曲线</h2>
      </div>
      <p className="text-sm text-gray-400 -mt-3 mb-4">
        实时显示训练过程中 loss 值的变化趋势，每 5 秒自动刷新。
      </p>
      <LossChart jobId={job.id} />
    </div>
  );
}
