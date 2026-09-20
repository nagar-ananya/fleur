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
  steps: number | null;
  source: 'healthkit' | 'health_connect';
  fetchedAt: string;
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
  };
}
