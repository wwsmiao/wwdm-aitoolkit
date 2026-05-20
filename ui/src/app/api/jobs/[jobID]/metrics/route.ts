import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { getTrainingFolder } from '@/server/settings';

const prisma = new PrismaClient();

interface MetricsPoint {
  step: number;
  loss: number;
  lr?: number;
}

function parseMetrics(log: string): MetricsPoint[] {
  const points: MetricsPoint[] = [];
  const lines = log.split('\n');

  type PatternDef = [RegExp, number, number];
  const patterns: PatternDef[] = [
    // tqdm: 1000/1000 [... lr: X loss: Y]  -- match[1]=step, match[2]=loss
    [/(\d+)\/\d+\s+\[[^\]]*loss[=:]\s*([\d.]+(?:e[+-]?\d+)?)\]/i, 1, 2],
    // Step: NNN, Loss: X.XXXX  -- match[1]=step, match[2]=loss
    [/step:\s*(\d+)[,\s]+loss:\s*([\d.]+(?:e[+-]?\d+)?)/i, 1, 2],
    // Loss: X.XXXX, Step: NNN  -- match[1]=loss, match[2]=step
    [/loss:\s*([\d.]+(?:e[+-]?\d+)?)[,\s]+step:\s*(\d+)/i, 2, 1],
    // | step NNN | loss X.XXXX |  -- match[1]=step, match[2]=loss
    [/\|.*step\s*(\d+).*\|.*loss\s*([\d.]+(?:e[+-]?\d+)?).*\|/i, 1, 2],
    // epoch N - step NNN - loss: X.XXXX  -- match[1]=step, match[2]=loss
    [/epoch\s*\d+[^\n]*?step\s*(\d+)[^\n]*?loss[\s:]*(\S+)/i, 1, 2],
  ];

  // LR pattern extracted separately (only from tqdm lines)
  const lrPattern = /lr[=:]\s*([\d.]+(?:e[+-]?\d+)?)/i;

  for (const line of lines) {
    for (const [regex, stepIdx, lossIdx] of patterns) {
      const match = line.match(regex);
      if (match) {
        const step = parseInt(match[stepIdx], 10);
        const loss = parseFloat(match[lossIdx]);
        if (!isNaN(step) && !isNaN(loss) && step >= 0 && Number.isFinite(loss)) {
          const point: MetricsPoint = { step, loss };
          // Try to extract LR from the same line
          const lrMatch = line.match(lrPattern);
          if (lrMatch) {
            const lr = parseFloat(lrMatch[1]);
            if (!isNaN(lr) && Number.isFinite(lr)) {
              point.lr = lr;
            }
          }
          points.push(point);
        }
        break;
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobID: string }> }) {
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
    return NextResponse.json({ metrics: [], hasLr: false });
  }

  let log = '';
  try {
    log = fs.readFileSync(logPath, 'utf-8');
  } catch (error) {
    console.error('Error reading log file:', error);
    return NextResponse.json({ error: 'Error reading log file' }, { status: 500 });
  }

  const metrics = parseMetrics(log);

  // Check if any points have LR data
  const hasLr = metrics.some(m => m.lr !== undefined);

  return NextResponse.json({ metrics, hasLr });
}
