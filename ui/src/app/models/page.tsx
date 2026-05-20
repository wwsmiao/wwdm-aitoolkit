'use client';

import { useState, useEffect } from 'react';
import { TopBar, MainContent } from '@/components/layout';
import Link from 'next/link';
import { Download, FolderOpen, Clock, HardDrive, Hash, FlaskConical, Puzzle } from 'lucide-react';

interface ModelInfo {
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  modified: string;
  jobName: string;
  steps: string;
  ext: string;
  modelType: 'lora' | 'adapter';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/models/list')
      .then(res => res.json())
      .then(data => {
        setModels(data.models || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load models:', err);
        setError('Failed to load models');
        setLoading(false);
      });
  }, []);

  const getDownloadUrl = (model: ModelInfo) => {
    return '/api/files/' + encodeURIComponent(model.path);
  };

  return (
    <>
      <TopBar>
        <div>
          <h1 className="text-lg">Model Management</h1>
        </div>
        <div className="flex-1"></div>
      </TopBar>
      <MainContent>
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-400">Loading models...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && models.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <HardDrive className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg">No models found</p>
            <p className="text-sm mt-1">
              Trained models will appear here after training completes
            </p>
          </div>
        )}

        {!loading && models.length > 0 && (
          <>
            <div className="text-xs text-gray-500 mb-3">
              {models.length} model{models.length !== 1 ? 's' : ''} found
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-800/50 text-xs text-gray-400 font-medium uppercase tracking-wider">
                <div className="col-span-4">Model Name</div>
                <div className="col-span-2">Job / Source</div>
                <div className="col-span-2">Size</div>
                <div className="col-span-1">Steps</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-1 text-right">Download</div>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-gray-800/50">
                {models.map((model, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-800/30 transition-colors"
                  >
                    {/* Name */}
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <div className={'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ' + (model.modelType === 'lora' ? 'bg-purple-500/10' : 'bg-cyan-500/10')}>
                        {model.modelType === 'lora' ? <FlaskConical className="w-4 h-4 text-purple-400" /> : <Puzzle className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm text-gray-200 truncate block" title={model.name}>
                          {model.name}
                        </span>
                        <span className={'text-[10px] uppercase tracking-wider ' + (model.modelType === 'lora' ? 'text-purple-400' : 'text-cyan-400')}>
                          {model.modelType === 'lora' ? 'LoRA' : 'Adapter'}
                        </span>
                      </div>
                    </div>

                    {/* Job */}
                    <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                      <FolderOpen className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      {model.modelType === 'lora' ? (
                        <Link href={'/jobs?name=' + encodeURIComponent(model.jobName)} className="text-sm text-blue-400 hover:text-blue-300 truncate hover:underline" title={model.jobName}>
                          {model.jobName}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400 truncate" title={model.jobName}>
                          {model.jobName}
                        </span>
                      )}
                    </div>

                    {/* Size */}
                    <div className="col-span-2">
                      <span className="text-sm text-gray-300">{model.sizeFormatted}</span>
                    </div>

                    {/* Steps */}
                    <div className="col-span-1">
                      <span className="text-xs text-gray-400 font-mono">{model.steps}</span>
                    </div>

                    {/* Date */}
                    <div className="col-span-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      <span className="text-xs text-gray-400">{formatDate(model.modified)}</span>
                    </div>

                    {/* Download */}
                    <div className="col-span-1 flex justify-end">
                      <a
                        href={getDownloadUrl(model)}
                        download={model.name}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 hover:border-blue-500/50 rounded-lg text-blue-400 text-xs transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Download</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </MainContent>
    </>
  );
}
