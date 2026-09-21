/**
 * All database access (REQUIREMENTS §6, §16).
 *
 * This module is the *only* place snake_case database columns meet camelCase
 * TypeScript properties. Nothing above it should ever see a raw column name,
 * with one deliberate exception: `loadFeatureInputRows` hands the ML pipeline
 * snake_case keys, because those are ML variable names and §16 keeps those
 * snake_case in both languages.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import type { FeatureInputRow } from '../ml/features';
import type {
  CheckIn,
  EnvironmentDay,
  JournalEntry,
  PredictionRecord,
  Profile,
  PsoriasisType,
  RiskBand,
  WearableDay,
} from '../types/models';
import { addDays, todayLocal } from '../utils/dates';

// --------------------------------------------------------------------------
// Row shapes as SQLite returns them
// --------------------------------------------------------------------------

interface ProfileRow {
  psoriasis_type: string;
  onset_year: number | null;
  on_systemic: number;
  latitude: number | null;
  longitude: number | null;
  city_label: string | null;
  disclaimer_ack_at: string;
  created_at: string;
}

interface CheckInRow {
  date: string;
  severity: number;
  itch: number | null;
  stress: number | null;
  sleep_hours: number | null;
  water_glasses: number | null;
  alcohol_units: number | null;
  diet_dairy: number;
  diet_gluten: number;
  diet_processed: number;
  diet_sugar: number;
  diet_red_meat: number;
  illness: number;
  sore_throat: number;
  skin_injury: number;
  new_product: number;
  med_taken: number;
  notes: string | null;
  areas: string | null;
}

interface EnvironmentRow {
  date: string;
  temp_mean_c: number | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
  humidity_mean_pct: number | null;
  dew_point_c: number | null;
  pressure_hpa: number | null;
  uv_index_max: number | null;
  precipitation_mm: number | null;
  wind_speed_max: number | null;
  pm2_5: number | null;
  pm10: number | null;
  ozone: number | null;
  pollen_total: number | null;
  is_forecast: number;
  fetched_at: string;
}

interface WearableRow {
  date: string;
  sleep_hours: number | null;
  sleep_efficiency: number | null;
  resting_hr: number | null;
  hrv: number | null;
  steps: number | null;
  source: string;
  fetched_at: string;
}

const bool = (value: number | null): boolean => value === 1;
const int = (value: boolean): number => (value ? 1 : 0);

/**
 * Serialises every batched write onto one chain.
 *
 * `withTransactionAsync` does not serialise, so two overlapping callers issue a
 * nested BEGIN and SQLite rejects the batch with "cannot start a transaction
 * within a transaction" — which happened on a real device, on first launch,
 * when two environment refreshes raced before any `fetched_at` existed to
 * rate-limit them.
 *
 * expo-sqlite offers `withExclusiveTransactionAsync` for this, but it opens a
 * second native connection and closes it in a `finally`, which surfaced as
 * "Cannot convert provided JavaScriptObject to the SharedObject" on Android.
 * A queue in JS is simpler, has no native surface, and solves the same problem.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  // Keep the chain alive even if a link rejects, so one failed write cannot
  // wedge every write that follows it.
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// --------------------------------------------------------------------------
// Profile
// --------------------------------------------------------------------------

export async function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  const row = await db.getFirstAsync<ProfileRow>('SELECT * FROM profile WHERE id = 1;');
  if (!row) return null;
  return {
    psoriasisType: row.psoriasis_type as PsoriasisType,
    onsetYear: row.onset_year,
    onSystemic: bool(row.on_systemic),
    latitude: row.latitude,
    longitude: row.longitude,
    cityLabel: row.city_label,
    disclaimerAckAt: row.disclaimer_ack_at,
    createdAt: row.created_at,
  };
}

export async function saveProfile(db: SQLiteDatabase, profile: Profile): Promise<void> {
  await db.runAsync(
    `INSERT INTO profile
       (id, psoriasis_type, onset_year, on_systemic, latitude, longitude,
        city_label, disclaimer_ack_at, created_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       psoriasis_type = excluded.psoriasis_type,
       onset_year     = excluded.onset_year,
       on_systemic    = excluded.on_systemic,
       latitude       = excluded.latitude,
       longitude      = excluded.longitude,
       city_label     = excluded.city_label;`,
    profile.psoriasisType,
    profile.onsetYear,
    int(profile.onSystemic),
    profile.latitude,
    profile.longitude,
    profile.cityLabel,
    profile.disclaimerAckAt,
    profile.createdAt,
  );
}

// --------------------------------------------------------------------------
// Check-ins
// --------------------------------------------------------------------------

function toCheckIn(row: CheckInRow): CheckIn {
  return {
    date: row.date,
    severity: row.severity,
    itch: row.itch,
    stress: row.stress,
    sleepHours: row.sleep_hours,
    waterGlasses: row.water_glasses,
    alcoholUnits: row.alcohol_units,
    dietDairy: bool(row.diet_dairy),
    dietGluten: bool(row.diet_gluten),
    dietProcessed: bool(row.diet_processed),
    dietSugar: bool(row.diet_sugar),
    dietRedMeat: bool(row.diet_red_meat),
    illness: bool(row.illness),
    soreThroat: bool(row.sore_throat),
    skinInjury: bool(row.skin_injury),
    newProduct: bool(row.new_product),
    medTaken: bool(row.med_taken),
    notes: row.notes,
    areas: row.areas ? row.areas.split(',').filter(Boolean) : [],
  };
}

export async function getCheckIn(db: SQLiteDatabase, date: string): Promise<CheckIn | null> {
  const row = await db.getFirstAsync<CheckInRow>('SELECT * FROM checkin WHERE date = ?;', date);
  return row ? toCheckIn(row) : null;
}

export async function listCheckIns(
  db: SQLiteDatabase,
  from: string,
  to: string,
): Promise<CheckIn[]> {
  const rows = await db.getAllAsync<CheckInRow>(
    'SELECT * FROM checkin WHERE date BETWEEN ? AND ? ORDER BY date ASC;',
    from,
    to,
  );
  return rows.map(toCheckIn);
}

/** The most recent check-in strictly before `date` — used to pre-fill sliders (FR-2.3). */
export async function getPreviousCheckIn(
  db: SQLiteDatabase,
  date: string,
): Promise<CheckIn | null> {
  const row = await db.getFirstAsync<CheckInRow>(
    'SELECT * FROM checkin WHERE date < ? ORDER BY date DESC LIMIT 1;',
    date,
  );
  return row ? toCheckIn(row) : null;
}

