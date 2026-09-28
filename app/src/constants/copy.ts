/**
 * User-facing copy (REQUIREMENTS §13).
 *
 * The disclaimers and the Insights preamble are quoted verbatim from the spec
 * and must not be paraphrased. Everything else follows §13.1: "risk",
 * "pattern", "association", "may" — never "will", "predicts", "diagnosis",
 * or "prevents", and never a treatment recommendation.
 */

/** §13.2 full form — onboarding (requires acceptance) and Settings. */
export const DISCLAIMER_FULL =
  'Fleur is an experimental research prototype, not a medical device. It cannot ' +
  'diagnose, treat, or prevent any condition, and its predictions have not been ' +
  'clinically validated. Nothing here is medical advice. Always talk to a ' +
  'qualified healthcare professional about your psoriasis, and never change your ' +
  'treatment based on this app.';

/** §13.2 short form — required on every screen showing a risk value (FR-4.6). */
export const DISCLAIMER_SHORT = 'Experimental. Not medical advice.';

/** §11.4 required verbatim above the Insights chart. */
export const INSIGHTS_PREAMBLE =
  'These are patterns, not proven causes. A factor appearing here means it moved ' +
  'together with flares in the data — not that it caused them.';

/**
 * How Fleur states the headline number — used on both Today and
 * `/risk-detail` so the two never phrase the same score differently.
 *
 * The horizon is three days (§8.1's target). The 14-day figure is only the
 * minimum *history* required before any score is shown (FR-4.2).
 */
export const RISK_HORIZON_KICKER = 'Flare risk score · next 3 days';

export interface FactorExplanation {
  /** What the factor is, in plain language. */
  description: string;
  /** §7.4 documented latency, for the FR-5.4 detail sheet. */
  typicalLag: string;
  /** Same window as numbers, so the detail sheet can draw it (days). */
  lagFrom: number;
  lagTo: number;
}

/**
 * Keyed by the base variable each rule names. Lives here rather than in
 * `rulebook.json` because it is UI copy, not part of the scoring contract.
 */
