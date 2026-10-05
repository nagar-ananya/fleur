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
  date: string;
  severity: number;
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
  hrv: number | null;
  steps: number | null;
  source: 'healthkit' | 'health_connect';
  fetchedAt: string;
}

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
  source?: 'local' | 'ai';
}

export interface StoredAiOpinion {
  date: string;
  score: number;
  band: RiskBand;
  factorIds: string[];
  summary: string;
  model: string;
  createdAt: string;
}

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
