import type { Rule } from '../logic/rulebook';

export interface RuleHowRow {
  reading: string;
  points: number;
}

export interface RuleHow {
  heading: string;
  rows: readonly RuleHowRow[];
}

type Edge = 'zero' | 'mid' | 'full';

interface Spec {
  heading: string;
  yesNo?: boolean;
  reading?: (value: number, edge: Edge) => string;
}

const orMore = (text: string, edge: Edge): string =>
  edge === 'zero' ? `${text} or less` : edge === 'full' ? `${text} or more` : text;

const SPECS: Readonly<Record<string, Spec>> = {
  skin_climbing: {
    heading: 'Skin today vs. your usual',
    reading: (v, e) => (v === 0 ? 'Same as usual' : orMore(`${v} above usual`, e)),
  },
  stress: { heading: 'Average stress (7-14 days ago)', reading: (v, e) => orMore(`Stress ${v}`, e) },
  illness: { heading: 'Sick (7-14 days ago)', yesNo: true },
  short_sleep: {
    heading: 'Average sleep (last 7 days)',
    reading: (v, e) => (e === 'zero' ? `${v} hours or more` : e === 'full' ? `${v} hours or less` : `${v} hours`),
  },
  itch: { heading: 'Average itch (last 3 days)', reading: (v, e) => orMore(`Itch ${v}`, e) },
  sore_throat: { heading: 'Sore throat (10-14 days ago)', yesNo: true },
  skin_injury: { heading: 'Cut, scrape or sunburn (10-14 days ago)', yesNo: true },
  alcohol: {
    heading: 'Drinks a day (last 5 days)',
    reading: (v, e) => (v === 0 ? 'None' : orMore(`${v}`, e)),
  },
  processed_food: { heading: 'Processed-food days (last 7 days)', reading: (v, e) => orMore(`${v} days`, e) },
  pollution: { heading: 'Air pollution (PM2.5) (last 3 days)', reading: (v, e) => orMore(`${v}`, e) },
  cold_snap: {
    heading: 'Biggest temperature drop (1-3 days ago)',
    reading: (v, e) => orMore(`${Math.round(Math.abs(v) * 1.8)}°F`, e),
  },
  sunshine: { heading: 'Average UV index (last 7 days)', reading: (v, e) => orMore(`UV ${v}`, e) },
};

export function ruleHow(rule: Rule): RuleHow {
  const spec = SPECS[rule.id];
  if (spec?.yesNo) {
    return {
      heading: spec.heading,
      rows: [
        { reading: 'No', points: 0 },
        { reading: 'Yes', points: rule.points },
      ],
    };
  }
  const read = spec?.reading ?? ((v: number) => `${v}`);
  const mid = (rule.low + rule.high) / 2;
  return {
    heading: spec?.heading ?? rule.label,
    rows: [
      { reading: read(rule.low, 'zero'), points: 0 },
      { reading: read(Number(mid.toFixed(1)), 'mid'), points: Math.round(rule.points / 2) },
      { reading: read(rule.high, 'full'), points: rule.points },
    ],
  };
}
