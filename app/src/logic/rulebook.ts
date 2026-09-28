/**
 * Types for `assets/rulebook.json` — the hand-written points system that
 * replaced the trained model. See `docs/rules-engine-design.md`.
 */

import rulebookJson from '../../assets/rulebook.json';

export type RiskBand = 'low' | 'elevated' | 'high';

export type How = 'today' | 'average' | 'highest' | 'lowest' | 'total';

export interface LookAt {
  readonly column: string;
  readonly how: How;
  /** Days ago, both ends included. `from: 7, to: 14` means days t-14 .. t-7. */
  readonly from?: number;
  readonly to?: number;
}

export interface Rule {
  readonly id: string;
  readonly label: string;
  /** Base variable, for `FACTOR_EXPLANATIONS` and `categoryForVariable`. */
  readonly variable: string;
  /** Most this rule can add. Negative takes points off. */
  readonly points: number;
  readonly look_at: LookAt;
  /** Value scoring nothing. May be greater than `high` when less is worse. */
  readonly low: number;
  readonly high: number;
}

export interface RulebookResults {
  readonly measured_at: string;
  readonly panel_seed: number;
  readonly tested_on_patients: string;
  readonly tested_on_days: number;
  readonly base_rate: number;
  readonly flare_rate_when_high: number;
  readonly flare_rate_when_low: number;
  readonly recall_at_high: number;
  readonly average_precision: number;
  readonly trigger_recovery: number;
  readonly trigger_recovery_by_chance: number;
}

export interface Rulebook {
  readonly schema_version: number;
  readonly rulebook_version: string;
  readonly authored_at: string;
  readonly horizon_hours: number;
  readonly min_days_required: number;
  readonly bands: { readonly elevated: number; readonly high: number };
  readonly results: RulebookResults;
  readonly rules: readonly Rule[];
}

export const rulebook = rulebookJson as unknown as Rulebook;
