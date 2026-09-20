/**
 * Types for `assets/model.json` (REQUIREMENTS §8.6).
 *
 * The shipped model is 39 numbers and their labels. There is no runtime, no
 * ONNX, no TensorFlow Lite — scoring is one dot product and one sigmoid.
 */

export type RiskBand = 'low' | 'elevated' | 'high';

export type FeatureDirection = 'increases' | 'decreases';

export interface ModelFeature {
  /** Snake-case ML feature name, e.g. `stress_lag7`. */
  readonly name: string;
  /** Training-set mean, used both to standardise and to fill gaps (§7.5.2). */
  readonly mean: number;
  readonly std: number;
  /** Coefficient on the standardised feature. */
  readonly coefficient: number;
  /** Display text. §8.6 forbids deriving display strings from `name`. */
  readonly label: string;
  readonly direction: FeatureDirection;
}

export interface ModelMetrics {
  readonly average_precision: number;
  readonly precision_at_threshold: number;
  readonly recall_at_threshold: number;
  readonly base_rate: number;
  readonly n_train_patients: number;
  readonly n_test_patients: number;
}

export interface Model {
  readonly schema_version: number;
  readonly model_version: string;
  readonly trained_at: string;
  readonly model_type: string;
  readonly horizon_hours: number;
  /** Below this many days of history the app shows progress, not a risk (FR-4.2). */
  readonly min_days_required: number;
  readonly threshold: number;
  readonly intercept: number;
  /** L1-zeroed features may be omitted; anything absent counts as zero. */
  readonly features: readonly ModelFeature[];
  readonly metrics: ModelMetrics;
}