/** FR-4.2: distinct days logged, which gates whether a risk value is shown. */
export async function countCheckInDays(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM checkin;');
  return row?.n ?? 0;
}

/**
 * FR-2.5: exactly one row per calendar date; saving the same date again
 * overwrites, preserving the original `created_at`.
 */
export async function saveCheckIn(db: SQLiteDatabase, checkIn: CheckIn): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO checkin
       (date, severity, itch, stress, sleep_hours, water_glasses, alcohol_units,
        diet_dairy, diet_gluten, diet_processed, diet_sugar, diet_red_meat,
        illness, sore_throat, skin_injury, new_product, med_taken, notes, areas,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       severity = excluded.severity, itch = excluded.itch, stress = excluded.stress,
       sleep_hours = excluded.sleep_hours, water_glasses = excluded.water_glasses,
       alcohol_units = excluded.alcohol_units, diet_dairy = excluded.diet_dairy,
       diet_gluten = excluded.diet_gluten, diet_processed = excluded.diet_processed,
       diet_sugar = excluded.diet_sugar, diet_red_meat = excluded.diet_red_meat,
       illness = excluded.illness, sore_throat = excluded.sore_throat,
       skin_injury = excluded.skin_injury, new_product = excluded.new_product,
       med_taken = excluded.med_taken, notes = excluded.notes, areas = excluded.areas,
       updated_at = excluded.updated_at;`,
    checkIn.date,
    checkIn.severity,
    checkIn.itch,
    checkIn.stress,
    checkIn.sleepHours,
    checkIn.waterGlasses,
    checkIn.alcoholUnits,
    int(checkIn.dietDairy),
    int(checkIn.dietGluten),
    int(checkIn.dietProcessed),
    int(checkIn.dietSugar),
    int(checkIn.dietRedMeat),
    int(checkIn.illness),
    int(checkIn.soreThroat),
    int(checkIn.skinInjury),
    int(checkIn.newProduct),
    int(checkIn.medTaken),
    checkIn.notes,
    checkIn.areas.length > 0 ? checkIn.areas.join(',') : null,
    now,
    now,
  );
}

/**
 * Remove a single day's check-in. Returns whether a row was actually deleted.
 *
 * Editing a day overwrites it (FR-2.5); this is the only way to get a date
 * back to genuinely un-logged, which is what the Today screen keys its
 * "How is your skin today?" state off.
 */
export async function deleteCheckIn(db: SQLiteDatabase, date: string): Promise<boolean> {
  const result = await db.runAsync('DELETE FROM checkin WHERE date = ?;', date);
  return result.changes > 0;
}

// --------------------------------------------------------------------------
// Environment
// --------------------------------------------------------------------------

export async function upsertEnvironment(
  db: SQLiteDatabase,
  days: readonly EnvironmentDay[],
): Promise<void> {
  if (days.length === 0) return;
  await serialize(() =>
    db.withTransactionAsync(async () => {
      for (const day of days) {
        await db.runAsync(
        `INSERT INTO environment
           (date, temp_mean_c, temp_min_c, temp_max_c, humidity_mean_pct, dew_point_c,
            pressure_hpa, uv_index_max, precipitation_mm, wind_speed_max,
            pm2_5, pm10, ozone, pollen_total, is_forecast, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           temp_mean_c = excluded.temp_mean_c, temp_min_c = excluded.temp_min_c,
           temp_max_c = excluded.temp_max_c, humidity_mean_pct = excluded.humidity_mean_pct,
           dew_point_c = excluded.dew_point_c, pressure_hpa = excluded.pressure_hpa,
           uv_index_max = excluded.uv_index_max, precipitation_mm = excluded.precipitation_mm,
           wind_speed_max = excluded.wind_speed_max, pm2_5 = excluded.pm2_5,
           pm10 = excluded.pm10, ozone = excluded.ozone, pollen_total = excluded.pollen_total,
           is_forecast = excluded.is_forecast, fetched_at = excluded.fetched_at;`,
        day.date,
        day.tempMeanC,
        day.tempMinC,
        day.tempMaxC,
        day.humidityMeanPct,
        day.dewPointC,
        day.pressureHpa,
        day.uvIndexMax,
        day.precipitationMm,
        day.windSpeedMax,
        day.pm25,
        day.pm10,
        day.ozone,
        day.pollenTotal,
          int(day.isForecast),
          day.fetchedAt,
        );
      }
    }),
  );
}

function toEnvironmentDay(row: EnvironmentRow): EnvironmentDay {
  return {
    date: row.date,
    tempMeanC: row.temp_mean_c,
    tempMinC: row.temp_min_c,
    tempMaxC: row.temp_max_c,
    humidityMeanPct: row.humidity_mean_pct,
    dewPointC: row.dew_point_c,
    pressureHpa: row.pressure_hpa,
    uvIndexMax: row.uv_index_max,
    precipitationMm: row.precipitation_mm,
    windSpeedMax: row.wind_speed_max,
    pm25: row.pm2_5,
    pm10: row.pm10,
    ozone: row.ozone,
    pollenTotal: row.pollen_total,
    isForecast: bool(row.is_forecast),
    fetchedAt: row.fetched_at,
  };
}

/** Cached conditions for one date, or null when nothing has been fetched. */
export async function getEnvironmentDay(
  db: SQLiteDatabase,
  date: string,
): Promise<EnvironmentDay | null> {
  const row = await db.getFirstAsync<EnvironmentRow>(
    'SELECT * FROM environment WHERE date = ?;',
    date,
  );
  return row ? toEnvironmentDay(row) : null;
}

/** API-3 / FR-3.4: the rate limiter reads this rather than any in-memory flag. */
export async function getLastEnvironmentFetch(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ fetched_at: string }>(
    'SELECT fetched_at FROM environment ORDER BY fetched_at DESC LIMIT 1;',
  );
  return row?.fetched_at ?? null;
}

export async function countEnvironmentDays(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM environment;');
  return row?.n ?? 0;
}

// --------------------------------------------------------------------------
// Wearable
// --------------------------------------------------------------------------

export async function upsertWearable(
  db: SQLiteDatabase,
  days: readonly WearableDay[],
): Promise<void> {
  if (days.length === 0) return;
  await serialize(() =>
    db.withTransactionAsync(async () => {
      for (const day of days) {
        await db.runAsync(
        `INSERT INTO wearable (date, sleep_hours, sleep_efficiency, resting_hr, hrv, steps, source, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           sleep_hours = excluded.sleep_hours, sleep_efficiency = excluded.sleep_efficiency,
           resting_hr = excluded.resting_hr, hrv = excluded.hrv, steps = excluded.steps,
           source = excluded.source, fetched_at = excluded.fetched_at;`,
        day.date,
        day.sleepHours,
        day.sleepEfficiency,
        day.restingHr,
        day.hrv,
        day.steps,
          day.source,
          day.fetchedAt,
        );
      }
    }),
  );
}

/** A single date's wearable reading, or null. Used by the check-in's Body & wearable step. */
export async function getWearableDay(
  db: SQLiteDatabase,
  date: string,
): Promise<WearableDay | null> {
  const row = await db.getFirstAsync<WearableRow>('SELECT * FROM wearable WHERE date = ?;', date);
  if (!row) return null;
  return {
    date: row.date,
    sleepHours: row.sleep_hours,
    sleepEfficiency: row.sleep_efficiency,
    restingHr: row.resting_hr,
    hrv: row.hrv,
    steps: row.steps,
    // The column is unconstrained TEXT; anything unrecognised is treated as
    // Health Connect, the only source HD-1's stub could ever write.
    source: row.source === 'healthkit' ? 'healthkit' : 'health_connect',
    fetchedAt: row.fetched_at,
  };
}

// --------------------------------------------------------------------------
// Meta — small key/value preferences and feature state that don't warrant
// their own table (§6 keeps the schema to what a migration actually needs).
// --------------------------------------------------------------------------

export async function getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?;',
    key,
  );
  return row?.value ?? null;
}

export async function setMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
    key,
    value,
  );
}

export async function deleteMeta(db: SQLiteDatabase, key: string): Promise<void> {
  await db.runAsync('DELETE FROM meta WHERE key = ?;', key);
}

// --------------------------------------------------------------------------
// Journal (Reset → Mood)
// --------------------------------------------------------------------------

interface JournalRow {
  id: number;
  date: string;
  body: string;
  created_at: string;
}

/** Reset's journal is private, local-only text — never read by the model. */
export async function saveJournalEntry(
  db: SQLiteDatabase,
  date: string,
  body: string,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO journal_entry (date, body, created_at) VALUES (?, ?, ?);',
    date,
    body,
    new Date().toISOString(),
  );
}

export async function listJournalEntries(
  db: SQLiteDatabase,
  limit = 20,
): Promise<JournalEntry[]> {
  const rows = await db.getAllAsync<JournalRow>(
    'SELECT * FROM journal_entry ORDER BY created_at DESC LIMIT ?;',
    limit,
  );
  return rows.map((row) => ({ id: row.id, date: row.date, body: row.body, createdAt: row.created_at }));
}

// --------------------------------------------------------------------------
// Predictions
// --------------------------------------------------------------------------

export async function insertPrediction(
  db: SQLiteDatabase,
  record: Omit<PredictionRecord, 'id'>,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO prediction (computed_at, for_date, probability, band, model_version, top_features)
     VALUES (?, ?, ?, ?, ?, ?);`,
    record.computedAt,
    record.forDate,
    record.probability,
    record.band,
    record.modelVersion,
    JSON.stringify(record.topFeatures),
  );
}

export async function getRecentPredictions(
  db: SQLiteDatabase,
  limit = 30,
): Promise<PredictionRecord[]> {
  const rows = await db.getAllAsync<{
    id: number;
    computed_at: string;
    for_date: string;
    probability: number;
    band: string;
    model_version: string;
    top_features: string;
  }>('SELECT * FROM prediction ORDER BY computed_at DESC LIMIT ?;', limit);

  return rows.map((row) => ({
    id: row.id,
    computedAt: row.computed_at,
    forDate: row.for_date,
    probability: row.probability,
    band: row.band as RiskBand,
    modelVersion: row.model_version,
    topFeatures: safeParse(row.top_features),
  }));
}

function safeParse(json: string): { feature: string; contribution: number }[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as { feature: string; contribution: number }[]) : [];
  } catch {
    console.warn('[fleur] could not parse stored top_features');
    return [];
  }
}

