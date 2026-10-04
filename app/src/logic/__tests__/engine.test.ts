import { buildDailyFrame, type FrameInputRow } from '../frame';
import { bandFor, helpingFactors, scoreDay, topDrivers, wholeParts } from '../engine';
import { rulebook } from '../rulebook';

const DAYS = 20;

/** Dates day 0 .. day 19; index 19 is the day being scored. */
function dates(): string[] {
  const out: string[] = [];
  for (let i = 0; i < DAYS; i += 1) {
    out.push(`2026-03-${String(i + 1).padStart(2, '0')}`);
  }
  return out;
}

/**
 * The worked example from docs/rules-engine-design.md §10: skin sat at 3 for a
 * fortnight and is 5 today, stress averaged 7 a week or two back, sleep has
 * averaged 7.2 hours, PM2.5 22, UV 3, nothing else logged.
 */
function workedExample(): FrameInputRow[] {
  return dates().map((date, i) => ({
    date,
    severity: i === DAYS - 1 ? 5 : 3,
    // Days 7..14 back from index 19 are indices 5..12.
    stress: i >= 5 && i <= 12 ? 7 : 3,
    sleep_hours: 7.2,
    uv_index_max: 3,
    pm2_5: 22,
    temp_mean_c: 12,
  }));
}

describe('scoreDay — the §10 worked example', () => {
  const frame = buildDailyFrame(workedExample());
  const result = scoreDay(frame, frame.dates.length - 1, rulebook);
  const points = (id: string): number => result.rules.find((r) => r.id === id)?.points ?? 0;

  it('scores 31 and reads Elevated', () => {
    expect(result.score).toBe(31);
    expect(result.band).toBe('elevated');
  });

  it('gives each rule the points the table says', () => {
    // severity 5 against a 14-day mean of 44/14 = 3.142857 -> delta 1.857143.
    expect(points('skin_climbing')).toBeCloseTo(13.929, 2);
    expect(points('stress')).toBeCloseTo(12.5, 3);
    expect(points('short_sleep')).toBeCloseTo(4.0, 3);
    expect(points('pollution')).toBeCloseTo(2.4, 3);
    expect(points('sunshine')).toBeCloseTo(-2, 3);
  });

  it('orders the drivers skin, stress, sleep', () => {
    expect(topDrivers(result).map((r) => r.id)).toEqual([
      'skin_climbing',
      'stress',
      'short_sleep',
    ]);
  });

  it('reports sunshine as the thing helping', () => {
    expect(helpingFactors(result).map((r) => r.id)).toEqual(['sunshine']);
  });

  it('leaves out rules with nothing to look at', () => {
    const ids = result.rules.map((r) => r.id);
    expect(ids).not.toContain('illness');
    expect(ids).not.toContain('alcohol');
    expect(ids).not.toContain('processed_food');
  });
});

describe('bands', () => {
  it('cuts at 30 and 50', () => {
    expect(bandFor(0, rulebook)).toBe('low');
    expect(bandFor(29, rulebook)).toBe('low');
    expect(bandFor(30, rulebook)).toBe('elevated');
    expect(bandFor(49, rulebook)).toBe('elevated');
    expect(bandFor(50, rulebook)).toBe('high');
    expect(bandFor(100, rulebook)).toBe('high');
  });

  it('agrees with the score the engine reports, through the rounding', () => {
    // Drive the score up by raising today's severity and check the pairing.
    for (const severity of [3, 4, 5, 6, 7, 8, 9, 10]) {
      const rows = workedExample().map((row, i) =>
        i === DAYS - 1 ? { ...row, severity } : row,
      );
      const frame = buildDailyFrame(rows);
      const result = scoreDay(frame, frame.dates.length - 1, rulebook);
      expect(result.band).toBe(bandFor(result.score, rulebook));
    }
  });
});

describe('missing data', () => {
  it('scores from severity alone without throwing', () => {
    const rows: FrameInputRow[] = dates().map((date, i) => ({
      date,
      severity: i === DAYS - 1 ? 8 : 2,
    }));
    const frame = buildDailyFrame(rows);
    const result = scoreDay(frame, frame.dates.length - 1, rulebook);

    expect(result.score).toBeGreaterThan(0);
    const ids = result.rules.map((r) => r.id);
    expect(ids).toContain('skin_climbing');
    expect(ids).not.toContain('pollution');
    expect(ids).not.toContain('cold_snap');
    expect(ids).not.toContain('sunshine');
  });

  it('never returns a score outside 0..100', () => {
    const everything: FrameInputRow[] = dates().map((date, i) => ({
      date,
      severity: i === DAYS - 1 ? 10 : 0,
      stress: 10,
      sleep_hours: 3,
      itch: 10,
      alcohol_units: 10,
      diet_processed: 1,
      illness: 1,
      sore_throat: 1,
      skin_injury: 1,
      pm2_5: 90,
      uv_index_max: 0,
      temp_mean_c: i === DAYS - 2 ? -20 : 15,
    }));
    const frame = buildDailyFrame(everything);
    const result = scoreDay(frame, frame.dates.length - 1, rulebook);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('wholeParts', () => {
  it('rounds each part so they add up to the rounded total', () => {
    const values = [20.4, 9.6, 4.4, 3.3, -2.6];
    const parts = wholeParts(values);
    expect(parts.every(Number.isInteger)).toBe(true);
    expect(parts.reduce((t, v) => t + v, 0)).toBe(Math.round(values.reduce((t, v) => t + v, 0)));
    parts.forEach((p, i) => expect(Math.abs(p - values[i])).toBeLessThan(1));
  });
});
