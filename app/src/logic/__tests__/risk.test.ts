import { buildDailyFrame, type FrameInputRow } from '../frame';
import { deriveRiskState, withDraftCheckIn } from '../risk';
import { ruleAverages, scoredDayCount } from '../personal';
import { rulebook } from '../rulebook';
import { emptyCheckIn } from '../../types/models';
import { addDays } from '../../utils/dates';

const START = '2026-01-01';

/** `severities` may contain null to mean "no check-in that day". */
function rows(
  severities: (number | null)[],
  extra: Record<string, unknown> = {},
): FrameInputRow[] {
  return severities.map((severity, index) => ({
    date: addDays(START, index),
    severity,
    ...extra,
  })) as FrameInputRow[];
}

describe('deriveRiskState', () => {
  it('collects until 14 distinct days are logged', () => {
    const state = deriveRiskState(rows([1, 2, 3, 4, 5]), rulebook);
    expect(state.status).toBe('collecting');
    if (state.status === 'collecting') {
      expect(state.days).toBe(5);
      expect(state.required).toBe(14);
    }
  });

  it('is ready once there are 14 logged days and a full recent window', () => {
    const state = deriveRiskState(rows(new Array(20).fill(4)), rulebook);
    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.score).toBeGreaterThanOrEqual(0);
      expect(state.date).toBe(addDays(START, 19));
    }
  });

  it('refuses to score when over 40% of the recent fortnight is missing', () => {
    // 20 logged days, then a long unlogged gap up to today.
    const logged = rows(new Array(20).fill(4));
    const gap: FrameInputRow[] = [{ date: addDays(START, 29), severity: null }];
    const state = deriveRiskState([...logged, ...gap], rulebook);
    expect(state.status).toBe('sparse');
  });

  it('counts only real check-ins towards the 14, not filled gaps', () => {
    const withGaps = rows([1, 2, null, 4, null, 6, 7, null, 9, 10]);
    const state = deriveRiskState(withGaps, rulebook);
    expect(state.status).toBe('collecting');
    if (state.status === 'collecting') expect(state.days).toBe(7);
  });

  it('returns collecting, not a crash, for no data at all', () => {
    expect(deriveRiskState([], rulebook).status).toBe('collecting');
  });
});

describe('withDraftCheckIn', () => {
  it('splices a draft in without mutating the original rows', () => {
    const original = rows([1, 2, 3]);
    const snapshot = JSON.stringify(original);
    const draft = { ...emptyCheckIn(addDays(START, 3)), severity: 9, stress: 8 };

    const merged = withDraftCheckIn(original, draft);

    expect(JSON.stringify(original)).toBe(snapshot);
    expect(merged).toHaveLength(4);
    expect(merged[3].severity).toBe(9);
    expect(merged[3].stress).toBe(8);
  });

  it('overwrites an existing day rather than duplicating it', () => {
    const original = rows([1, 2, 3]);
    const draft = { ...emptyCheckIn(addDays(START, 1)), severity: 7 };

    const merged = withDraftCheckIn(original, draft);

    expect(merged).toHaveLength(3);
    expect(merged[1].severity).toBe(7);
  });

  it('changes the score the preview would show', () => {
    const base = rows(new Array(20).fill(2));
    const before = deriveRiskState(base, rulebook);
    const draft = { ...emptyCheckIn(addDays(START, 19)), severity: 10 };
    const after = deriveRiskState(withDraftCheckIn(base, draft), rulebook);

    expect(before.status).toBe('ready');
    expect(after.status).toBe('ready');
    if (before.status === 'ready' && after.status === 'ready') {
      expect(after.score).toBeGreaterThan(before.score);
    }
  });
});

describe('ruleAverages', () => {
  it('puts a consistently high factor at the top', () => {
    const frame = buildDailyFrame(rows(new Array(30).fill(3), { stress: 9, sleep_hours: 7.5 }));
    const averages = ruleAverages(frame, rulebook);
    expect(averages[0].id).toBe('stress');
    expect(averages[0].averagePoints).toBeGreaterThan(10);
    expect(averages[0].days).toBeGreaterThan(0);
  });

  it('leaves out rules the person never logged', () => {
    const frame = buildDailyFrame(rows(new Array(30).fill(3), { stress: 9 }));
    const ids = ruleAverages(frame, rulebook).map((r) => r.id);
    expect(ids).not.toContain('pollution');
    expect(ids).not.toContain('cold_snap');
  });

  it('is empty when there is not enough history to score any day', () => {
    const frame = buildDailyFrame(rows([1, 2, 3, 4, 5]));
    expect(ruleAverages(frame, rulebook)).toEqual([]);
    expect(scoredDayCount(frame)).toBe(0);
  });
});
