import type { DailyFrame } from './frame';
import { fraction, lookUp } from './signals';
import type { RiskBand, Rulebook } from './rulebook';

export interface RuleScore {
  readonly id: string;
  readonly label: string;
  readonly variable: string;
  readonly points: number;
  readonly maxPoints: number;
  readonly direction: 'increases' | 'decreases';
}

export interface RiskScore {
  readonly score: number;
  readonly band: RiskBand;
  readonly rules: readonly RuleScore[];
}

export const POINTS_FLOOR = 1;
export const TOP_RULE_COUNT = 3;

// Low under 30, Elevated 30-49, High 50 and up (set in rulebook.json).
export function bandFor(score: number, book: Rulebook): RiskBand {
  if (score >= book.bands.high) return 'high';
  if (score >= book.bands.elevated) return 'elevated';
  return 'low';
}

// Adds up the points from every rule for one day.
export function scoreDay(frame: DailyFrame, index: number, book: Rulebook): RiskScore {
  const rules: RuleScore[] = [];
  let total = 0;

  for (const rule of book.rules) {
    const value = lookUp(frame.columns, rule.look_at, index);
    if (value === null) continue;

    const points = rule.points * fraction(value, rule.low, rule.high);
    total += points;

    rules.push({
      id: rule.id,
      label: rule.label,
      variable: rule.variable,
      points,
      maxPoints: rule.points,
      direction: rule.points >= 0 ? 'increases' : 'decreases',
    });
  }

  const score = Math.round(Math.min(100, Math.max(0, total)));
  return { score, band: bandFor(score, book), rules };
}

export function topDrivers(result: RiskScore, limit = TOP_RULE_COUNT): readonly RuleScore[] {
  return [...result.rules]
    .filter((r) => r.points > POINTS_FLOOR)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

export function helpingFactors(result: RiskScore, limit = TOP_RULE_COUNT): readonly RuleScore[] {
  return [...result.rules]
    .filter((r) => r.points < -POINTS_FLOOR)
    .sort((a, b) => a.points - b.points)
    .slice(0, limit);
}

export function wholeParts(values: readonly number[]): number[] {
  const floors = values.map(Math.floor);
  let short = Math.round(values.reduce((t, v) => t + v, 0)) - floors.reduce((t, v) => t + v, 0);
  const order = values
    .map((v, i) => ({ i, rest: v - floors[i] }))
    .sort((a, b) => b.rest - a.rest);
  for (const { i } of order) {
    if (short <= 0) break;
    floors[i] += 1;
    short -= 1;
  }
  return floors;
}

export function wholePointsById(rules: readonly RuleScore[], book: Rulebook): Map<string, number> {
  const present = book.rules
    .map((rule) => rules.find((r) => r.id === rule.id))
    .filter((r): r is RuleScore => r !== undefined);
  const parts = wholeParts(present.map((r) => r.points));
  return new Map(present.map((r, i) => [r.id, parts[i]]));
}
