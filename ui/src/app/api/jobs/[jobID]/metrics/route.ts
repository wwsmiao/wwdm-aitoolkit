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

  // Try multiple regex patterns for different training log formats
  const patterns = [
    // Step: NNN, Loss: X.XXXX, ...
    /[Ss]tep:\s*(\d+)[,\s]+[Ll]oss:\s*([\d.]+(?:e[+-]?\d+)?)/,
    // loss: X.XXXX @ step NNN
    /[Ll]oss:\s*([\d.]+(?:e[+-]?\d+)?)[,\s]+[Ss]tep:\s*(\d+)/i,
    // | step NNN | loss X.XXXX |
    /\|.*step\s*(\d+).*\|.*loss\s*([\d.]+(?:e[+-]?\d+)?).*\|/i,
    // epoch NNN - step NNN - loss: X.XXXX
    /epoch\s*\d+[^\n]*?[Ss]tep\s*(\d+)[^\n]*?[Ll]oss[\s:]*(\S+)/i,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        // Figure out which group is step and which is loss based on pattern
        let stepStr: string, lossStr: string;
        if (pattern.toString().includes('[Ss]tep:[\\s:]*([\\d.]+(?:e[+-]?\\d+)?)')) {
          stepStr = match[1];
          lossStr = match[2];
        } else if (pattern.toString().includes('[Ss]tep\\s*(\\d+)')) {
          stepStr = match[1];
          lossStr = match[2];
        } else {
          stepStr = match[1];
          lossStr = match[2];
        }
        // For patterns where step is the first capture group
        if (match[1] && match[2]) {
          // Detect: first is step, second is loss (numeric check)
          const a = parseFloat(match[1]);
          const b = parseFloat(match[2]);
          let step: number, loss: number;
          if (a > 10 && b < 100) {
            step = a; loss = b;
          } else if (b > 10 && a < 100) {
            step = b; loss = a;
          } else {
            step = a; loss = b;
          }
          if (!isNaN(step) && !isNaN(loss) && step > 0) {
            points.push({ step, loss });
          }
        }
        break; // first matching pattern wins
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
