/**
 * Reset — content and mapping (new in the v2 redesign).
 *
 * §2's non-goals rule out anything that reads as treatment, so every card
 * here is worded as a lever on a *logged input* (sleep, stress, food, skin
 * handling), never as something that treats psoriasis. The "never start,
 * stop or change a medication" line from §13 is repeated at the foot of the
 * category most likely to be misread that way (Skin).
 *
 * Sessions and recipes are UI content, not data — nothing here is scored.
 * Only the flagship item in each list (marked `flagship: true`) carries real
 * step-by-step detail; the rest open a lighter "about this session" card
 * rather than fabricated content Fleur never authored. This mirrors how the
 * source design itself only detailed one item per category.
 */

export type ResetCategoryKey = 'move' | 'breath' | 'eat' | 'sleep' | 'skin' | 'mood';

export interface ResetCategory {
  key: ResetCategoryKey;
  name: string;
  kicker: string;
  meta: string;
  icon: 'move' | 'wind' | 'bowl' | 'moon' | 'drop' | 'notebook';
  blurb: string;
}

export const RESET_CATEGORIES: readonly ResetCategory[] = [
  {
    key: 'move',
    name: 'Movement',
    kicker: 'Yoga & gentle stretch',
    meta: '6 sessions · 6–25 min',
    icon: 'move',
    blurb:
      'Gentle movement is not a treatment — it is a lever on one input: sleep debt and ' +
      'the stiffness that comes with a bad night.',
  },
  {
    key: 'breath',
    name: 'Breathwork',
    kicker: 'Meditation & breathing',
    meta: '9 sessions · 3–20 min',
    icon: 'wind',
    blurb: 'Aimed at whichever factor in your profile carries the most weight right now.',
  },
  {
    key: 'eat',
    name: 'Eat',
    kicker: 'Anti-inflammatory plates',
    meta: '6 recipes',
    icon: 'bowl',
    blurb:
      'No diet has been shown to clear psoriasis. These are built around the food factors ' +
      'you already log, so eating around them keeps that input clean.',
  },
  {
    key: 'sleep',
    name: 'Wind-down',
    kicker: 'Sleep rituals',
    meta: '5 routines',
    icon: 'moon',
    blurb: 'The model carries a sleep-debt term — the shortfall against 7.5 hours a night.',
  },
  {
    key: 'skin',
    name: 'Skin',
    kicker: 'Routine & topicals',
    meta: 'Morning & night',
    icon: 'drop',
    blurb:
      'Fleur does not prescribe. These are handling habits around whatever your ' +
      'dermatologist has already given you.',
  },
  {
    key: 'mood',
    name: 'Mood',
    kicker: 'Stress & journaling',
    meta: 'Daily prompt · 2 min',
    icon: 'notebook',
    blurb: 'A place to write down the reason behind the stress number, for the days it matters.',
  },
];

export const RESET_CATEGORY_BY_KEY: Readonly<Record<ResetCategoryKey, ResetCategory>> =
  Object.fromEntries(RESET_CATEGORIES.map((c) => [c.key, c])) as Readonly<
    Record<ResetCategoryKey, ResetCategory>
  >;

/**
 * Which category a model feature's base variable points to, for "today's
 * plan" and the factor-detail CTA. Not every variable maps to something
 * actionable — those are left out of the plan rather than forced somewhere
 * that would not help.
 */
const VARIABLE_CATEGORY: Partial<Record<string, ResetCategoryKey>> = {
  stress: 'breath',
  sleep_hours: 'sleep',
  sleep_debt_7d: 'sleep',
  alcohol_units: 'eat',
  diet_dairy: 'eat',
  diet_processed: 'eat',
  diet_sugar: 'eat',
  illness: 'skin',
  sore_throat: 'skin',
  skin_injury: 'skin',
  itch: 'mood',
  severity_delta: 'mood',
};

export function categoryForVariable(baseVariable: string): ResetCategoryKey | null {
  return VARIABLE_CATEGORY[baseVariable] ?? null;
}

/** A fallback order when there are not yet 3 distinct mapped categories. */
export const DEFAULT_PLAN_ORDER: readonly ResetCategoryKey[] = ['breath', 'sleep', 'eat'];

export interface PlanItem {
  category: ResetCategoryKey;
  title: string;
  subtitle: string;
  pathname: string;
  params?: Record<string, string>;
}

