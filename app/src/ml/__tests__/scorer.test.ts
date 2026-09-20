/**
 * Scorer unit tests (REQUIREMENTS §15.2).
 *
 * Required cases: all-mean input returns sigmoid(intercept); a zero-variance
 * feature contributes 0; a missing feature falls back to the training mean.
 * Band boundaries are covered here too.
 */

import type { Model, ModelFeature } from '../model';
import { score, toBand, topContributors, protectiveContributors } from '../scorer';

function feature(overrides: Partial<ModelFeature>): ModelFeature {
  return {
    name: 'stress_lag7',
    mean: 5,
    std: 2,
    coefficient: 0.4,
    label: 'Stress, about a week ago',
    direction: 'increases',
    ...overrides,
  };
}

function makeModel(features: ModelFeature[], intercept = -2.1436, threshold = 0.42): Model {
  return {
    schema_version: 1,
    model_version: 'test',
    trained_at: '2026-01-01T00:00:00Z',
    model_type: 'logistic_regression_l1',
    horizon_hours: 72,
    min_days_required: 14,
    threshold,
    intercept,
    features,
    metrics: {
      average_precision: 0.3,
      precision_at_threshold: 0.5,
      recall_at_threshold: 0.4,
      base_rate: 0.09,
      n_train_patients: 160,
      n_test_patients: 40,
    },
  };
}

const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

describe('score', () => {
  it('returns sigmoid(intercept) when every feature sits at its training mean', () => {
    const model = makeModel([
      feature({ name: 'a', mean: 5, std: 2 }),
      feature({ name: 'b', mean: -3, std: 0.5, coefficient: -1.2 }),
    ]);
    const result = score({ a: 5, b: -3 }, model);
    expect(result.probability).toBeCloseTo(sigmoid(model.intercept), 12);
    expect(result.contributions.every((c) => c.contribution === 0)).toBe(true);
  });

  it('contributes exactly zero for a zero-variance feature', () => {
    const model = makeModel([feature({ name: 'flat', mean: 5, std: 0, coefficient: 3 })]);
    // std < 1e-8 is replaced by 1, so the contribution is coefficient * (raw - mean).
    // Feeding the mean back in must still leave the score untouched.
    const result = score({ flat: 5 }, model);
    expect(result.contributions[0].contribution).toBe(0);
    expect(result.probability).toBeCloseTo(sigmoid(model.intercept), 12);
  });

  it('falls back to the training mean when a feature is missing or null', () => {
    const model = makeModel([feature({ name: 'a', mean: 4, std: 2, coefficient: 0.5 })]);
    const baseline = score({ a: 4 }, model).probability;
    expect(score({ a: null }, model).probability).toBeCloseTo(baseline, 12);
    expect(score({}, model).probability).toBeCloseTo(baseline, 12);
  });

  it('standardises before applying the coefficient', () => {
    const model = makeModel([feature({ name: 'a', mean: 5, std: 2, coefficient: 0.4 })], 0);
    // z = (9 - 5) / 2 = 2, contribution = 0.8
    const result = score({ a: 9 }, model);
    expect(result.contributions[0].contribution).toBeCloseTo(0.8, 12);
    expect(result.probability).toBeCloseTo(sigmoid(0.8), 12);
  });

  it('treats a feature absent from the model as a zero coefficient', () => {
    const model = makeModel([feature({ name: 'a', mean: 0, std: 1, coefficient: 1 })], 0);
    const withExtra = score({ a: 0, unknown_feature: 999 }, model);
    expect(withExtra.probability).toBeCloseTo(0.5, 12);
  });
});

describe('toBand (§9.4)', () => {
  const model = makeModel([], -2, 0.42);
  const lowCeiling = 0.42 * 0.6; // 0.252

  it('maps values below threshold * 0.6 to low', () => {
    expect(toBand(0, model)).toBe('low');
    expect(toBand(lowCeiling - 1e-9, model)).toBe('low');
  });

  it('maps the low/elevated boundary inclusively to elevated', () => {
    expect(toBand(lowCeiling, model)).toBe('elevated');
    expect(toBand(0.41999, model)).toBe('elevated');
  });

  it('maps the threshold itself to high', () => {
    expect(toBand(0.42, model)).toBe('high');
    expect(toBand(1, model)).toBe('high');
  });
});

describe('contributor selection (§9.3)', () => {
  const model = makeModel(
    [
      feature({ name: 'big', mean: 0, std: 1, coefficient: 1 }),
      feature({ name: 'small', mean: 0, std: 1, coefficient: 0.01 }),
      feature({ name: 'protective', mean: 0, std: 1, coefficient: -1 }),
      feature({ name: 'medium', mean: 0, std: 1, coefficient: 0.5 }),
    ],
    0,
  );

  it('ranks by signed contribution and drops anything at or below the floor', () => {
    const result = score({ big: 1, small: 1, protective: 1, medium: 1 }, model);
    const top = topContributors(result);
    expect(top.map((c) => c.name)).toEqual(['big', 'medium']);
  });

  it('never surfaces a risk-lowering factor as a driver', () => {
    const result = score({ big: 1, small: 0, protective: 1, medium: 0 }, model);
    expect(topContributors(result).some((c) => c.name === 'protective')).toBe(false);
    expect(protectiveContributors(result).map((c) => c.name)).toEqual(['protective']);
  });

  it('returns fewer than three when fewer qualify', () => {
    const result = score({ big: 0.5, small: 0, protective: 0, medium: 0 }, model);
    expect(topContributors(result)).toHaveLength(1);
  });
});
