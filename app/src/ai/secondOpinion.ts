import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { rulebook } from '../logic/rulebook';
import type { RiskBand } from '../logic/rulebook';
import type { DayRow } from './payload';

export const AI_MODEL = 'claude-opus-5';

const OpinionSchema = z.object({
  score: z.number().min(0).max(100),
  band: z.enum(['low', 'elevated', 'high']),
  factor_ids: z.array(z.string()).max(3),
  summary: z.string().max(240),
});

export interface Opinion {
  score: number;
  band: RiskBand;
  factorIds: string[];
  summary: string;
}

const RULE_IDS = rulebook.rules.map((r) => r.id).join(', ');

const SYSTEM = `You are scoring flare risk for a psoriasis tracking app used in a
high-school science project. You are given 14 days of numbers for one anonymous
person. Day 0 is today.

A "flare" means this person's skin severity rises at least 3 points above their
own average for the previous 14 days, at some point in the next 3 days.

Give a risk score from 0 to 100, where 0 means a flare is very unlikely in the
next 3 days and 100 means it is very likely. Use these bands: 0-29 low,
30-49 elevated, 50-100 high.

Pick at most 3 factor ids from this list, most important first:
${RULE_IDS}

Rules you must follow:
- Do not mention any medication, treatment, supplement, diet change, or doctor.
- Do not tell the person to do or stop anything.
- Do not use the words "will", "predicts", "diagnosis", or "prevents".
- Write the summary as one neutral sentence about patterns, using "may" or
  "associated with". Never say anything is a cause.
- Return only the fields asked for.`;

const BANNED = [
  'will ',
  'predicts',
  'prediction',
  'diagnos',
  'prevent',
  'cure',
  'treatment',
  'medication',
  'medicine',
  'drug',
  'steroid',
  'cream',
  'doctor',
  'dermatologist',
  'should',
  'must ',
  'stop eating',
  'avoid',
];

export function summaryIsSafe(summary: string): boolean {
  const lower = summary.toLowerCase();
  return !BANNED.some((word) => lower.includes(word));
}

export async function askForSecondOpinion(
  rows: readonly DayRow[],
  apiKey: string,
): Promise<Opinion | null> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.messages.parse({
    model: AI_MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(rows) }],
    output_config: { effort: 'low', format: zodOutputFormat(OpinionSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) return null;

  const known = new Set(rulebook.rules.map((r) => r.id));
  return {
    score: Math.round(parsed.score),
    band: parsed.band,
    factorIds: parsed.factor_ids.filter((id) => known.has(id)),
    summary: summaryIsSafe(parsed.summary) ? parsed.summary : '',
  };
}