/** The one concrete action "today's plan" links to for a given category. */
export function planItemFor(key: ResetCategoryKey): PlanItem {
  switch (key) {
    case 'breath': {
      const s = BREATH_SESSIONS[0];
      return {
        category: key,
        title: s.title,
        subtitle: `Breathwork · ${s.meta}`,
        pathname: '/reset-session',
        params: { id: s.id },
      };
    }
    case 'move': {
      const s = MOVE_SESSIONS[0];
      return {
        category: key,
        title: s.title,
        subtitle: `Movement · ${s.meta}`,
        pathname: '/reset-movement',
        params: { id: s.id },
      };
    }
    case 'eat': {
      const r = RECIPES[0];
      return {
        category: key,
        title: r.title,
        subtitle: `Eat · ${r.meta}`,
        pathname: '/reset-recipe',
        params: { id: r.id },
      };
    }
    case 'sleep': {
      const r = SLEEP_RITUALS[0];
      return {
        category: key,
        title: r.title,
        subtitle: `Wind-down · ${r.meta}`,
        pathname: '/reset-sleep-routine',
        params: { id: r.id },
      };
    }
    case 'skin':
      return {
        category: key,
        title: "Today's skin routine",
        subtitle: 'Skin · morning and night',
        pathname: '/reset-skin-routine',
      };
    case 'mood': {
      const m = MOOD_ITEMS[0];
      return {
        category: key,
        title: m.title,
        subtitle: `Mood · ${m.meta}`,
        pathname: '/reset-journal',
        params: { id: m.id },
      };
    }
  }
}

// --------------------------------------------------------------------------
// Sessions, recipes, rituals
// --------------------------------------------------------------------------

export interface SessionSummary {
  id: string;
  title: string;
  meta: string;
  flagship?: boolean;
}

export interface BreathSession extends SessionSummary {
  /** Seconds per phase — [in, hold, out] or [in, hold, out, hold]. Drives the ring. */
  pattern: readonly number[];
  phaseLabels: readonly string[];
}

export const BREATH_SESSIONS: readonly BreathSession[] = [
  {
    id: '478',
    title: '4 · 7 · 8 breathing',
    meta: '5 min · for stress, your top factor',
    pattern: [4, 7, 8],
    phaseLabels: ['Inhale', 'Hold', 'Exhale'],
    flagship: true,
  },
  {
    id: 'box',
    title: 'Box breathing',
    meta: '4 min · steady · before a hard hour',
    pattern: [4, 4, 4, 4],
    phaseLabels: ['Inhale', 'Hold', 'Exhale', 'Hold'],
  },
  {
    id: 'bodyscan',
    title: 'Body scan',
    meta: '12 min · lying down · itch awareness',
    pattern: [],
    phaseLabels: [],
  },
  {
    id: 'coherent',
    title: 'Coherent breathing',
    meta: '6 min · 5.5 breaths a minute',
    pattern: [5, 0, 5],
    phaseLabels: ['Inhale', '', 'Exhale'],
  },
  {
    id: 'cooldown',
    title: 'Cool-down breath',
    meta: '3 min · for flushed, hot skin',
    pattern: [4, 0, 6],
    phaseLabels: ['Inhale', '', 'Exhale'],
  },
  {
    id: 'sleeponset',
    title: 'Sleep-onset count',
    meta: '10 min · in bed · no audio',
    pattern: [],
    phaseLabels: [],
  },
  {
    id: 'morning',
    title: 'Morning arrival',
    meta: '4 min · seated · sets the day',
    pattern: [4, 2, 4],
    phaseLabels: ['Inhale', 'Hold', 'Exhale'],
  },
  {
    id: 'grounding',
    title: 'Anxious-spiral pause',
    meta: '3 min · grounding · 5 senses',
    pattern: [],
    phaseLabels: [],
  },
  {
    id: 'lovingkindness',
    title: 'Loving-kindness',
    meta: '20 min · guided · for flare weeks',
    pattern: [],
    phaseLabels: [],
  },
];

export const MOVE_SESSIONS: readonly SessionSummary[] = [
  { id: 'evening', title: 'Evening unwind flow', meta: '12 min · gentle · targets sleep debt', flagship: true },
  { id: 'mobility', title: 'Morning joint mobility', meta: '8 min · standing · for stiff mornings' },
  { id: 'restorative', title: 'Restorative floor sequence', meta: '25 min · props · lowest intensity' },
  { id: 'deskreset', title: 'Desk reset', meta: '6 min · seated · shoulders and neck' },
  { id: 'walking', title: 'Walking meditation', meta: '15 min · outdoors · pairs with UV' },
  { id: 'bedtime', title: 'Bedtime stretch', meta: '10 min · in bed · no equipment' },
];

export const YOGA_STEPS: readonly { n: string; t: string; d: string }[] = [
  { n: '01', t: 'Seated breath, hands on knees', d: '90 s' },
  { n: '02', t: 'Cat–cow, slow', d: '120 s' },
  { n: '03', t: 'Low lunge, both sides', d: '180 s' },
  { n: '04', t: 'Supine twist, both sides', d: '150 s' },
  { n: '05', t: 'Legs up the wall', d: '180 s' },
  { n: '06', t: 'Savasana', d: '120 s' },
];

export interface RecipeSummary extends SessionSummary {
  tags?: readonly string[];
}

