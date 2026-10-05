import { canPredict, MIN_HISTORY_DAYS, type DailyFrame } from './frame';
import { scoreDay } from './engine';
import type { Rulebook } from './rulebook';

export interface RuleAverage {
  readonly id: string;
  readonly label: string;
  readonly variable: string;
  readonly averagePoints: number;
  readonly days: number;
}

const MIN_AVERAGE_POINTS = 0.5;

export function ruleAverages(frame: DailyFrame, book: Rulebook): RuleAverage[] {
  const totals = new Map<string, { sum: number; days: number }>();

  for (let i = MIN_HISTORY_DAYS; i < frame.dates.length; i += 1) {
    if (!canPredict(frame, i)) continue;
    for (const rule of scoreDay(frame, i, book).rules) {
      const entry = totals.get(rule.id) ?? { sum: 0, days: 0 };
      entry.sum += rule.points;
      entry.days += 1;
      totals.set(rule.id, entry);
    }
  }

  return book.rules
    .map((rule) => {
      const entry = totals.get(rule.id);
      return {
        id: rule.id,
        label: rule.label,
        variable: rule.variable,
        averagePoints: entry && entry.days > 0 ? entry.sum / entry.days : 0,
        days: entry?.days ?? 0,
      };
    })
    .filter((r) => r.days > 0 && Math.abs(r.averagePoints) >= MIN_AVERAGE_POINTS)
    .sort((a, b) => Math.abs(b.averagePoints) - Math.abs(a.averagePoints));
}

export function scoredDayCount(frame: DailyFrame): number {
  let days = 0;
  for (let i = MIN_HISTORY_DAYS; i < frame.dates.length; i += 1) {
    if (canPredict(frame, i)) days += 1;
  }
  return days;
}
