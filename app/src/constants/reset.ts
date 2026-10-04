/**
 * Reset — small, actionable things to do today. Four lists, nothing else:
 * breathing exercises, recipes, movement timers and a skin-care checklist.
 *
 * Not treatment (§2). Each one is a lever on something the check-in logs —
 * stress, food, sleep, skin handling — never a claim about psoriasis itself.
 */

export type ResetCategoryKey = 'breath' | 'eat' | 'move' | 'skin';

export interface ResetCategory {
  key: ResetCategoryKey;
  title: string;
  /** One short line under the title. */
  subtitle: string;
  icon: 'wind' | 'bowl' | 'move' | 'drop';
}

// --------------------------------------------------------------------------
// Breathing
// --------------------------------------------------------------------------

export interface BreathExercise {
  id: string;
  title: string;
  /** What it is for, in a few words. */
  meta: string;
  minutes: number;
  /** Seconds per phase — [in, hold, out] or [in, hold, out, hold]. Drives the ring. */
  pattern: readonly number[];
  phaseLabels: readonly string[];
}

export const BREATH_EXERCISES: readonly BreathExercise[] = [
  {
    id: '478',
    title: '4 · 7 · 8 breathing',
    meta: 'Calm down when stressed',
    minutes: 4,
    pattern: [4, 7, 8],
    phaseLabels: ['Breathe in', 'Hold', 'Breathe out'],
  },
  {
    id: 'box',
    title: 'Box breathing',
    meta: 'Focus before a test or a hard moment',
    minutes: 4,
    pattern: [4, 4, 4, 4],
    phaseLabels: ['Breathe in', 'Hold', 'Breathe out', 'Hold'],
  },
  {
    id: 'slow',
    title: 'Slow breathing',
    meta: 'Settle down anytime',
    minutes: 5,
    pattern: [5, 0, 5],
    phaseLabels: ['Breathe in', '', 'Breathe out'],
  },
  {
    id: 'cooldown',
    title: 'Cool-down breath',
    meta: 'When skin feels hot or itchy',
    minutes: 3,
    pattern: [4, 0, 6],
    phaseLabels: ['Breathe in', '', 'Breathe out'],
  },
];

// --------------------------------------------------------------------------
// Eat
// --------------------------------------------------------------------------

export interface Recipe {
  id: string;
  title: string;
  /** Meal and time, e.g. "Breakfast · 15 min". */
  meta: string;
  ingredients: readonly string[];
  steps: readonly string[];
}

export const RECIPES: readonly Recipe[] = [
  {
    id: 'turmeric-oat',
    title: 'Turmeric & oat bowl',
    meta: 'Breakfast · 15 min',
    ingredients: [
      '1 cup rolled oats',
      '1½ cups oat milk',
      '1 tsp ground turmeric',
      'Pinch of black pepper',
      '1 tbsp ground flaxseed',
      'Handful of walnuts',
      'Half a pear, sliced',
    ],
    steps: [
      'Simmer the oats, oat milk, turmeric and pepper for 8 minutes, stirring now and then.',
      'Take it off the heat and stir in the flaxseed.',
      'Top with walnuts and pear.',
    ],
  },
  {
    id: 'berry-smoothie',
    title: 'Berry & spinach smoothie',
    meta: 'Breakfast or snack · 5 min',
    ingredients: [
      '1 cup frozen mixed berries',
      'Handful of spinach',
      'Half a banana',
      '1 cup oat milk',
      '1 tbsp chia seeds',
    ],
    steps: ['Put everything in a blender.', 'Blend until smooth, about 1 minute.'],
  },
  {
    id: 'avocado-egg-toast',
    title: 'Avocado & egg toast',
    meta: 'Breakfast · 10 min',
    ingredients: [
      '2 slices whole-grain bread',
      '1 ripe avocado',
      '2 eggs',
      'Squeeze of lemon',
      'Salt, pepper and chili flakes',
    ],
    steps: [
      'Toast the bread.',
      'Mash the avocado with lemon, salt and pepper, and spread it on the toast.',
      'Fry or boil the eggs and put them on top. Add chili flakes if you like.',
    ],
  },
  {
    id: 'chickpea-bowl',
    title: 'Chickpea & quinoa bowl',
    meta: 'Lunch · 20 min',
    ingredients: [
      '1 cup cooked quinoa',
      '1 can chickpeas, drained',
      '1 cucumber, chopped',
      'Cherry tomatoes',
      'Half an avocado',
      'Olive oil and lemon juice',
    ],
    steps: [
      'Put the quinoa in a bowl.',
      'Add the chickpeas, cucumber, tomatoes and avocado.',
      'Dress with olive oil, lemon juice and a pinch of salt.',
    ],
  },
  {
    id: 'lentil-soup',
    title: 'Lentil & vegetable soup',
    meta: 'Lunch or dinner · 35 min',
    ingredients: [
      '1 cup red lentils',
      '1 onion, chopped',
      '2 carrots, chopped',
      '1 garlic clove',
      '1 tsp cumin',
      '4 cups vegetable broth',
      'Handful of spinach',
    ],
    steps: [
      'Soften the onion, carrot and garlic in a little olive oil for 5 minutes.',
      'Add the lentils, cumin and broth. Simmer 25 minutes.',
      'Stir in the spinach until it wilts.',
    ],
  },
  {
    id: 'bean-tacos',
    title: 'Sweet potato & black bean tacos',
    meta: 'Lunch or dinner · 25 min',
    ingredients: [
      '1 sweet potato, cubed',
      '1 can black beans, drained',
      '1 tsp cumin',
      '6 small corn tortillas',
      'Half an avocado, sliced',
      'Salsa and lime',
    ],
    steps: [
      'Roast the sweet potato with olive oil and cumin at 200 °C (400 °F) for 20 minutes.',
      'Warm the black beans in a pan.',
      'Fill the tortillas with sweet potato, beans, avocado and salsa. Squeeze lime on top.',
    ],
  },
  {
    id: 'salmon-tray',
    title: 'Salmon & veggie tray bake',
    meta: 'Dinner · 30 min',
    ingredients: [
      '2 salmon fillets',
      '1 sweet potato, cubed',
      '1 cup broccoli',
      '1 bell pepper, sliced',
      '2 tbsp olive oil',
      'Salt, pepper and lemon',
    ],
    steps: [
      'Heat the oven to 200 °C (400 °F).',
      'Toss the vegetables with olive oil, salt and pepper on a tray. Roast 15 minutes.',
      'Add the salmon to the tray and roast 12 more minutes.',
      'Squeeze lemon over the top.',
    ],
  },
  {
    id: 'chicken-stir-fry',
    title: 'Chicken & veggie stir-fry',
    meta: 'Dinner · 20 min',
    ingredients: [
      '1 chicken breast, sliced',
      '2 cups mixed vegetables (peppers, broccoli, carrots)',
      '1 garlic clove and a little ginger',
      '2 tbsp soy sauce',
      '1 tbsp olive oil',
      'Cooked brown rice',
    ],
    steps: [
      'Cook the chicken in the oil over high heat until no longer pink, about 6 minutes.',
      'Add the vegetables, garlic and ginger. Stir-fry 5 minutes.',
      'Stir in the soy sauce and serve over brown rice.',
    ],
  },
];