export const RECIPES: readonly RecipeSummary[] = [
  {
    id: 'turmeric-oat',
    title: 'Turmeric & oat bowl',
    meta: 'Dinner · 20 min · no dairy, no sugar',
    tags: ['No dairy', 'No refined sugar', 'Gluten-free oats', 'Omega-3'],
    flagship: true,
  },
  { id: 'salmon-fennel', title: 'Salmon, fennel, blood orange', meta: 'Dinner · 30 min · omega-3 forward' },
  { id: 'lentil-walnut', title: 'Lentil & walnut ragu', meta: 'Dinner · 40 min · gluten-free option' },
  { id: 'green-congee', title: 'Green congee', meta: 'Breakfast · 25 min · low-histamine' },
  { id: 'roast-roots', title: 'Roast roots, tahini', meta: 'Lunch · 35 min · nightshade-free' },
  { id: 'ginger-pear', title: 'Ginger & pear compote', meta: 'Snack · 15 min · no refined sugar' },
];

export const TURMERIC_INGREDIENTS: readonly string[] = [
  '80 g rolled oats',
  '1 tsp ground turmeric',
  '400 ml oat milk',
  'Thumb of fresh ginger',
  '1 tbsp ground flaxseed',
  'Handful of walnuts',
  'Half a pear, sliced',
  'Pinch of black pepper',
];

export const TURMERIC_METHOD: readonly { n: string; t: string }[] = [
  { n: '1', t: 'Toast the oats dry for two minutes, until they smell nutty.' },
  { n: '2', t: 'Add the oat milk, turmeric, grated ginger and black pepper. Simmer eight minutes.' },
  { n: '3', t: 'Stir the flaxseed through off the heat so it thickens rather than clumps.' },
  { n: '4', t: 'Top with walnuts and pear. Skip the honey — sugar is logged as a factor for you.' },
];

export const SLEEP_RITUALS: readonly SessionSummary[] = [
  { id: 'winddown90', title: '90-minute wind-down', meta: '5 steps · 21:30 start · targets sleep debt', flagship: true },
  { id: 'itchproof', title: 'Itch-proof the bed', meta: '4 steps · cotton, cool, damp-skin cream' },
  { id: 'nightwaking', title: 'Night-waking reset', meta: '3 steps · for 3am scratching' },
  { id: 'shiftwork', title: 'Shift-work adaptation', meta: '6 steps · for irregular nights' },
  { id: 'travel', title: 'Travel & time zones', meta: '5 steps · keeps the log honest' },
];

export interface ChecklistItem {
  key: string;
  title: string;
  meta: string;
}

export const WIND_DOWN_STEPS: readonly ChecklistItem[] = [
  { key: 'w1', title: 'Screens off, lamps low', meta: '21:30 · 1 min' },
  { key: 'w2', title: 'Moisturise while skin is damp', meta: '21:40 · 3 min' },
  { key: 'w3', title: 'Legs-up-the-wall, 5 breaths', meta: '21:50 · 4 min' },
  { key: 'w4', title: 'Bedroom to 18 °C', meta: '22:00 · 1 min' },
  { key: 'w5', title: '4 · 7 · 8 breathing in bed', meta: '22:10 · 5 min' },
];

export const SKIN_AM_STEPS: readonly ChecklistItem[] = [
  { key: 'am1', title: 'Lukewarm shower, no soap on plaques', meta: '5 min' },
  { key: 'am2', title: 'Emollient within 3 minutes', meta: '2 min' },
  { key: 'am3', title: 'Prescribed topical, thin layer', meta: '1 min' },
];

export const SKIN_PM_STEPS: readonly ChecklistItem[] = [
  { key: 'pm1', title: 'Fragrance-free cleanser', meta: '2 min' },
  { key: 'pm2', title: 'Occlusive over emollient', meta: '2 min' },
  { key: 'pm3', title: 'Log medication in the check-in', meta: '10 sec' },
];

export const SKIN_NOTES: readonly string[] = [
  'Moisturise within three minutes of a shower, while the skin is still damp — it is the cheapest thing on this list.',
  'Patch-test anything new on the inside of a forearm for four days, and log it as a new product either way.',
  'Treat cuts, scratches and sunburn as events worth logging: new plaques at injury sites is the Koebner phenomenon.',
  'Sunlight in small, non-burning doses is associated with lower risk in your profile. Burning is not the same thing.',
];

export const MOOD_ITEMS: readonly SessionSummary[] = [
  { id: 'tonight', title: "Tonight's prompt", meta: 'What took the most out of you today?', flagship: true },
  { id: 'ladder', title: 'Stress ladder', meta: '6 min · name it, rank it, park it' },
  { id: 'letter', title: 'Flare-week letter', meta: 'Write to yourself for the next flare' },
  { id: 'visible', title: 'Visible-skin days', meta: 'For the days you dread being seen' },
];

export const JOURNAL_PROMPTS: Readonly<Record<string, string>> = {
  tonight: 'What took the most out of you today?',
  ladder: 'What is weighing on you, biggest to smallest — and which of those can actually wait?',
  letter: 'Write a short note to read the next time your skin flares.',
  visible: "What's one thing that made a visible-skin day easier today?",
};
