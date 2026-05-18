'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TopBar, MainContent } from '@/components/layout';

interface Template {
  name: string;
  description: string;
  filename: string;
  prompt: string;
}

interface LogEntry {
  type: 'progress' | 'success' | 'skip' | 'error' | 'start' | 'complete' | 'info';
  message: string;
  file?: string;
  caption?: string;
  current?: number;
  total?: number;
}

export default function OllamaTaggingPage() {
  const [imageDir, setImageDir] = useState('');
  const [model, setModel] = useState('llava');
  const [prompt, setPrompt] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [triggerWord, setTriggerWord] = useState('[trigger]');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, fail: 0 });
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  const loadTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const res = await fetch('/api/ollama/templates/list');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleTemplateSelect = (filename: string) => {
    setSelectedTemplate(filename);
    if (!filename) { setPrompt(''); return; }
    const tpl = templates.find(t => t.filename === filename);
    if (tpl) setPrompt(tpl.prompt);
  };

  const handleCreateTemplate = async () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    try {
      const res = await fetch('/api/ollama/templates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim(),
          prompt: newPrompt.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadTemplates();
        setSelectedTemplate(data.filename);
        setPrompt(newPrompt.trim());
        setShowCreateModal(false);
        setNewName(''); setNewDesc(''); setNewPrompt('');
      } else {
        alert('创建失败: ' + (data.error || '未知错误'));
      }
    } catch (e) {
      alert('创建模板时出错');
    }
  };

  const handleDeleteTemplate = async (filename: string, name: string) => {
    if (!confirm('确定要删除模板「' + name + '」吗？')) return;
    try {
      const res = await fetch('/api/ollama/templates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (data.success) {
        if (selectedTemplate === filename) {
          setSelectedTemplate(''); setPrompt('');
        }
        await loadTemplates();
      } else {
        alert('删除失败: ' + (data.error || '未知错误'));
      }
    } catch (e) {
      alert('删除模板时出错');
    }
  };

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
  }, []);

  const startTagging = async () => {
    if (!imageDir.trim()) return;
    setIsRunning(true);
    setLogs([]);
    setProgress({ current: 0, total: 0, success: 0, fail: 0 });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch('/api/ollama/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDir: imageDir.trim(),
          model: model.trim() || 'llava',
          prompt: prompt.trim(),
          ollamaUrl: ollamaUrl.trim() || 'http://localhost:11434',
          triggerWord: triggerWord.trim() || '[trigger]',
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: '请求失败' }));
        addLog({ type: 'error', message: err.error || 'HTTP ' + response.status });
        setIsRunning(false);
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) {
        addLog({ type: 'error', message: '无法读取响应流' });
        setIsRunning(false);
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            addLog({
              type: data.type,
              message: data.message || '',
              file: data.file,
              caption: data.caption,
              current: data.current,
              total: data.total,
            });
            if (data.total) {
              setProgress(prev => ({
                current: data.current || prev.current,
                total: data.total || prev.total,
                success: data.type === 'success' || data.type === 'skip' ? (data.current || 0) : prev.success,
                fail: data.type === 'error' ? (prev.fail + 1) : prev.fail,
              }));
            }
            if (data.type === 'complete') {
              setProgress({
                current: data.total,
                total: data.total,
                success: data.success || 0,
                fail: data.fail || 0,
              });
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

  const stopTagging = () => { abortRef.current?.abort(); };

  return (
    <>
      <TopBar>
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Ollama 打标</h1>
        </div>
        <div className="flex-1" />
      </TopBar>

      <MainContent>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 配置区域 */}
          <div className="bg-gray-900 rounded-lg p-6 space-y-4 border border-gray-700">
            <h2 className="text-lg font-medium text-gray-200">配置</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">图片目录路径 *</label>
              <input
                type="text"
                value={imageDir}
                onChange={e => setImageDir(e.target.value)}
                placeholder="例如: E:\ai-toolkit\datasets\my_dataset"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
              />
              <p className="text-xs text-gray-500 mt-1">图片目录的完整路径，程序会扫描该目录下所有图片并生成对应的 .txt 标注文件</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Ollama 地址</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">模型名称</label>
                <input
                  type="text"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="llava"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isRunning}
                />
                <p className="text-xs text-gray-500 mt-1">需为支持图片输入的多模态模型（如 llava, moondream, minicpm-v, llama3.2-vision 等）</p>
              </div>
            </div>

            {/* 模板选择 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-300">指令模板</label>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="text-xs px-3 py-1 bg-green-700 text-green-200 rounded hover:bg-green-600 transition-colors"
                  disabled={isRunning}
                >
                  + 新建模板
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex-1 relative">
                  <select
                    value={selectedTemplate}
                    onChange={e => handleTemplateSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                    disabled={isRunning || loadingTemplates}
                  >
                    <option value="">-- 手动输入 / 无模板 --</option>
                    {templates.map(tpl => (
                      <option key={tpl.filename} value={tpl.filename}>
                        {tpl.name + (tpl.description ? ' — ' + tpl.description : '')}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
                {selectedTemplate && (
                  <button
                    onClick={() => {
                      const tpl = templates.find(t => t.filename === selectedTemplate);
                      if (tpl) handleDeleteTemplate(tpl.filename, tpl.name);
                    }}
                    className="px-2 py-2 bg-red-800 text-red-300 rounded hover:bg-red-700 transition-colors text-xs"
                    disabled={isRunning}
                    title="删除模板"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 触发词 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                触发词 <span className="text-gray-500 font-normal">（用于替换模板中的 {'{chufaci}'} 占位符）</span>
              </label>
              <input
                type="text"
                value={triggerWord}
                onChange={e => setTriggerWord(e.target.value)}
                placeholder="[trigger]"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
              />
            </div>

            {/* 打标提示词 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                打标提示词
                {selectedTemplate && (
                  <span className="text-gray-500 font-normal ml-2">（选中模板后自动填充，可手动修改）</span>
                )}
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical font-mono text-xs"
                disabled={isRunning}
              />
              {prompt.includes('{chufaci}') && (
                <p className="text-xs text-blue-400 mt-1">
                  {'{chufaci}'} 将被替换为触发词: <code className="bg-gray-700 px-1 rounded">{triggerWord || '[trigger]'}</code>
                </p>
              )}
            </div>

            <div className="flex items-center space-x-3 pt-2">
              {!isRunning ? (
                <button
                  onClick={startTagging}
                  disabled={!imageDir.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  开始打标
                </button>
              ) : (
                <button
                  onClick={stopTagging}
                  className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                >
                  停止
                </button>
              )}
            </div>
          </div>

          {/* 进度 */}
          {progress.total > 0 && (
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-medium text-gray-200 mb-3">进度</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{progress.current} / {progress.total}</span>
                  <span>
                    成功: <span className="text-green-400">{progress.success}</span>
                    &nbsp;|&nbsp;
                    失败: <span className="text-red-400">{progress.fail}</span>
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: Math.round((progress.current / progress.total) * 100) + '%' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 日志 */}
          {logs.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h2 className="text-lg font-medium text-gray-200 mb-3">日志</h2>
              <div className="bg-gray-950 rounded-md p-4 max-h-96 overflow-y-auto font-mono text-sm space-y-1">
                {logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={
                      'leading-relaxed ' +
                      (log.type === 'success' ? 'text-green-400' :
                      log.type === 'skip' ? 'text-yellow-400' :
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'complete' ? 'text-blue-400 font-bold' :
                      log.type === 'start' ? 'text-blue-300' :
                      'text-gray-300')
                    }
                  >
                    {log.message}
                    {log.caption && (
                      <details className="ml-4 mt-1">
                        <summary className="text-gray-500 cursor-pointer text-xs">查看标注内容</summary>
                        <p className="text-gray-400 text-xs mt-1 whitespace-pre-wrap">{log.caption}</p>
                      </details>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* 新建模板 Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black bg-opacity-60" onClick={() => setShowCreateModal(false)} />
            <div className="relative bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl">
              <h3 className="text-lg font-medium text-gray-200 mb-4">新建指令模板</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">模板名称 *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="例如: 详细描述"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">描述（可选）</label>
                  <input
                    type="text"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="例如: 适合训练用的详细描述"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    提示词 * <span className="text-gray-500 font-normal">（用 {'{chufaci}'} 表示触发词占位符）</span>
                  </label>
                  <textarea
                    value={newPrompt}
                    onChange={e => setNewPrompt(e.target.value)}
                    rows={5}
                    placeholder="Describe this image... {chufaci}"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateTemplate}
                  disabled={!newName.trim() || !newPrompt.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        )}
      </MainContent>
    </>
  );
}
