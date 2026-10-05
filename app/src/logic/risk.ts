import {
  buildDailyFrame,
  canPredict,
  checkinDayCount,
  MIN_HISTORY_DAYS,
  RECENT_WINDOW,
} from './frame';
import type { FrameInputRow } from './frame';
import { scoreDay, topDrivers, helpingFactors, type RuleScore } from './engine';
import type { Rulebook, RiskBand } from './rulebook';
import type { CheckIn } from '../types/models';

export type RiskState =
  | { status: 'loading' }
  | { status: 'collecting'; days: number; required: number }
  | { status: 'sparse'; days: number }
  | {
      status: 'ready';
      score: number;
      band: RiskBand;
      date: string;
      drivers: readonly RuleScore[];
      helping: readonly RuleScore[];
      rules: readonly RuleScore[];
      history: readonly DayRules[];
    };

export interface DayRules {
  readonly date: string;
  readonly score: number;
  readonly rules: readonly RuleScore[];
}

// Works out what the Today screen should show.
export function deriveRiskState(rows: readonly FrameInputRow[], book: Rulebook): RiskState {
  const frame = buildDailyFrame(rows);
  const days = checkinDayCount(frame);

  if (days < MIN_HISTORY_DAYS) {
    return { status: 'collecting', days, required: MIN_HISTORY_DAYS };
  }

  const index = frame.dates.length - 1;
  if (index < 0 || !canPredict(frame, index)) {
    return { status: 'sparse', days };
  }

  const result = scoreDay(frame, index, book);
  const first = Math.max(0, index - RECENT_WINDOW + 1);
  const history: DayRules[] = [];
  for (let i = first; i <= index; i += 1) {
    const day = scoreDay(frame, i, book);
    history.push({ date: frame.dates[i], score: day.score, rules: day.rules });
  }
  return {
    status: 'ready',
    score: result.score,
    band: result.band,
    date: frame.dates[index],
    drivers: topDrivers(result),
    helping: helpingFactors(result),
    rules: result.rules,
    history,
  };
}

// Adds an unsaved check-in so the check-in screen can show the new score before saving.
export function withDraftCheckIn(
  rows: readonly FrameInputRow[],
  draft: CheckIn,
): FrameInputRow[] {
  const patch: Partial<FrameInputRow> = {
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
  return [...rows.filter((r) => r.date !== draft.date), merged as FrameInputRow].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
