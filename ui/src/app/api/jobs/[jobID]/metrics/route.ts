import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { getTrainingFolder } from '@/server/settings';

const prisma = new PrismaClient();

interface MetricsPoint {
  step: number;
  loss: number;
}

function parseMetrics(log: string): MetricsPoint[] {
  const points: MetricsPoint[] = [];
  const lines = log.split('\n');

  // Each pattern is [regex, stepCaptureIndex, lossCaptureIndex]
  // capture indices are 1-based (1st capture group = 1, 2nd = 2)
  type PatternDef = [RegExp, number, number];
  const patterns: PatternDef[] = [
    // tqdm: 1000/1000 [time, it/s, lr: X, loss: Y]  — match[1]=step, match[2]=loss
    [/(\d+)\/\d+\s+\[[^\]]*loss[=:]\s*([\d.]+(?:e[+-]?\d+)?)\]/i, 1, 2],
    // Step: NNN, Loss: X.XXXX  — match[1]=step, match[2]=loss
    [/step:\s*(\d+)[,\s]+loss:\s*([\d.]+(?:e[+-]?\d+)?)/i, 1, 2],
    // Loss: X.XXXX, Step: NNN  — match[1]=loss, match[2]=step
    [/loss:\s*([\d.]+(?:e[+-]?\d+)?)[,\s]+step:\s*(\d+)/i, 2, 1],
    // | step NNN | loss X.XXXX |  — match[1]=step, match[2]=loss
    [/\|.*step\s*(\d+).*\|.*loss\s*([\d.]+(?:e[+-]?\d+)?).*\|/i, 1, 2],
    // epoch N - step NNN - loss: X.XXXX  — match[1]=step, match[2]=loss
    [/epoch\s*\d+[^\n]*?step\s*(\d+)[^\n]*?loss[\s:]*(\S+)/i, 1, 2],
  ];

  for (const line of lines) {
    for (const [regex, stepIdx, lossIdx] of patterns) {
      const match = line.match(regex);
      if (match) {
        const step = parseInt(match[stepIdx], 10);
        const loss = parseFloat(match[lossIdx]);
        if (!isNaN(step) && !isNaN(loss) && step > 0 && Number.isFinite(loss)) {
          points.push({ step, loss });
        }
        break; // first matching pattern wins per line
      }
    }
  }

  // Deduplicate by step (keep the last occurrence)
  const seen = new Set<number>();
  const deduped: MetricsPoint[] = [];
  for (let i = points.length - 1; i >= 0; i--) {
    if (!seen.has(points[i].step)) {
      seen.add(points[i].step);
      deduped.unshift(points[i]);
    }
  }

  // Sort by step
  deduped.sort((a, b) => a.step - b.step);

  return deduped;
}

export async function GET(request: NextRequest, { params }: { params: { jobID: string } }) {
  const { jobID } = await params;

  const job = await prisma.job.findUnique({
    where: { id: jobID },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const trainingFolder = await getTrainingFolder();
  const jobFolder = path.join(trainingFolder, job.name);
  const logPath = path.join(jobFolder, 'log.txt');

  if (!fs.existsSync(logPath)) {
    return NextResponse.json({ metrics: [] });
  }

  let log = '';
  try {
    log = fs.readFileSync(logPath, 'utf-8');
  } catch (error) {
    console.error('Error reading log file:', error);
    return NextResponse.json({ error: 'Error reading log file' }, { status: 500 });
  }

  const metrics = parseMetrics(log);
  return NextResponse.json({ metrics });
}
