/**
 * Looking up the one number a rule cares about, and turning it into a
 * fraction between its two marks.
 */

import type { LookAt } from './rulebook';
import type { Series } from './frame';

/**
 * The value a rule looks at for the day at `index`, or null when no day in its
 * window carried data. Null means the rule scores nothing — never a guess.
 */
export function lookUp(
  columns: Readonly<Record<string, Series>>,
  spec: LookAt,
  index: number,
): number | null {
  const series = columns[spec.column];
  if (!series) return null;

  const from = spec.how === 'today' ? 0 : (spec.from ?? 0);
  const to = spec.how === 'today' ? 0 : (spec.to ?? 0);

  const values: number[] = [];
  for (let i = Math.max(0, index - to); i <= index - from; i += 1) {
    const v = series[i];
    if (v !== null && v !== undefined) values.push(v);
  }
  if (values.length === 0) return null;

  switch (spec.how) {
    case 'today':
      return values[values.length - 1];
    case 'average':
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    case 'total':
      return values.reduce((sum, v) => sum + v, 0);
    case 'highest':
      return Math.max(...values);
    case 'lowest':
      return Math.min(...values);
  }
}

/**
 * How far along its marks a value sits, 0 to 1. `high` below `low` is normal —
 * that is how "less sleep is worse" is expressed — and needs no special case.
 */
export function fraction(value: number, low: number, high: number): number {
  if (low === high) return value >= low ? 1 : 0;
  const f = (value - low) / (high - low);
  // `<= 0` rather than `< 0` so a backwards ramp at its low mark returns 0, not -0.
  return f <= 0 ? 0 : f > 1 ? 1 : f;
}
