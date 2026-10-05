import type { LookAt } from './rulebook';
import type { Series } from './frame';

// Gets the number a rule looks at, like the average stress from 7 to 14 days ago.
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

// 0 at the low mark, 1 at the high mark, and a straight line in between.
export function fraction(value: number, low: number, high: number): number {
  if (low === high) return value >= low ? 1 : 0;
  const f = (value - low) / (high - low);
  return f <= 0 ? 0 : f > 1 ? 1 : f;
}