export const FACTOR_EXPLANATIONS: Readonly<Record<string, FactorExplanation>> = {
  stress: {
    description:
      'Psychological stress is the most commonly reported psoriasis trigger. The link ' +
      'runs both ways — flares are stressful too — so treat this as a pattern to notice ' +
      'rather than a cause to act on.',
    typicalLag: 'Usually 7 to 14 days between a stressful stretch and a flare.',
    lagFrom: 7,
    lagTo: 14,
  },
  sleep_hours: {
    description:
      'Short or broken sleep is associated with more inflammatory activity. Fleur looks ' +
      'at both single nights and accumulated debt across the week.',
    typicalLag: 'Usually 3 to 7 days.',
    lagFrom: 3,
    lagTo: 7,
  },
  itch: {
    description:
      'Itch often moves together with severity rather than ahead of it, so it tends to ' +
      'describe a flare more than it forecasts one.',
    typicalLag: 'Same day to a few days.',
    lagFrom: 0,
    lagTo: 3,
  },
  alcohol_units: {
    description:
      'Alcohol intake has been associated with psoriasis severity in observational studies, ' +
      'more consistently at higher intakes.',
    typicalLag: 'Usually 2 to 5 days.',
    lagFrom: 2,
    lagTo: 5,
  },
  diet_dairy: {
    description:
      'Dairy is among the most commonly *believed* triggers, but the evidence for it is ' +
      'weak. If it shows up here it is worth testing deliberately before changing anything.',
    typicalLag: 'Reported anywhere from 3 to 7 days.',
    lagFrom: 3,
    lagTo: 7,
  },
  diet_processed: {
    description:
      'Highly processed food is associated with systemic inflammation. The effect on ' +
      'psoriasis specifically is not well established.',
    typicalLag: 'Usually 3 to 7 days.',
    lagFrom: 3,
    lagTo: 7,
  },
  diet_sugar: {
    description:
      'High sugar intake is linked to inflammatory markers. As with all diet factors, the ' +
      'association here is population-level, not personal proof.',
    typicalLag: 'Usually 3 to 7 days.',
    lagFrom: 3,
    lagTo: 7,
  },
  illness: {
    description:
      'Infections activate the immune system, which can show up in the skin days later.',
    typicalLag: 'Usually 10 to 14 days.',
    lagFrom: 10,
    lagTo: 14,
  },
  sore_throat: {
    description:
      'Streptococcal throat infection is the classic guttate psoriasis trigger and is ' +
      'tracked separately from general illness for that reason.',
    typicalLag:
      'Usually 14 to 21 days. Fleur can only look back 14 days, so the tail of this ' +
      'window is outside what Fleur can see.',
    lagFrom: 14,
    lagTo: 21,
  },
  skin_injury: {
    description:
      'New lesions appearing at sites of skin trauma is called the Koebner phenomenon — ' +
      'cuts, scratches, sunburn, and friction all count.',
    typicalLag: 'Usually 10 to 14 days.',
    lagFrom: 10,
    lagTo: 14,
  },
  temp_delta_1d: {
    description:
      'Sharp drops in temperature dry the skin and are associated with worsening, which ' +
      'is why Fleur tracks the day-to-day change rather than the absolute reading.',
    typicalLag: 'Usually 1 to 3 days.',
    lagFrom: 1,
    lagTo: 3,
  },
  humidity_delta_1d: {
    description: 'A sudden fall in humidity pulls moisture from the skin barrier.',
    typicalLag: 'Usually 1 to 3 days.',
    lagFrom: 1,
    lagTo: 3,
  },
  pressure_delta_1d: {
    description:
      'Barometric swings are reported anecdotally by some people with inflammatory skin ' +
      'conditions. The evidence is thin.',
    typicalLag: 'Usually 1 to 3 days.',
    lagFrom: 1,
    lagTo: 3,
  },
  uv_index_max: {
    description:
      'Natural sunlight is generally protective in psoriasis — phototherapy works on the ' +
      'same principle — so low-UV stretches often sit alongside worse skin.',
    typicalLag: 'Usually 3 to 7 days.',
    lagFrom: 3,
    lagTo: 7,
  },
  pm2_5: {
    description:
      'Fine particulate air pollution has been associated with psoriasis flares in ' +
      'several population studies.',
    typicalLag: 'Usually 1 to 4 days.',
    lagFrom: 1,
    lagTo: 4,
  },
  pollen_total: {
    description: 'Combined pollen load across the species reported for your area.',
    typicalLag: 'Usually 1 to 4 days.',
    lagFrom: 1,
    lagTo: 4,
  },
  humidity_mean_pct: {
    description: 'Sustained low humidity is associated with drier, more irritable skin.',
    typicalLag: 'Usually 1 to 3 days.',
    lagFrom: 1,
    lagTo: 3,
  },
  severity_baseline: {
    description:
      'Your average severity over the past two weeks. Fleur measures a flare against this ' +
      'rather than against a fixed number, so it adapts to where your skin usually sits.',
    typicalLag: 'Rolling 14-day window.',
    lagFrom: 0,
    lagTo: 14,
  },
  severity_delta: {
    description:
      'How far today sits above or below your recent average. This is the single strongest ' +
      'signal Fleur has — skin that has already started moving tends to keep moving.',
    typicalLag: 'Today, compared with the last 14 days.',
    lagFrom: 0,
    lagTo: 1,
  },
  sleep_debt_7d: {
    description:
      'Hours of sleep missed against 7.5 per night, accumulated over the past week.',
    typicalLag: 'Rolling 7-day window.',
    lagFrom: 0,
    lagTo: 7,
  },
  temp_mean_c: {
    description: "Today's average temperature where you are.",
    typicalLag: 'Today.',
    lagFrom: 0,
    lagTo: 1,
  },
};

/** Falls back gracefully rather than showing a raw variable name. */
export function explanationFor(baseVariable: string): FactorExplanation {
  return (
    FACTOR_EXPLANATIONS[baseVariable] ?? {
      description:
        'Fleur watches this factor because published research links it to flares.',
      typicalLag: 'Varies.',
      lagFrom: 0,
      lagTo: 14,
    }
  );
}
