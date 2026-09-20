/**
 * §15.1 PARITY TEST — BLOCKING.
 *
 * The single most important test in the project. `ml/features.py` and
 * `src/ml/features.ts` implement the same 95-feature spec twice; when they
 * drift, the app produces wrong predictions silently and nothing throws.
 *
 * Fixtures come from `ml/export.py`: real windows out of the held-out test
 * patients, carrying the raw daily rows plus every feature value and the final
 * probability as Python computed them. Regenerate them whenever either
 * implementation changes.
 */

import fixtureData from '../__fixtures__/parity_fixtures.json';
import modelData from '../../../assets/model.json';
import { FEATURE_NAMES, latestFeatureVector, type FeatureInputRow } from '../features';
import { score, toBand } from '../scorer';
import type { Model } from '../model';

const TOLERANCE = 1e-6;

const model = modelData as unknown as Model;

interface Fixture {
  id: string;
  patient_id: number;
  target_date: string;
  description: string;
  missing_checkin_days: number;
  longest_gap_days: number;
  dropped_dates: string[];
  rows: FeatureInputRow[];
  expected_can_predict: boolean;
  expected_features: Record<string, number | null>;
  expected_probability: number;
  expected_band: string;
  expected_top_contributions: { name: string; contribution: number }[];
}

const fixtures = (fixtureData as unknown as { fixtures: Fixture[] }).fixtures;

describe('§15.1 Python/TypeScript feature parity', () => {
  it('ships the fixture set the spec requires', () => {
    // TEST-1: ten hand-picked windows.
    expect(fixtures).toHaveLength(10);
    // TEST-4: at least two must exercise the §7.5 missing-data policy.
    const withGaps = fixtures.filter((f) => f.missing_checkin_days > 0);
    expect(withGaps.length).toBeGreaterThanOrEqual(2);
  });

  it('was generated from the model version the app bundles', () => {
    const meta = fixtureData as unknown as { model_version: string; threshold: number };
    expect(meta.model_version).toBe(model.model_version);
    expect(meta.threshold).toBeCloseTo(model.threshold, 10);
  });

  describe.each(fixtures.map((f) => [f.id, f] as const))('%s', (_id, fixture) => {
    const actual = latestFeatureVector(fixture.rows);

    it(`matches all 95 features — ${fixture.description}`, () => {
      const mismatches: string[] = [];

      for (const name of FEATURE_NAMES) {
        const expected = fixture.expected_features[name];
        const got = actual.vector[name];

        if (expected === null || expected === undefined) {
          if (got !== null && got !== undefined) {
            mismatches.push(`${name}: expected null, got ${got}`);
          }
          continue;
        }
        if (got === null || got === undefined) {
          mismatches.push(`${name}: expected ${expected}, got null`);
          continue;
        }
        if (Math.abs(got - expected) > TOLERANCE) {
          mismatches.push(`${name}: expected ${expected}, got ${got} (Δ${got - expected})`);
        }
      }

      expect(mismatches).toEqual([]);
    });

    it('agrees on whether there is enough recent data to score', () => {
      expect(actual.canPredict).toBe(fixture.expected_can_predict);
    });

    it('produces the same probability and band', () => {
      const result = score(actual.vector, model);
      expect(Math.abs(result.probability - fixture.expected_probability)).toBeLessThan(TOLERANCE);
      expect(result.band).toBe(fixture.expected_band);
      expect(toBand(fixture.expected_probability, model)).toBe(fixture.expected_band);
    });

    it('ranks the same top contributors', () => {
      const result = score(actual.vector, model);
      const top = [...result.contributions]
        .sort((a, b) => b.contribution - a.contribution)
        .slice(0, 3);
      expect(top.map((c) => c.name)).toEqual(
        fixture.expected_top_contributions.map((c) => c.name),
      );
      top.forEach((c, i) => {
        expect(Math.abs(c.contribution - fixture.expected_top_contributions[i].contribution))
          .toBeLessThan(TOLERANCE);
      });
    });
  });
});
