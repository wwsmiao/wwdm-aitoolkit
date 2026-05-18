import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    const { imageDir = '', model = 'llava', prompt = '', ollamaUrl = 'http://localhost:11434', triggerWord = '[trigger]' } = body;

    if (!imageDir) {
      return new Response(JSON.stringify({ error: '请指定图片目录路径' }), { status: 400 });
    }

    if (!fs.existsSync(imageDir)) {
      return new Response(JSON.stringify({ error: `目录不存在: ${imageDir}` }), { status: 400 });
    }

    const stat = fs.statSync(imageDir);
    if (!stat.isDirectory()) {
      return new Response(JSON.stringify({ error: `路径不是目录: ${imageDir}` }), { status: 400 });
    }

    // Scan for image files
    const imageFiles = getImageFiles(imageDir);
    if (imageFiles.length === 0) {
      return new Response(JSON.stringify({ error: '目录中未找到图片文件' }), { status: 400 });
    }

    // Substitute {chufaci} with the actual trigger word
    let effectivePrompt = prompt.trim() || 'Describe this image in detail. The subject is: {chufaci}';
    effectivePrompt = effectivePrompt.replace(/\{chufaci\}/g, triggerWord);

    // Use streaming response to send progress updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (type: string, data: any) => {
          const msg = JSON.stringify({ type, ...data }) + '\n';
          controller.enqueue(encoder.encode(msg));
        };

        sendEvent('start', {
          total: imageFiles.length,
          message: `找到 ${imageFiles.length} 张图片，开始处理...`,
        });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < imageFiles.length; i++) {
          const imgPath = imageFiles[i];
          const fileName = path.basename(imgPath);
          const captionPath = imgPath.replace(/\.[^/.]+$/, '') + '.txt';

          // Check if caption already exists
          if (fs.existsSync(captionPath)) {
            sendEvent('skip', {
              current: i + 1,
              total: imageFiles.length,
              file: fileName,
              message: `跳过 ${fileName}（已存在标注文件）`,
            });
            successCount++;
            continue;
          }

          sendEvent('progress', {
            current: i + 1,
            total: imageFiles.length,
            file: fileName,
            message: `正在处理 ${fileName} (${i + 1}/${imageFiles.length})...`,
          });

          try {
            // Read image and convert to base64
            const imageBuffer = fs.readFileSync(imgPath);
            const base64Image = imageBuffer.toString('base64');

            // Call Ollama API
            const ollamaRes = await fetch(ollamaUrl.replace(/\/+$/, '') + '/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: model,
                prompt: effectivePrompt,
                images: [base64Image],
                stream: false,
              }),
            });

            if (!ollamaRes.ok) {
              const errText = await ollamaRes.text();
              throw new Error(`Ollama API 返回 ${ollamaRes.status}: ${errText}`);
            }

            const ollamaData = await ollamaRes.json();
            const caption = (ollamaData.response || '').trim();

            // Save caption to .txt file
            fs.writeFileSync(captionPath, caption, 'utf-8');

            successCount++;
            sendEvent('success', {
              current: i + 1,
              total: imageFiles.length,
              file: fileName,
              caption: caption,
              message: `✓ ${fileName} 标注完成`,
            });
          } catch (err: any) {
            failCount++;
            sendEvent('error', {
              current: i + 1,
              total: imageFiles.length,
              file: fileName,
              message: `✗ ${fileName} 失败: ${err.message || err}`,
            });
          }
        }

        sendEvent('complete', {
          total: imageFiles.length,
          success: successCount,
          fail: failCount,
          message: `处理完成！成功: ${successCount}, 失败: ${failCount}`,
        });

        controller.close();
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
    console.error('Ollama tagging error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
}
