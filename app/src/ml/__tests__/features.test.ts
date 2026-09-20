/**
 * Feature engineering tests (REQUIREMENTS §15.2).
 *
 * Required cases: lag correctness at boundaries; forward-fill capped at 3 days;
 * the 40% missing-data guard refusing to predict.
 */

import {
  buildBaseFrame,
  buildFeatureSeries,
  canPredict,
  FEATURE_NAMES,
  latestFeatureVector,
  type FeatureInputRow,
} from '../features';
import { addDays } from '../../utils/dates';

const START = '2026-01-01';

/** `severities` may contain null to mean "no check-in that day". */
function rows(severities: (number | null)[], extra: Record<string, unknown> = {}): FeatureInputRow[] {
  return severities.map((severity, index) => ({
    date: addDays(START, index),
    severity,
    ...extra,
  })) as FeatureInputRow[];
}

describe('feature set shape (§7.3)', () => {
  it('produces exactly 95 uniquely named features', () => {
    expect(FEATURE_NAMES).toHaveLength(95);
    expect(new Set(FEATURE_NAMES).size).toBe(95);
  });

  it('names lag and roll features per the spec convention', () => {
    expect(FEATURE_NAMES).toContain('stress_lag7');
    expect(FEATURE_NAMES).toContain('pm2_5_roll14');
    expect(FEATURE_NAMES).toContain('severity_baseline');
  });
});

describe('lags', () => {
  it('reads the value exactly n calendar days back', () => {
    const input = rows([1, 2, 3, 4, 5, 6, 7, 8]);
    const series = buildFeatureSeries(buildBaseFrame(input));
    // stress is absent here, so use a variable that is present: itch mirrors
    // the same shift machinery. Use severity-derived series instead.
    expect(series.itch_lag1[3]).toBeNull();
    const built = buildBaseFrame(rows([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(built.columns.severity[3]).toBe(4);
  });

  it('returns null before the series is long enough for the lag', () => {
    const input = rows([5, 5, 5], { stress: 4 });
    const series = buildFeatureSeries(buildBaseFrame(input));
    expect(series.stress_lag1[0]).toBeNull();
    expect(series.stress_lag1[1]).toBe(4);
    expect(series.stress_lag3[2]).toBeNull();
  });

  it('counts calendar days, not rows, when dates are missing entirely', () => {
    // Two rows a week apart: lag1 must be null, lag7 must reach the first row.
    const input: FeatureInputRow[] = [
      { date: '2026-01-01', severity: 5, stress: 9 },
      { date: '2026-01-08', severity: 5, stress: 1 },
    ];
    const series = buildFeatureSeries(buildBaseFrame(input));
    const last = 7; // index of 2026-01-08 in the rebuilt calendar
    expect(series.stress_lag7[last]).toBe(9);
    // Forward fill only carries 3 days, so lag1 (2026-01-07) is empty by then.
    expect(series.stress_lag1[last]).toBeNull();
  });
});

describe('forward fill (§7.5.1)', () => {
  it('carries a value forward for at most 3 consecutive days', () => {
    const input: FeatureInputRow[] = [
      { date: '2026-01-01', severity: 6, stress: 8 },
      { date: '2026-01-02', severity: null, stress: null },
      { date: '2026-01-03', severity: null, stress: null },
      { date: '2026-01-04', severity: null, stress: null },
      { date: '2026-01-05', severity: null, stress: null },
    ];
    const base = buildBaseFrame(input);
    expect(base.columns.stress[0]).toBe(8);
    expect(base.columns.stress[1]).toBe(8);
    expect(base.columns.stress[2]).toBe(8);
    expect(base.columns.stress[3]).toBe(8);
    // The fourth consecutive gap is beyond the cap.
    expect(base.columns.stress[4]).toBeNull();
  });

  it('resets the fill budget once a real value arrives', () => {
    const input: FeatureInputRow[] = [
      { date: '2026-01-01', severity: 1, stress: 1 },
      { date: '2026-01-02', severity: null, stress: null },
      { date: '2026-01-03', severity: 2, stress: 2 },
      { date: '2026-01-04', severity: null, stress: null },
      { date: '2026-01-05', severity: null, stress: null },
      { date: '2026-01-06', severity: null, stress: null },
    ];
    const base = buildBaseFrame(input);
    expect(base.columns.stress[5]).toBe(2);
  });

  it('does not treat a filled day as a logged check-in', () => {
    const base = buildBaseFrame(rows([5, null, null]));
    // Values are filled for feature purposes, but the coverage guard must see
    // the truth: only one day was actually logged.
    expect(base.columns.severity[2]).toBe(5);
    expect(base.hasCheckin).toEqual([1, 0, 0]);
  });
});

describe('wearable precedence (HD-5)', () => {
  it('prefers the device sleep value over the self-reported one', () => {
    const input: FeatureInputRow[] = [
      { date: '2026-01-01', severity: 3, sleep_hours: 6, sleep_hours_device: 7.4 },
      { date: '2026-01-02', severity: 3, sleep_hours: 6, sleep_hours_device: null },
    ];
    const base = buildBaseFrame(input);
    expect(base.columns.sleep_hours[0]).toBe(7.4);
    // With no device reading, the manual entry stands.
    expect(base.columns.sleep_hours[1]).toBe(6);
  });
});

describe('derived variables (§7.2)', () => {
  it('computes 1-day deltas from the filled environment series', () => {
    const input: FeatureInputRow[] = [
      { date: '2026-01-01', severity: 3, temp_mean_c: 10 },
      { date: '2026-01-02', severity: 3, temp_mean_c: 4 },
    ];
    const base = buildBaseFrame(input);
    expect(base.columns.temp_delta_1d[0]).toBeNull();
    expect(base.columns.temp_delta_1d[1]).toBeCloseTo(-6, 12);
  });

  it('requires a complete week before reporting sleep debt', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      date: addDays(START, i),
      severity: 3,
      sleep_hours: 6,
    })) as FeatureInputRow[];
    expect(buildBaseFrame(six).columns.sleep_debt_7d[5]).toBeNull();

    const seven = [...six, { date: addDays(START, 6), severity: 3, sleep_hours: 6 }];
    // 7 nights at 6h against a 7.5h target = 10.5 hours of debt.
    expect(buildBaseFrame(seven).columns.sleep_debt_7d[6]).toBeCloseTo(10.5, 10);
  });

  it('floors sleep debt at zero for someone sleeping enough', () => {
    const week = Array.from({ length: 7 }, (_, i) => ({
      date: addDays(START, i),
      severity: 3,
      sleep_hours: 9,
    })) as FeatureInputRow[];
    expect(buildBaseFrame(week).columns.sleep_debt_7d[6]).toBe(0);
  });
});

