/**
 * On-device scoring (REQUIREMENTS §9).
 *
 * Pure functions, no I/O, no async. §11.2 requires the Today screen to render
 * a risk value within 200ms of mount, which this comfortably satisfies —
 * it is 39 multiply-adds.
 */

import type { Model, ModelFeature, RiskBand } from './model';

export interface Contribution {
  readonly name: string;
  readonly label: string;
  /** Signed; positive raises risk. */
  readonly contribution: number;
  readonly direction: ModelFeature['direction'];
}

export interface ScoreResult {
  /** 0..1 */
  readonly probability: number;
  readonly band: RiskBand;
  /** Unsorted; the caller sorts. */
  readonly contributions: readonly Contribution[];
}

/** §9.3: a factor must clear this to be shown as driving risk up. */
export const CONTRIBUTION_FLOOR = 0.05;
export const TOP_CONTRIBUTOR_COUNT = 3;

/** §9.4 band boundaries, as a fraction of the model's threshold. */
export const ELEVATED_BAND_RATIO = 0.6;

export function toBand(probability: number, model: Pick<Model, 'threshold'>): RiskBand {
  if (probability < model.threshold * ELEVATED_BAND_RATIO) return 'low';
  if (probability < model.threshold) return 'elevated';
  return 'high';
}

export function score(
  featureVector: Readonly<Record<string, number | null>>,
  model: Model,
): ScoreResult {
  let z = model.intercept;
  const contributions: Contribution[] = [];

  for (const f of model.features) {
    const value = featureVector[f.name];
    // §7.5.2: anything still missing falls back to the training mean, which
    // standardises to zero and therefore contributes nothing.
    const raw = value === null || value === undefined ? f.mean : value;
    const std = f.std < 1e-8 ? 1 : f.std;
    const zScore = (raw - f.mean) / std;
    const contribution = f.coefficient * zScore;
    z += contribution;
    contributions.push({
      name: f.name,
      label: f.label,
      contribution,
      direction: f.direction,
    });
  }

  const probability = sigmoid(z);
  return { probability, band: toBand(probability, model), contributions };
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/**
 * §9.3: the factors currently pushing risk up, strongest first.
 *
 * Sorted on the signed contribution, never the absolute value — a factor that
 * is *lowering* risk must never be presented as something to worry about.
 */
export function topContributors(
  result: ScoreResult,
  limit: number = TOP_CONTRIBUTOR_COUNT,
): readonly Contribution[] {
  return [...result.contributions]
    .filter((c) => c.contribution > CONTRIBUTION_FLOOR)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, limit);
}

/** Factors currently pulling risk down, for the balanced view on §11 risk detail. */
export function protectiveContributors(
  result: ScoreResult,
  limit: number = TOP_CONTRIBUTOR_COUNT,
): readonly Contribution[] {
  return [...result.contributions]
    .filter((c) => c.contribution < -CONTRIBUTION_FLOOR)
    .sort((a, b) => a.contribution - b.contribution)
    .slice(0, limit);
}
