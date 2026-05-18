import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const imgExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return imgExtensions.includes(ext);
}

function getImageFiles(dirPath: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isFile() && isImageFile(entry.name)) {
      results.push(fullPath);
    }
  }
  results.sort();
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageDir = '', prompt = '', triggerWord = '[trigger]', modelPath = '', quantization = '4bit', attnImplementation = 'sdpa', maxNewTokens = 2048 } = body;

    if (!imageDir) {
      return new Response(JSON.stringify({ error: '请指定图片目录路径' }), { status: 400 });
    }
    if (!fs.existsSync(imageDir)) {
      return new Response(JSON.stringify({ error: '目录不存在: ' + imageDir }), { status: 400 });
    }
    if (!fs.statSync(imageDir).isDirectory()) {
      return new Response(JSON.stringify({ error: '路径不是目录: ' + imageDir }), { status: 400 });
    }

    const imageFiles = getImageFiles(imageDir);
    if (imageFiles.length === 0) {
      return new Response(JSON.stringify({ error: '目录中未找到图片文件' }), { status: 400 });
    }

    const scriptPath = path.resolve(process.cwd(), '..', 'scripts', 'qwen_local_tagger.py');
    const venvPython = path.resolve(process.cwd(), '..', 'venv', 'Scripts', 'python.exe');

    if (!fs.existsSync(scriptPath)) {
      return new Response(JSON.stringify({ error: '找不到本地模型脚本: ' + scriptPath }), { status: 500 });
    }
    if (!fs.existsSync(venvPython)) {
      return new Response(JSON.stringify({ error: '找不到 Python 环境: ' + venvPython }), { status: 500 });
    }

    const encoder = new TextEncoder();
    let isControllerClosed = false;

    function safeEnqueue(controller: ReadableStreamDefaultController, msg: string) {
      if (isControllerClosed) return;
      try {
        controller.enqueue(encoder.encode(msg));
      } catch (e: any) {
        if (e?.code === 'ERR_INVALID_STATE') {
          isControllerClosed = true;
        }
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (type: string, data: any) => {
          const msg = JSON.stringify({ type, ...data }) + '\n';
          safeEnqueue(controller, msg);
        };

        sendEvent('start', {
          total: imageFiles.length,
          message: '找到 ' + imageFiles.length + ' 张图片，调用本地模型处理...',
        });

        const pythonArgs = [
          scriptPath,
          '--image-dir', imageDir,
          '--prompt', prompt,
          '--trigger-word', triggerWord,
          '--quantization', quantization,
          '--attn-implementation', attnImplementation,
          '--max-new-tokens', String(maxNewTokens),
        ];
        if (modelPath && modelPath.trim()) {
          pythonArgs.push('--model-path', modelPath.trim());
        }

        const proc = spawn(venvPython, pythonArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 3600000,
          env: {
            ...process.env,
            PYTHONIOENCODING: 'utf-8:replace',
            // Intentionally NOT setting PYTHONUTF8=1
            // so library subprocesses use system encoding (CP936 on Chinese Windows)
            // instead of crashing on GBK output decoded as UTF-8
          },
        });

        // Read stdout as Buffer chunks, only our JSON output
        let buffer = '';
        proc.stdout.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              const eventData: any = {
                current: data.current,
                total: data.total,
                file: data.file,
                message: data.message,
              };
              if (data.caption) eventData.caption = data.caption;
              sendEvent(data.type, eventData);
            } catch {
              // skip non-JSON output
            }
          }
        });

        // stderr: decode with replace to survive encoding issues
        proc.stderr.on('data', (chunk: Buffer) => {
          let text = '';
          try {
            text = chunk.toString('utf-8');
          } catch {
            text = chunk.toString('latin1');
          }
          text = text.trim();
          if (text && !isControllerClosed) {
            sendEvent('info', { message: text });
          }
        });

        proc.on('close', () => {
          isControllerClosed = true;
          try { controller.close(); } catch { /* ignore */ }
        });

        proc.on('error', (err: Error) => {
          sendEvent('error', { message: '进程错误: ' + err.message });
          isControllerClosed = true;
          try { controller.close(); } catch { /* ignore */ }
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Local tagging error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
}