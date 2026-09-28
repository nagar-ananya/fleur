/**
 * The only data that ever leaves the phone (§17.3).
 *
 * Fourteen rows of numbers. No name, no dates, no location, no notes, no
 * profile — `day` is a relative offset, and the weather figures carry nothing
 * that says where they came from.
 */

import type { DailyFrame } from '../logic/frame';

export const PAYLOAD_DAYS = 14;

export interface DayRow {
  /** -13 .. 0, where 0 is today. */
  day: number;
  severity: number | null;
  itch: number | null;
  stress: number | null;
  sleep_hours: number | null;
  alcohol_units: number | null;
  /** Not a rule. Sent so we can see whether the AI over-reads a popular belief. */
  diet_dairy: number | null;
  diet_processed: number | null;
  diet_sugar: number | null;
  illness: number | null;
  sore_throat: number | null;
  skin_injury: number | null;
  temp_c: number | null;
  uv: number | null;
  pm2_5: number | null;
}

/** Columns to send, and what to call them on the wire. */
const FIELDS: readonly (readonly [string, string])[] = [
  ['severity', 'severity'],
  ['itch', 'itch'],
  ['stress', 'stress'],
  ['sleep_hours', 'sleep_hours'],
  ['alcohol_units', 'alcohol_units'],
  ['diet_dairy', 'diet_dairy'],
  ['diet_processed', 'diet_processed'],
  ['diet_sugar', 'diet_sugar'],
  ['illness', 'illness'],
  ['sore_throat', 'sore_throat'],
  ['skin_injury', 'skin_injury'],
  ['temp_c', 'temp_mean_c'],
  ['uv', 'uv_index_max'],
  ['pm2_5', 'pm2_5'],
];

function round1(value: number | null): number | null {
  if (value === null) return null;
  return Math.round(value * 10) / 10;
}

export function buildPayload(frame: DailyFrame, index: number): DayRow[] {
  const rows: DayRow[] = [];

  for (let offset = PAYLOAD_DAYS - 1; offset >= 0; offset -= 1) {
    const i = index - offset;
    const row: Record<string, number | null> = { day: -offset };
    for (const [outName, column] of FIELDS) {
      const series = frame.columns[column];
      const value = i >= 0 && series ? series[i] : null;
      row[outName] = round1(value ?? null);
    }
    rows.push(row as unknown as DayRow);
  }

  return rows;
}
