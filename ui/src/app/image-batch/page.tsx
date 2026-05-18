'use client';

import { useState, useRef, useCallback } from 'react';
import { TopBar, MainContent } from '@/components/layout';

interface LogEntry {
  type: 'progress' | 'success' | 'skip' | 'error' | 'start' | 'complete' | 'info';
  message: string;
  file?: string;
  current?: number;
  total?: number;
}

type TabMode = 'resize' | 'rename' | 'format';

export default function ImageBatchPage() {
  const [activeTab, setActiveTab] = useState<TabMode>('resize');
  const [imageDir, setImageDir] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, fail: 0 });
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Resize options
  const [resizeMode, setResizeMode] = useState('fixed');
  const [resizeWidth, setResizeWidth] = useState(1024);
  const [resizeHeight, setResizeHeight] = useState(1024);
  const [resizePercent, setResizePercent] = useState(50);
  const [resizeQuality, setResizeQuality] = useState(90);
  const [resizeFormat, setResizeFormat] = useState('');

  // Rename options
  const [namePattern, setNamePattern] = useState('image_');
  const [startNumber, setStartNumber] = useState(1);
  const [numDigits, setNumDigits] = useState(4);

  // Format options
  const [targetFormat, setTargetFormat] = useState('png');
  const [fmtQuality, setFmtQuality] = useState(90);
  const [createSubfolder, setCreateSubfolder] = useState(true);
  const [outputDir, setOutputDir] = useState('');

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
  }, []);

  const startProcessing = async () => {
    if (!imageDir.trim()) return;

    setIsRunning(true);
    setLogs([]);
    setProgress({ current: 0, total: 0, success: 0, fail: 0 });

    const controller = new AbortController();
    abortRef.current = controller;

    let options: any = {};
    if (activeTab === 'resize') {
      options = {
        mode: resizeMode,
        width: resizeMode === 'percent' ? resizePercent : resizeWidth,
        height: resizeHeight,
        quality: resizeQuality,
        outputFormat: resizeFormat,
      };
    } else if (activeTab === 'rename') {
      options = { pattern: namePattern, startNumber, digits: numDigits };
    } else {
      options = { targetFormat, quality: fmtQuality, outputDir, createSubfolder };
    }

    try {
      const response = await fetch('/api/image-batch/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: activeTab, imageDir: imageDir.trim(), options }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: '请求失败' }));
        addLog({ type: 'error', message: err.error || 'HTTP ' + response.status });
        setIsRunning(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) { addLog({ type: 'error', message: '无法读取响应流' }); setIsRunning(false); return; }

      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            addLog({ type: data.type, message: data.message || '', file: data.file, current: data.current, total: data.total });
            if (data.total) {
              setProgress({ current: data.current || 0, total: data.total, success: data.type === 'success' ? (data.current || 0) : 0, fail: data.type === 'error' ? (progress.fail + 1) : 0 });
            }
            if (data.type === 'complete') {
              setProgress({ current: data.total, total: data.total, success: data.success || 0, fail: data.fail || 0 });
            }
          } catch (e) {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog({ type: 'info', message: '已取消' });
      } else {
        addLog({ type: 'error', message: '连接失败: ' + (err.message || err) });
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  };

  const stopProcessing = () => { abortRef.current?.abort(); };

  const tabs: { key: TabMode; label: string }[] = [
    { key: 'resize', label: '批量缩放' },
    { key: 'rename', label: '批量重命名' },
    { key: 'format', label: '修复图片格式' },
  ];

  return (
    <>
      <TopBar>
        <div><h1 className="text-2xl font-semibold text-gray-100">图片处理</h1></div>
        <div className="flex-1" />
      </TopBar>

      <MainContent>
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Directory input */}
          <div className="bg-gray-900 rounded-lg p-6 space-y-4 border border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">图片目录路径 *</label>
              <input type="text" value={imageDir} onChange={e => setImageDir(e.target.value)}
                placeholder="例如: E:\\ai-toolkit\\datasets\\my_dataset"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isRunning} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-800 rounded-lg p-1">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setLogs([]); setProgress({ current: 0, total: 0, success: 0, fail: 0 }); }}
                className={'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ' + (activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700')}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Options per tab */}
          <div className="bg-gray-900 rounded-lg p-6 space-y-4 border border-gray-700">

            {activeTab === 'resize' && (
              <>
                <h2 className="text-lg font-medium text-gray-200">批量缩放选项</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">缩放模式</label>
                  <select value={resizeMode} onChange={e => setResizeMode(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isRunning}>
                    <option value="fixed">固定宽高</option>
                    <option value="width">固定宽度（自适应比例）</option>
                    <option value="height">固定高度（自适应比例）</option>
                    <option value="max">固定最大边长</option>
                    <option value="percent">百分比缩放</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {resizeMode === 'percent' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">百分比 (1-1000)</label>
                      <input type="number" value={resizePercent} onChange={e => setResizePercent(Number(e.target.value))}
                        min={1} max={1000}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isRunning} />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">宽度 (px) {resizeMode === 'height' ? '(自动)' : ''}</label>
                        <input type="number" value={resizeWidth} onChange={e => setResizeWidth(Number(e.target.value))}
                          min={1} disabled={isRunning || resizeMode === 'height'}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">高度 (px) {resizeMode === 'width' ? '(自动)' : ''}</label>
                        <input type="number" value={resizeHeight} onChange={e => setResizeHeight(Number(e.target.value))}
                          min={1} disabled={isRunning || resizeMode === 'width'}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
                      </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">质量 (1-100)</label>
                    <input type="number" value={resizeQuality} onChange={e => setResizeQuality(Number(e.target.value))}
                      min={1} max={100}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRunning} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">输出格式 (不转换则为原格式)</label>
                    <select value={resizeFormat} onChange={e => setResizeFormat(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRunning}>
                      <option value="">保持原格式</option>
                      <option value="jpg">JPEG</option>
                      <option value="png">PNG</option>
                      <option value="webp">WebP</option>
                      <option value="bmp">BMP</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'rename' && (
              <>
                <h2 className="text-lg font-medium text-gray-200">批量重命名选项</h2>
                <p className="text-sm text-gray-500">重命名后的文件名格式: 前缀 + 序号 + 原扩展名</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">文件名前缀</label>
                    <input type="text" value={namePattern} onChange={e => setNamePattern(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRunning} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">起始序号</label>
                    <input type="number" value={startNumber} onChange={e => setStartNumber(Number(e.target.value))}
                      min={0}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRunning} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">序号位数</label>
                    <input type="number" value={numDigits} onChange={e => setNumDigits(Number(e.target.value))}
                      min={1} max={10}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRunning} />
                  </div>
                </div>
                <div className="text-sm text-gray-400 bg-gray-800 p-3 rounded">
                  示例: <code className="text-blue-400">{namePattern || 'image_'}{String(startNumber).padStart(numDigits, '0')}.jpg</code>,{' '}
                  <code className="text-blue-400">{namePattern || 'image_'}{String(startNumber + 1).padStart(numDigits, '0')}.png</code>, ...
                </div>
              </>
            )}

            {activeTab === 'format' && (
              <>
                <h2 className="text-lg font-medium text-gray-200">修复图片格式选项</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">目标格式</label>
                    <select value={targetFormat} onChange={e => setTargetFormat(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRunning}>
                      <option value="png">PNG</option>
                      <option value="jpg">JPEG</option>
                      <option value="webp">WebP</option>
                      <option value="bmp">BMP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">质量 (1-100, 仅 JPEG/WebP)</label>
                    <input type="number" value={fmtQuality} onChange={e => setFmtQuality(Number(e.target.value))}
                      min={1} max={100}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRunning} />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="subfolder" checked={createSubfolder}
                    onChange={e => setCreateSubfolder(e.target.checked)} disabled={isRunning}
                    className="rounded bg-gray-800 border-gray-600 text-blue-600" />
                  <label htmlFor="subfolder" className="text-sm text-gray-300">创建子目录保存（原图不变）</label>
                </div>
                {!createSubfolder && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">输出目录（不填则覆盖原文件）</label>
                    <input type="text" value={outputDir} onChange={e => setOutputDir(e.target.value)}
                      placeholder="E:\\output"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRunning} />
                  </div>
                )}
              </>
            )}

            {/* Start / Stop button */}
            <div className="flex items-center space-x-3 pt-2">
              {!isRunning ? (
                <button onClick={startProcessing} disabled={!imageDir.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium">
                  开始处理
                </button>
              ) : (
                <button onClick={stopProcessing}
                  className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium">
                  停止
                </button>
              )}
            </div>
          </div>

          {/* Progress */}
          {progress.total > 0 && (
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-medium text-gray-200 mb-3">进度</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{progress.current} / {progress.total}</span>
                  <span>成功: <span className="text-green-400">{progress.success}</span> | 失败: <span className="text-red-400">{progress.fail}</span></span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: Math.round((progress.current / progress.total) * 100) + '%' }} />
                </div>
              </div>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-medium text-gray-200 mb-3">日志</h2>
              <div className="bg-gray-950 rounded-md p-4 max-h-96 overflow-y-auto font-mono text-sm space-y-1">
                {logs.map((log, idx) => (
                  <div key={idx}
                    className={'leading-relaxed ' + (log.type === 'success' ? 'text-green-400' : log.type === 'error' ? 'text-red-400' : log.type === 'complete' ? 'text-blue-400 font-bold' : log.type === 'start' ? 'text-blue-300' : 'text-gray-300')}>
                    {log.message}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>
      </MainContent>
    </>
  );
}