// --------------------------------------------------------------------------
// The ML join
// --------------------------------------------------------------------------

/**
 * Assemble the daily rows the feature pipeline consumes (§7.1), joining
 * check-ins, environment and wearable on date.
 *
 * Keys stay snake_case: these are ML variable names, and `features.ts` is a
 * mirror of `features.py` where they are snake_case too.
 */
export async function loadFeatureInputRows(
  db: SQLiteDatabase,
  endDate: string = todayLocal(),
  days = 45,
): Promise<FeatureInputRow[]> {
  const startDate = addDays(endDate, -(days - 1));

  const [checkIns, environment, wearable] = await Promise.all([
    db.getAllAsync<CheckInRow>(
      'SELECT * FROM checkin WHERE date BETWEEN ? AND ? ORDER BY date ASC;',
      startDate,
      endDate,
    ),
    db.getAllAsync<EnvironmentRow>(
      'SELECT * FROM environment WHERE date BETWEEN ? AND ? ORDER BY date ASC;',
      startDate,
      endDate,
    ),
    db.getAllAsync<WearableRow>(
      'SELECT * FROM wearable WHERE date BETWEEN ? AND ? ORDER BY date ASC;',
      startDate,
      endDate,
    ),
  ]);

  const merged = new Map<string, Record<string, string | number | null>>();
  const ensure = (date: string): Record<string, string | number | null> => {
    let row = merged.get(date);
    if (!row) {
      row = { date };
      merged.set(date, row);
    }
    return row;
  };

  for (const c of checkIns) {
    Object.assign(ensure(c.date), {
      severity: c.severity,
      itch: c.itch,
      stress: c.stress,
      sleep_hours: c.sleep_hours,
      water_glasses: c.water_glasses,
      alcohol_units: c.alcohol_units,
      diet_dairy: c.diet_dairy,
      diet_gluten: c.diet_gluten,
      diet_processed: c.diet_processed,
      diet_sugar: c.diet_sugar,
      diet_red_meat: c.diet_red_meat,
      illness: c.illness,
      sore_throat: c.sore_throat,
      skin_injury: c.skin_injury,
    });
  }

  for (const e of environment) {
    Object.assign(ensure(e.date), {
      temp_mean_c: e.temp_mean_c,
      humidity_mean_pct: e.humidity_mean_pct,
      dew_point_c: e.dew_point_c,
      pressure_hpa: e.pressure_hpa,
      uv_index_max: e.uv_index_max,
      precipitation_mm: e.precipitation_mm,
      pm2_5: e.pm2_5,
      pollen_total: e.pollen_total,
    });
  }

  for (const w of wearable) {
    Object.assign(ensure(w.date), {
      sleep_hours_device: w.sleep_hours,
      resting_hr: w.resting_hr,
      steps: w.steps,
    });
  }

  return [...merged.values()]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((row) => row as FeatureInputRow);
}