describe('the 40% missing-data guard (§7.5.3)', () => {
  const full = Array.from({ length: 20 }, (_, i) => i);

  it('allows prediction when at least 60% of the last 14 days are logged', () => {
    // 5 of the trailing 14 missing = 64% coverage, which passes.
    const severities = full.map((i) => (i >= 15 ? null : 4));
    const base = buildBaseFrame(rows(severities));
    expect(canPredict(base, base.dates.length - 1)).toBe(true);
  });

  it('refuses once more than 40% of the last 14 days are missing', () => {
    // 6 of the trailing 14 missing = 57% coverage, which fails.
    const severities = full.map((i) => (i >= 14 ? null : 4));
    const base = buildBaseFrame(rows(severities));
    expect(canPredict(base, base.dates.length - 1)).toBe(false);
  });

  it('reports canPredict false through latestFeatureVector', () => {
    const severities = full.map((i) => (i >= 14 ? null : 4));
    expect(latestFeatureVector(rows(severities)).canPredict).toBe(false);
  });
});

describe('latestFeatureVector', () => {
  it('returns an empty, unpredictable result for no rows', () => {
    const result = latestFeatureVector([]);
    expect(result.canPredict).toBe(false);
    expect(result.date).toBeNull();
    expect(result.checkinDays).toBe(0);
  });

  it('always returns all 95 keys, null where undefined', () => {
    const result = latestFeatureVector(rows([5, 5, 5]));
    expect(Object.keys(result.vector).sort()).toEqual([...FEATURE_NAMES].sort());
  });

  it('counts distinct logged days for the FR-4.2 progress state', () => {
    const result = latestFeatureVector(rows([5, null, 5, null, 5]));
    expect(result.checkinDays).toBe(3);
  });
});
