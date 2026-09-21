/**
 * Pure risk derivation — factored out of `appState.tsx` so the same logic
 * that decides what the Today screen shows can also power a side-effect-free
 * preview (the check-in review step's "outlook after saving").
 *
 * No I/O here: given rows and a model, `deriveRiskState` always returns the
 * same answer. `AppProvider.recompute` is the only caller that also persists
 * a prediction row — that stays in `appState.tsx`, since logging every score
 * ever computed (§6.5) is exactly the side effect a preview must not have.
 */

import type { FeatureInputRow } from './features';
import { latestFeatureVector, MIN_HISTORY_DAYS } from './features';
import type { Model } from './model';
import { protectiveContributors, score, topContributors, type Contribution } from './scorer';
import type { CheckIn, RiskBand } from '../types/models';

export type RiskState =
  | { status: 'loading' }
  /** Fewer than `min_days_required` distinct check-in days (FR-4.2). */
  | { status: 'collecting'; days: number; required: number }
  /** Enough history overall, but too much of the recent window is missing (§7.5.3). */
  | { status: 'sparse'; days: number }
  | {
      status: 'ready';
      probability: number;
      band: RiskBand;
      date: string;
      drivers: readonly Contribution[];
      protective: readonly Contribution[];
    };

export function deriveRiskState(rows: readonly FeatureInputRow[], model: Model): RiskState {
  const { vector, canPredict, checkinDays: days, date } = latestFeatureVector(rows);

  if (days < MIN_HISTORY_DAYS) {
    return { status: 'collecting', days, required: MIN_HISTORY_DAYS };
  }
  if (!canPredict || date === null) {
    return { status: 'sparse', days };
  }

  const result = score(vector, model);
  return {
    status: 'ready',
    probability: result.probability,
    band: result.band,
    date,
    drivers: topContributors(result),
    protective: protectiveContributors(result),
  };
}

/**
 * Splice a not-yet-saved check-in draft into a set of feature rows, for a
 * preview. Mirrors exactly the fields `loadFeatureInputRows` reads off a
 * `checkin` row (§7.1) — `newProduct` and `medTaken` are correctly absent,
 * since neither is a model input.
 *
 * Pure: `rows` is never mutated, and nothing here touches the database. The
 * check-in step 5 preview is the only caller — a real save always goes
 * through `saveCheckIn` + `AppProvider.recompute`.
 */
export function withDraftCheckIn(
  rows: readonly FeatureInputRow[],
  draft: CheckIn,
): FeatureInputRow[] {
  const patch: Partial<FeatureInputRow> = {
    severity: draft.severity,
    itch: draft.itch,
    stress: draft.stress,
    sleep_hours: draft.sleepHours,
    water_glasses: draft.waterGlasses,
    alcohol_units: draft.alcoholUnits,
    diet_dairy: draft.dietDairy ? 1 : 0,
    diet_gluten: draft.dietGluten ? 1 : 0,
    diet_processed: draft.dietProcessed ? 1 : 0,
    diet_sugar: draft.dietSugar ? 1 : 0,
    diet_red_meat: draft.dietRedMeat ? 1 : 0,
    illness: draft.illness ? 1 : 0,
    sore_throat: draft.soreThroat ? 1 : 0,
    skin_injury: draft.skinInjury ? 1 : 0,
  };

  const existing = rows.find((r) => r.date === draft.date);
  const merged = existing ? { ...existing, ...patch } : { date: draft.date, ...patch };
  return [...rows.filter((r) => r.date !== draft.date), merged as FeatureInputRow].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
