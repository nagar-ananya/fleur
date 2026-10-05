import { readFileSync } from 'node:fs';

import { buildDailyFrame, canPredict, MIN_HISTORY_DAYS, type FrameInputRow } from '../src/logic/frame';
import { scoreDay } from '../src/logic/engine';
import { rulebook } from '../src/logic/rulebook';

const FIRST_TEST_PATIENT = 1201;
const FLARE_DELTA = 3;
const HORIZON_DAYS = 3;

function parseCsv(path: string): Map<number, FrameInputRow[]> {
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n').filter((l) => l.length > 0);
  const header = lines[0].split(',');
  const byPatient = new Map<number, FrameInputRow[]>();

  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(',');
    const row: Record<string, string | number | null> = {};
    for (let c = 0; c < header.length; c += 1) {
      const raw = cells[c];
      row[header[c]] = raw === '' || raw === undefined ? null : raw;
    }
    const patientId = Number(row.patient_id);
    if (patientId < FIRST_TEST_PATIENT) continue;

    const list = byPatient.get(patientId) ?? [];
    list.push(row as FrameInputRow);
    byPatient.set(patientId, list);
  }
  return byPatient;
}

function labelFor(severity: (number | null)[], baseline: (number | null)[], t: number): 0 | 1 | null {
  const base = baseline[t];
  if (base === null) return null;
  let peak = -Infinity;
  for (let k = 1; k <= HORIZON_DAYS; k += 1) {
    const value = severity[t + k];
    if (value === null || value === undefined) return null;
    peak = Math.max(peak, value);
  }
  return peak >= base + FLARE_DELTA ? 1 : 0;
}

function averagePrecision(scores: number[], labels: number[]): number {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const positives = labels.reduce((t, v) => t + v, 0);
  let tp = 0;
  let fp = 0;
  let sum = 0;
  for (const i of order) {
    if (labels[i] === 1) {
      tp += 1;
      sum += tp / (tp + fp);
    } else {
      fp += 1;
    }
  }
  return positives === 0 ? 0 : sum / positives;
}

function main(): void {
  const path = process.argv[2] ?? '../ml/data/synthetic_panel.csv';
  console.log(`[fleur] reading ${path}`);
  const byPatient = parseCsv(path);

  const scores: number[] = [];
  const labels: number[] = [];

  for (const rows of byPatient.values()) {
    const frame = buildDailyFrame(rows);
    const severity = frame.columns.severity;
    const baseline = frame.columns.severity_baseline;

    for (let t = MIN_HISTORY_DAYS; t < frame.dates.length; t += 1) {
      const label = labelFor(severity, baseline, t);
      if (label === null) continue;
      if (!canPredict(frame, t)) continue;
      scores.push(scoreDay(frame, t, rulebook).score);
      labels.push(label);
    }
  }

  const n = scores.length;
  const baseRate = labels.reduce((t, v) => t + v, 0) / n;
  console.log(`\npatients ${byPatient.size}   scoreable days ${n.toLocaleString()}   base rate ${baseRate.toFixed(4)}`);
  console.log(`average precision  ${averagePrecision(scores, labels).toFixed(4)}`);

  console.log('\ncut   flagged  flare followed  caught');
  for (let cut = 10; cut <= 70; cut += 2) {
    let flagged = 0;
    let hits = 0;
    for (let i = 0; i < n; i += 1) {
      if (scores[i] >= cut) {
        flagged += 1;
        hits += labels[i];
      }
    }
    if (flagged < 20) continue;
    const recall = hits / labels.reduce((t, v) => t + v, 0);
    console.log(
      `${String(cut).padStart(3)}   ${(flagged / n).toFixed(3)}    ${(hits / flagged).toFixed(3)}           ${recall.toFixed(3)}`,
    );
  }

  console.log('\nwith the bands currently in rulebook.json:');
  const { elevated, high } = rulebook.bands;
  for (const [name, lo, hi] of [
    ['low', 0, elevated],
    ['elevated', elevated, high],
    ['high', high, 101],
  ] as const) {
    let count = 0;
    let hits = 0;
    for (let i = 0; i < n; i += 1) {
      if (scores[i] >= lo && scores[i] < hi) {
        count += 1;
        hits += labels[i];
      }
    }
    const share = ((count / n) * 100).toFixed(1);
    const rate = count === 0 ? 'n/a' : (hits / count).toFixed(3);
    console.log(`  ${name.padEnd(9)} ${share.padStart(5)}% of days   flare followed ${rate}   (n=${count.toLocaleString()})`);
  }
  console.log('\nPaste flare_rate_when_high / flare_rate_when_low into rulebook.json results.');
}

main();
