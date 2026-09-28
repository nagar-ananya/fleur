/**
 * Guards the hand-written rulebook against the mistakes that would break a
 * screen silently: a rule pointing at a column the frame does not build, or a
 * variable with no explanation copy behind it.
 */

import { rulebook } from '../rulebook';
import { FRAME_COLUMNS } from '../frame';
import { FACTOR_EXPLANATIONS } from '../../constants/copy';
import * as copy from '../../constants/copy';

describe('rulebook', () => {
  it('has unique rule ids', () => {
    const ids = rulebook.rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only looks at columns the daily frame actually builds', () => {
    for (const rule of rulebook.rules) {
      expect(FRAME_COLUMNS).toContain(rule.look_at.column);
    }
  });

  it('has explanation copy for every rule variable', () => {
    for (const rule of rulebook.rules) {
      expect(Object.keys(FACTOR_EXPLANATIONS)).toContain(rule.variable);
    }
  });

  it('gives every windowed rule a from and a to, in that order', () => {
    for (const rule of rulebook.rules) {
      if (rule.look_at.how === 'today') continue;
      expect(rule.look_at.from).toBeDefined();
      expect(rule.look_at.to).toBeDefined();
      expect(rule.look_at.from!).toBeLessThanOrEqual(rule.look_at.to!);
      expect(rule.look_at.to!).toBeLessThanOrEqual(14);
    }
  });

  it('never gives a rule equal marks, which would make it a step', () => {
    for (const rule of rulebook.rules) {
      expect(rule.low).not.toBe(rule.high);
    }
  });

  it('has bands in order inside 0..100', () => {
    expect(rulebook.bands.elevated).toBeGreaterThan(0);
    expect(rulebook.bands.elevated).toBeLessThan(rulebook.bands.high);
    expect(rulebook.bands.high).toBeLessThan(100);
  });

  it('can reach the top band, and the bottom, from its own weights', () => {
    const positive = rulebook.rules
      .filter((r) => r.points > 0)
      .reduce((t, r) => t + r.points, 0);
    expect(positive).toBeGreaterThan(rulebook.bands.high);
    expect(rulebook.rules.some((r) => r.points < 0)).toBe(true);
  });

  it('does not claim a flare frequency anywhere in user-facing copy', () => {
    // The app shows a band and a points score. It makes no claim about how
    // often a flare actually follows — see docs/rules-engine-design.md §1.
    const strings = Object.values(copy).filter((v): v is string => typeof v === 'string');
    for (const text of strings) {
      expect(text.toLowerCase()).not.toContain('of 100 days');
      expect(text.toLowerCase()).not.toContain('followed within three days');
    }
  });
});