// --------------------------------------------------------------------------
// Movement
// --------------------------------------------------------------------------

export interface MoveTimer {
  id: string;
  title: string;
  minutes: number;
  /** What to do while the timer runs — a few short steps. */
  steps: readonly string[];
}

export const MOVE_TIMERS: readonly MoveTimer[] = [
  {
    id: 'desk',
    title: 'Neck & shoulder reset',
    minutes: 3,
    steps: ['Roll your shoulders back 10 times', 'Tilt your head side to side', 'Stretch your arms overhead'],
  },
  {
    id: 'stretch',
    title: 'Stretch break',
    minutes: 5,
    steps: ['Reach for your toes', 'Stretch each side', 'Gentle twists, both ways'],
  },
  {
    id: 'bedtime',
    title: 'Bedtime stretch',
    minutes: 8,
    steps: ['Knees to chest', 'Lying twist, both sides', 'Legs up the wall', 'Slow breaths'],
  },
  {
    id: 'yoga',
    title: 'Gentle yoga',
    minutes: 10,
    steps: ['Cat–cow', 'Low lunge, both sides', "Child's pose", 'Lie still and breathe'],
  },
  {
    id: 'walk',
    title: 'Walk outside',
    minutes: 15,
    steps: ['Walk at an easy pace', 'Get some daylight', 'Come back when the timer rings'],
  },
];

// --------------------------------------------------------------------------
// Skin routine
// --------------------------------------------------------------------------

export interface ChecklistItem {
  key: string;
  title: string;
}

export const SKIN_AM_STEPS: readonly ChecklistItem[] = [
  { key: 'am1', title: 'Rinse with lukewarm water, not hot' },
  { key: 'am2', title: 'Moisturize right after, while skin is damp' },
  { key: 'am3', title: 'Apply your prescribed cream, if you have one' },
  { key: 'am4', title: 'Sunscreen on skin that will be in the sun' },
];

export const SKIN_PM_STEPS: readonly ChecklistItem[] = [
  { key: 'pm1', title: 'Wash with a gentle, fragrance-free cleanser' },
  { key: 'pm2', title: 'Apply your prescribed cream, if you have one' },
  { key: 'pm3', title: 'Thick moisturizer before bed' },
];

// --------------------------------------------------------------------------
// The list on the Reset tab
// --------------------------------------------------------------------------

export const RESET_CATEGORIES: readonly ResetCategory[] = [
  { key: 'breath', title: 'Breathing', subtitle: `${BREATH_EXERCISES.length} exercises`, icon: 'wind' },
  { key: 'eat', title: 'Eat', subtitle: `${RECIPES.length} recipes`, icon: 'bowl' },
  { key: 'move', title: 'Movement', subtitle: `${MOVE_TIMERS.length} timed exercises`, icon: 'move' },
  { key: 'skin', title: "Today's skin routine", subtitle: 'Morning and evening checklist', icon: 'drop' },
];

/** Where each category opens. */
export function categoryPath(key: ResetCategoryKey): { pathname: string; params?: Record<string, string> } {
  return key === 'skin' ? { pathname: '/reset-skin-routine' } : { pathname: '/reset-category', params: { key } };
}

/**
 * Which Reset list a rule's base variable points to, for the "Try" button on
 * a rule's page. Variables with nothing useful to suggest are left out.
 */
const VARIABLE_CATEGORY: Partial<Record<string, ResetCategoryKey>> = {
  stress: 'breath',
  sleep_hours: 'move',
  alcohol_units: 'eat',
  diet_processed: 'eat',
  illness: 'skin',
  sore_throat: 'skin',
  skin_injury: 'skin',
  itch: 'breath',
  severity_delta: 'skin',
};

export function categoryForVariable(baseVariable: string): ResetCategory | null {
  const key = VARIABLE_CATEGORY[baseVariable];
  return key ? (RESET_CATEGORIES.find((c) => c.key === key) ?? null) : null;
}
