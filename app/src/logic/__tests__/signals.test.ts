import { fraction, lookUp } from '../signals';
import type { Series } from '../frame';

describe('fraction', () => {
  it('is 0 at or below the low mark and 1 at or above the high mark', () => {
    expect(fraction(2, 2, 8)).toBe(0);
    expect(fraction(1, 2, 8)).toBe(0);
    expect(fraction(8, 2, 8)).toBe(1);
    expect(fraction(99, 2, 8)).toBe(1);
  });

  it('is linear in between', () => {
    expect(fraction(5, 2, 8)).toBeCloseTo(0.5, 10);
    expect(fraction(3.5, 2, 8)).toBeCloseTo(0.25, 10);
  });

  it('handles marks that run backwards, for "less is worse"', () => {
    // Sleep: 8 hours scores nothing, 5 hours scores everything.
    expect(fraction(8, 8, 5)).toBe(0);
    expect(fraction(5, 8, 5)).toBe(1);
    expect(fraction(6.5, 8, 5)).toBeCloseTo(0.5, 10);
    expect(fraction(9, 8, 5)).toBe(0);
    // Cold snap.
    expect(fraction(-2, -2, -8)).toBe(0);
    expect(fraction(-8, -2, -8)).toBe(1);
    expect(fraction(-5, -2, -8)).toBeCloseTo(0.5, 10);
  });

  it('treats equal marks as a step', () => {
    expect(fraction(1, 1, 1)).toBe(1);
    expect(fraction(0, 1, 1)).toBe(0);
  });
});

describe('lookUp', () => {
  // 0..20, so a value equals its own index and windows are easy to check.
  const columns: Record<string, Series> = {
    n: Array.from({ length: 21 }, (_, i) => i),
    gappy: Array.from({ length: 21 }, (_, i) => (i % 2 === 0 ? i : null)),
    empty: new Array(21).fill(null),
  };

  it('reads both ends of the window inclusively', () => {
    // from 7 to 14 at index 20 means indices 6..13.
    expect(lookUp(columns, { column: 'n', how: 'lowest', from: 7, to: 14 }, 20)).toBe(6);
    expect(lookUp(columns, { column: 'n', how: 'highest', from: 7, to: 14 }, 20)).toBe(13);
  });

  it('"today" reads the index itself and ignores from/to', () => {
    expect(lookUp(columns, { column: 'n', how: 'today' }, 20)).toBe(20);
    expect(lookUp(columns, { column: 'n', how: 'today', from: 7, to: 14 }, 20)).toBe(20);
  });

  it('clips a window that runs off the start without throwing', () => {
    expect(lookUp(columns, { column: 'n', how: 'lowest', from: 0, to: 6 }, 2)).toBe(0);
    expect(lookUp(columns, { column: 'n', how: 'highest', from: 0, to: 6 }, 2)).toBe(2);
  });

  it('returns null when nothing in the window has data', () => {
    expect(lookUp(columns, { column: 'empty', how: 'average', from: 0, to: 6 }, 20)).toBeNull();
    expect(lookUp(columns, { column: 'nope', how: 'average', from: 0, to: 6 }, 20)).toBeNull();
  });

  it('skips missing days rather than counting them as zero', () => {
    // Indices 18,19,20 -> 18, null, 20. Mean of the two present values is 19.
    expect(lookUp(columns, { column: 'gappy', how: 'average', from: 0, to: 2 }, 20)).toBe(19);
    expect(lookUp(columns, { column: 'gappy', how: 'total', from: 0, to: 2 }, 20)).toBe(38);
  });

  it('averages and totals what it finds', () => {
    expect(lookUp(columns, { column: 'n', how: 'average', from: 0, to: 2 }, 20)).toBe(19);
    expect(lookUp(columns, { column: 'n', how: 'total', from: 0, to: 2 }, 20)).toBe(57);
  });
});
