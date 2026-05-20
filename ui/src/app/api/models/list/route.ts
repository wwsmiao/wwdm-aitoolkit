import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getTrainingFolder } from '@/server/settings';

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

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

function parseSteps(filename: string): string {
  // Match patterns like: name_000000300.safetensors
  const match = filename.match(/_(\d+)\.safetensors$/);
  return match ? match[1] : '-';
}

export async function GET() {
  const models: ModelInfo[] = [];

  try {
    // 1. Scan output/ directory for trained models (.safetensors)
    const trainingFolder = await getTrainingFolder();
    if (fs.existsSync(trainingFolder)) {
      const jobDirs = fs.readdirSync(trainingFolder, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const dir of jobDirs) {
        const jobPath = path.join(trainingFolder, dir.name);
        try {
          const files = fs.readdirSync(jobPath, { withFileTypes: true })
            .filter(f => f.isFile() && f.name.endsWith('.safetensors'));

          for (const file of files) {
            const filePath = path.join(jobPath, file.name);
            const stat = fs.statSync(filePath);
            models.push({
              name: file.name,
              path: filePath,
              size: stat.size,
              sizeFormatted: formatSize(stat.size),
              modified: stat.mtime.toISOString(),
              jobName: dir.name,
              steps: parseSteps(file.name),
              ext: path.extname(file.name),
              modelType: 'lora',
            });
          }
        } catch {
          // Skip directories we can't read
        }
      }
    }


    // Sort by modified date (newest first)
    models.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Error listing models:', error);
    return NextResponse.json({ error: 'Failed to list models' }, { status: 500 });
  }
}