// --------------------------------------------------------------------------
// FR-6.3 CSV export
// --------------------------------------------------------------------------

const CSV_COLUMNS = [
  'date', 'severity', 'itch', 'stress', 'sleep_hours', 'water_glasses', 'alcohol_units',
  'diet_dairy', 'diet_gluten', 'diet_processed', 'diet_sugar', 'diet_red_meat',
  'illness', 'sore_throat', 'skin_injury', 'new_product', 'med_taken', 'notes', 'areas',
  'temp_mean_c', 'humidity_mean_pct', 'dew_point_c', 'pressure_hpa', 'uv_index_max',
  'precipitation_mm', 'pm2_5', 'pollen_total', 'sleep_hours_device', 'resting_hr', 'steps',
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Everything the user has logged, as CSV. Stays on the device unless they share it. */
export async function exportCsv(db: SQLiteDatabase): Promise<string> {
  const checkIns = await db.getAllAsync<CheckInRow & { notes: string | null }>(
    'SELECT * FROM checkin ORDER BY date ASC;',
  );
  if (checkIns.length === 0) return `${CSV_COLUMNS.join(',')}\n`;

  const rows = await loadFeatureInputRows(
    db,
    checkIns[checkIns.length - 1].date,
    Math.max(1, checkIns.length + 400),
  );
  const byDate = new Map(rows.map((row) => [row.date, row]));

  const lines = [CSV_COLUMNS.join(',')];
  for (const checkIn of checkIns) {
    const joined = byDate.get(checkIn.date) ?? {};
    const record: Record<string, unknown> = { ...joined, ...checkIn };
    lines.push(CSV_COLUMNS.map((column) => csvCell(record[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}
