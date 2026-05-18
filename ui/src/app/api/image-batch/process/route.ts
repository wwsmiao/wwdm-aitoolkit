import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const imgExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function getImageFiles(dirPath: string): { filePath: string; ext: string; name: string }[] {
  const results: { filePath: string; ext: string; name: string }[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!imgExtensions.includes(ext)) continue;
    results.push({ filePath: path.join(dirPath, entry.name), ext, name: entry.name });
  }
  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode = '', imageDir = '', options = {} } = body;

    if (!imageDir || !fs.existsSync(imageDir) || !fs.statSync(imageDir).isDirectory()) {
      return new Response(JSON.stringify({ error: '\u8bf7\u6307\u5b9a\u6709\u6548\u7684\u56fe\u7247\u76ee\u5f55' }), { status: 400 });
    }

    const images = getImageFiles(imageDir);
    if (images.length === 0) {
      return new Response(JSON.stringify({ error: '\u76ee\u5f55\u4e2d\u672a\u627e\u5230\u56fe\u7247' }), { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify({ type, ...data }) + '\n'));
        };

        let success = 0, fail = 0;

        if (mode === 'resize') {
          const { width = 0, height = 0, mode: resizeMode = 'fixed', quality = 90, outputFormat = '' } = options;

          send('start', { total: images.length, message: `\u627e\u5230 ${images.length} \u5f20\u56fe\u7247\uff0c\u5f00\u59cb\u7f29\u653e...` });

          for (let i = 0; i < images.length; i++) {
            const { filePath, name } = images[i];
            send('progress', { current: i + 1, total: images.length, file: name,
              message: `\u6b63\u5728\u5904\u7406 ${name} (${i + 1}/${images.length})...` });
            try {
              const img = sharp(filePath);
              const meta = await img.metadata();

              let w = meta.width || 0;
              let h = meta.height || 0;

              if (resizeMode === 'percent') {
                const pct = width / 100 || 1;
                w = Math.round(w * pct);
                h = Math.round(h * pct);
              } else if (resizeMode === 'fixed') {
                if (width > 0) w = width;
                if (height > 0) h = height;
              } else if (resizeMode === 'max') {
                const maxDim = width || height || 1024;
                if (w > h) { w = maxDim; h = Math.round(h * maxDim / (meta.width || 1)); }
                else { h = maxDim; w = Math.round(w * maxDim / (meta.height || 1)); }
              } else if (resizeMode === 'width') {
                if (width > 0) { const ratio = width / (meta.width || 1); w = width; h = Math.round((meta.height || 0) * ratio); }
              } else if (resizeMode === 'height') {
                if (height > 0) { const ratio = height / (meta.height || 1); h = height; w = Math.round((meta.width || 0) * ratio); }
              }

              w = Math.max(1, w); h = Math.max(1, h);

              let pipeline = img.resize(w, h, { fit: 'fill' });

              const ext = path.extname(filePath).toLowerCase();
              let outPath = filePath;

              if (outputFormat) {
                const fmt = outputFormat.toLowerCase().replace(/^\./, '');
                outPath = filePath.replace(/\.[^.]+$/, '.' + fmt);
                switch (fmt) {
                  case 'jpg': case 'jpeg': pipeline = pipeline.jpeg({ quality }); break;
                  case 'png': pipeline = pipeline.png(); break;
                  case 'webp': pipeline = pipeline.webp({ quality }); break;
                  case 'gif': pipeline = pipeline.gif(); break;
                }
              } else {
                switch (ext) {
                  case '.jpg': case '.jpeg': pipeline = pipeline.jpeg({ quality }); break;
                  case '.png': pipeline = pipeline.png(); break;
                  case '.webp': pipeline = pipeline.webp({ quality }); break;
                  case '.gif': pipeline = pipeline.gif(); break;
                }
              }

              if (outPath !== filePath) {
                // Remove old file if format changed
                await pipeline.toFile(outPath);
                fs.unlinkSync(filePath);
              } else {
                // Overwrite: write to temp then rename
                const tmpPath = filePath + '.tmp_' + Date.now();
                await pipeline.toFile(tmpPath);
                fs.renameSync(tmpPath, filePath);
              }

              success++;
              send('success', { current: i + 1, total: images.length, file: name, message: `\u2713 ${name} \u5b8c\u6210` });
            } catch (err: any) {
              fail++;
              send('error', { current: i + 1, total: images.length, file: name,
                message: `\u2717 ${name} \u5931\u8d25: ${err.message || err}` });
            }
          }
        } else if (mode === 'rename') {
          const { pattern = 'image_', startNumber = 1, digits = 4 } = options;

          send('start', { total: images.length, message: `\u627e\u5230 ${images.length} \u5f20\u56fe\u7247\uff0c\u5f00\u59cb\u91cd\u547d\u540d...` });

          for (let i = 0; i < images.length; i++) {
            const { filePath, name, ext } = images[i];
            const num = String(startNumber + i).padStart(digits, '0');
            const newName = pattern + num + ext;
            const newPath = path.join(imageDir, newName);

            // Handle name conflict
            const finalPath = fs.existsSync(newPath) ? newPath.replace(/\.[^.]+$/, '_' + Date.now() + ext) : newPath;

            send('progress', { current: i + 1, total: images.length, file: name,
              message: `\u91cd\u547d\u540d: ${name} \u2192 ${newName}` });
            try {
              fs.renameSync(filePath, finalPath);
              success++;
              send('success', { current: i + 1, total: images.length, file: name,
                message: `\u2713 ${name} \u2192 ${newName}` });
            } catch (err: any) {
              fail++;
              send('error', { current: i + 1, total: images.length, file: name,
                message: `\u2717 ${name} \u5931\u8d25: ${err.message || err}` });
            }
          }
        } else if (mode === 'format') {
          const { targetFormat = 'png', quality = 90, outputDir = '', createSubfolder = true } = options;

          send('start', { total: images.length, message: `\u627e\u5230 ${images.length} \u5f20\u56fe\u7247\uff0c\u5f00\u59cb\u8f6c\u6362\u683c\u5f0f...` });

          for (let i = 0; i < images.length; i++) {
            const { filePath, name } = images[i];
            send('progress', { current: i + 1, total: images.length, file: name,
              message: `\u6b63\u5728\u8f6c\u6362 ${name} (${i + 1}/${images.length})...` });
            try {
              let pipeline = sharp(filePath);
              const fmt = targetFormat.replace(/^\./, '').toLowerCase();
              const outExt = fmt === 'jpeg' ? '.jpg' : '.' + fmt;

              // Determine output dir
              let outDir = outputDir || imageDir;
              if (createSubfolder && !outputDir) {
                outDir = path.join(imageDir, targetFormat + '_converted');
                if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
              }

              const outName = path.basename(name, path.extname(name)) + outExt;
              const outPath = path.join(outDir, outName);

              switch (fmt) {
                case 'jpg': case 'jpeg': pipeline = pipeline.jpeg({ quality }); break;
                case 'png': pipeline = pipeline.png(); break;
                case 'webp': pipeline = pipeline.webp({ quality }); break;
                case 'gif': pipeline = pipeline.gif(); break;
              }

              await pipeline.toFile(outPath);
              success++;
              send('success', { current: i + 1, total: images.length, file: name,
                message: `\u2713 ${name} \u2192 ${outName}` });
            } catch (err: any) {
              fail++;
              send('error', { current: i + 1, total: images.length, file: name,
                message: `\u2717 ${name} \u5931\u8d25: ${err.message || err}` });
            }
          }
        } else {
          send('error', { message: '\u672a\u77e5\u6a21\u5f0f: ' + mode });
        }

        send('complete', { total: images.length, success, fail,
          message: `\u5904\u7406\u5b8c\u6210\uff01\u6210\u529f: ${success}, \u5931\u8d25: ${fail}` });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
}
