import { NextRequest } from 'next/server';
import { spawn, execSync } from 'child_process';
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

/**
 * Auto-detect Python executable with fallback chain:
 *   1. Windows venv  -> venv\Scripts\python.exe
 *   2. Linux/macOS venv -> venv/bin/python3 or venv/bin/python
 *   3. PYTHON_PATH env var (for custom Docker setups)
 *   4. python3 / python in PATH
 */
function findPython(projectRoot: string): string | null {
  // 1. Windows venv
  const winVenv = path.join(projectRoot, 'venv', 'Scripts', 'python.exe');
  if (fs.existsSync(winVenv)) return winVenv;

  // 2. Linux/macOS venv
  const unixVenv = path.join(projectRoot, 'venv', 'bin', 'python3');
  if (fs.existsSync(unixVenv)) return unixVenv;
  const unixVenvAlt = path.join(projectRoot, 'venv', 'bin', 'python');
  if (fs.existsSync(unixVenvAlt)) return unixVenvAlt;

  // 3. Custom env var override (for Docker / non-standard paths)
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH!;
  }

  // 4. PATH fallback
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const py3 = execSync(which + ' python3', { encoding: 'utf8' }).trim().split(/\\r?\\n/)[0];
    if (py3) return py3;
  } catch { /* python3 not in PATH */ }
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const py = execSync(which + ' python', { encoding: 'utf8' }).trim().split(/\\r?\\n/)[0];
    if (py) return py;
  } catch { /* python not in PATH */ }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageDir = '', prompt = '', triggerWord = '[trigger]', modelPath = '', quantization = '4bit', attnImplementation = 'sdpa', maxNewTokens = 2048 } = body;

    if (!imageDir) {
      return new Response(JSON.stringify({ error: '��δָ��ͼƬĿ¼·��' }), { status: 400 });
    }
    if (!fs.existsSync(imageDir)) {
      return new Response(JSON.stringify({ error: 'Ŀ¼������: ' + imageDir }), { status: 400 });
    }
    if (!fs.statSync(imageDir).isDirectory()) {
      return new Response(JSON.stringify({ error: '·������Ŀ¼: ' + imageDir }), { status: 400 });
    }

    const imageFiles = getImageFiles(imageDir);
    if (imageFiles.length === 0) {
      return new Response(JSON.stringify({ error: 'Ŀ¼��δ�ҵ�ͼƬ�ļ�' }), { status: 400 });
    }

    const scriptPath = path.resolve(process.cwd(), '..', 'scripts', 'qwen_local_tagger.py');
    if (!fs.existsSync(scriptPath)) {
      return new Response(JSON.stringify({ error: '�Ҳ�������ģ�ͽű�: ' + scriptPath }), { status: 500 });
    }

    const projectRoot = path.resolve(process.cwd(), '..');
    const pythonPath = findPython(projectRoot);
    if (!pythonPath) {
      return new Response(JSON.stringify({
        error: 'δ�ҵ� Python �����ҡ������� PYTHON_PATH ������ָ��·������ȷ�� Python �Ѱ�װ�� PATH �С�'
      }), { status: 500 });
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
          message: '�ҵ� ' + imageFiles.length + ' ��ͼƬ�����ñ���ģ�ʹ���...',
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

        const proc = spawn(pythonPath, pythonArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 3600000,
          env: {
            ...process.env,
            PYTHONIOENCODING: 'utf-8:replace',
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
          sendEvent('error', { message: '���̴���: ' + err.message });
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