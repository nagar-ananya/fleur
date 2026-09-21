/**
 * Domain types mirroring the SQLite schema (REQUIREMENTS §6.6).
 *
 * Nullable columns map to `| null`, never `| undefined` — the distinction
 * matters because "the user left this blank" and "we never asked" both have to
 * survive a round trip through the database.
 */

export type PsoriasisType =
  | 'plaque'
  | 'guttate'
  | 'inverse'
  | 'pustular'
  | 'erythrodermic'
  | 'unknown';

export const PSORIASIS_TYPES: readonly PsoriasisType[] = [
  'plaque',
  'guttate',
  'inverse',
  'pustular',
  'erythrodermic',
  'unknown',
];

export const PSORIASIS_TYPE_LABELS: Readonly<Record<PsoriasisType, string>> = {
  plaque: 'Plaque',
  guttate: 'Guttate',
  inverse: 'Inverse',
  pustular: 'Pustular',
  erythrodermic: 'Erythrodermic',
  unknown: "I'm not sure",
};

export type RiskBand = 'low' | 'elevated' | 'high';

export interface Profile {
  psoriasisType: PsoriasisType;
  onsetYear: number | null;
  onSystemic: boolean;
  latitude: number | null;
  longitude: number | null;
  cityLabel: string | null;
  disclaimerAckAt: string;
  createdAt: string;
}

export interface CheckIn {
  date: string; // 'YYYY-MM-DD'
  severity: number; // 0-10, required
  itch: number | null;
  stress: number | null;
  sleepHours: number | null;
  waterGlasses: number | null;
  alcoholUnits: number | null;
  dietDairy: boolean;
  dietGluten: boolean;
  dietProcessed: boolean;
  dietSugar: boolean;
  dietRedMeat: boolean;
  illness: boolean;
  soreThroat: boolean;
  skinInjury: boolean;
  newProduct: boolean;
  medTaken: boolean;
  notes: string | null;
  /**
   * Body areas affected, e.g. `['elbows', 'knees']`. Added for the v2 redesign
   * check-in's "areas affected" step. Never fed to the model (§8.1's 95
   * features are fixed) — this is UI-only context, stored comma-joined in the
   * `checkin.areas` column and split back out here.
   */
  areas: string[];
}

export const BODY_AREAS = [
  'scalp',
  'face',
  'elbows',
  'hands',
  'trunk',
  'knees',
  'feet',
  'nails',
  'other',
] as const;

export type BodyArea = (typeof BODY_AREAS)[number];

export const BODY_AREA_LABELS: Readonly<Record<BodyArea, string>> = {
  scalp: 'Scalp',
  face: 'Face',
  elbows: 'Elbows',
  hands: 'Hands',
  trunk: 'Trunk',
  knees: 'Knees',
  feet: 'Feet',
  nails: 'Nails',
  other: 'Other',
};

/** A single private journal entry (Reset → Mood). Local-only, never scored. */
export interface JournalEntry {
  id: number;
  date: string;
  body: string;
  createdAt: string;
}

export interface EnvironmentDay {
  date: string;
  tempMeanC: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  humidityMeanPct: number | null;
  dewPointC: number | null;
  pressureHpa: number | null;
  uvIndexMax: number | null;
  precipitationMm: number | null;
  windSpeedMax: number | null;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  pollenTotal: number | null;
  isForecast: boolean;
  fetchedAt: string;
}

export interface WearableDay {
  date: string;
  sleepHours: number | null;
  sleepEfficiency: number | null;
  restingHr: number | null;
  /** Heart-rate variability (ms), ahead of the planned Fitbit/Health Connect integration. */
  hrv: number | null;
  steps: number | null;
  source: 'healthkit' | 'health_connect';
  fetchedAt: string;
}

/**
 * Display name for a wearable data source. `health_connect` is the Android
 * aggregator API (HD-3) — Fitbit is the actual device this project targets,
 * so that is what the person sees, even though the technical source value
 * stays `health_connect` (other apps can write into the same aggregator).
 */
export function wearableSourceLabel(source: WearableDay['source']): string {
  return source === 'healthkit' ? 'Apple Health' : 'Fitbit';
}

export interface PredictionRecord {
  id: number;
  computedAt: string;
  forDate: string;
  probability: number;
  band: RiskBand;
  modelVersion: string;
  topFeatures: { feature: string; contribution: number }[];
}

/** A blank check-in for `date`, used as the starting point for the form. */
export function emptyCheckIn(date: string): CheckIn {
  return {
    date,
    severity: 0,
    itch: null,
    stress: null,
    sleepHours: null,
    waterGlasses: null,
    alcoholUnits: null,
    dietDairy: false,
    dietGluten: false,
    dietProcessed: false,
    dietSugar: false,
    dietRedMeat: false,
    illness: false,
    soreThroat: false,
    skinInjury: false,
    newProduct: false,
    medTaken: false,
    notes: null,
    areas: [],
  };
}
