/**
 * Open-Meteo client (REQUIREMENTS §10.1).
 *
 * The only outbound network calls in the entire product, carrying latitude and
 * longitude and nothing else (PRIV-2). No API key exists because none is
 * needed. Everything here degrades to "no data" rather than throwing: a failed
 * weather fetch must never stop someone logging a check-in (FR-3.3).
 */

import type { EnvironmentDay } from '../types/models';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

/** API-1 */
const TIMEOUT_MS = 10_000;
/** API-2: at most two retries, backing off 1s then 4s. */
const RETRY_DELAYS_MS = [1_000, 4_000];
/** API-3 / FR-3.4: never more than one request per hour per endpoint. */
export const MIN_FETCH_INTERVAL_MS = 60 * 60 * 1000;
/** FR-3.1: refresh once the cached data is older than this. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export const PAST_DAYS = 14;
export const FORECAST_DAYS = 3;

const DAILY_FIELDS = [
  'temperature_2m_mean',
  'temperature_2m_min',
  'temperature_2m_max',
  'relative_humidity_2m_mean',
  'dew_point_2m_mean',
  'surface_pressure_mean',
  'uv_index_max',
  'precipitation_sum',
  'wind_speed_10m_max',
].join(',');

const HOURLY_AQ_FIELDS = [
  'pm2_5',
  'pm10',
  'ozone',
  'alder_pollen',
  'birch_pollen',
  'grass_pollen',
  'ragweed_pollen',
].join(',');

const POLLEN_SPECIES = ['alder_pollen', 'birch_pollen', 'grass_pollen', 'ragweed_pollen'] as const;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** PRIV-3: ~1km precision is plenty for weather and is all we will transmit. */
export function coarsen({ latitude, longitude }: Coordinates): Coordinates {
  return {
    latitude: Math.round(latitude * 100) / 100,
    longitude: Math.round(longitude * 100) / 100,
  };
}

class FetchError extends Error {}

async function getJson(url: string, params: Record<string, string>): Promise<unknown> {
  const query = new URLSearchParams(params).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${url}?${query}`, { signal: controller.signal });
    if (!response.ok) throw new FetchError(`HTTP ${response.status}`);
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

async function getJsonWithRetry(
  url: string,
  params: Record<string, string>,
): Promise<unknown | null> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await getJson(url, params);
    } catch (error) {
      const last = attempt === RETRY_DELAYS_MS.length;
      console.warn(
        `[fleur] open-meteo request failed (attempt ${attempt + 1})`,
        error instanceof Error ? error.message : error,
      );
      // API-2: give up silently once the retries are spent. The caller surfaces
      // a non-blocking indicator; it does not get an exception to handle.
      if (last) return null;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  return null;
}

// --------------------------------------------------------------------------
// API-4 response validation
// --------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberArray(value: unknown, length: number): (number | null)[] | null {
  if (!Array.isArray(value) || value.length !== length) return null;
  return value.map((item) => (typeof item === 'number' && Number.isFinite(item) ? item : null));
}

interface DailyBlock {
  time: string[];
  values: Record<string, (number | null)[]>;
}

/** Reject a malformed payload outright rather than writing a row of nulls. */
function parseDaily(payload: unknown, fields: readonly string[]): DailyBlock | null {
  if (!isRecord(payload) || !isRecord(payload.daily)) return null;
  const daily = payload.daily;
  const time = daily.time;
  if (!Array.isArray(time) || time.length === 0 || !time.every((t) => typeof t === 'string')) {
    return null;
  }
  const values: Record<string, (number | null)[]> = {};
  for (const field of fields) {
    const parsed = numberArray(daily[field], time.length);
    // A field the API stopped serving is tolerable; a length mismatch is not,
    // because it would silently misalign every value against its date.
    values[field] = parsed ?? new Array<number | null>(time.length).fill(null);
    if (daily[field] !== undefined && parsed === null) return null;
  }
  return { time: time as string[], values };
}

interface HourlyBlock {
  time: string[];
  values: Record<string, (number | null)[]>;
}

function parseHourly(payload: unknown, fields: readonly string[]): HourlyBlock | null {
  if (!isRecord(payload) || !isRecord(payload.hourly)) return null;
  const hourly = payload.hourly;
  const time = hourly.time;
  if (!Array.isArray(time) || time.length === 0 || !time.every((t) => typeof t === 'string')) {
    return null;
  }
  const values: Record<string, (number | null)[]> = {};
  for (const field of fields) {
    const parsed = numberArray(hourly[field], time.length);
    values[field] = parsed ?? new Array<number | null>(time.length).fill(null);
    if (hourly[field] !== undefined && parsed === null) return null;
  }
  return { time: time as string[], values };
}

/** §10.1: hourly air quality is aggregated to daily means before storage. */
function aggregateDaily(block: HourlyBlock): Map<string, Record<string, number | null>> {
  const sums = new Map<string, Record<string, { total: number; count: number }>>();

  block.time.forEach((stamp, index) => {
    const date = stamp.slice(0, 10);
    let bucket = sums.get(date);
    if (!bucket) {
      bucket = {};
      sums.set(date, bucket);
    }
    for (const [field, series] of Object.entries(block.values)) {
      const value = series[index];
      if (value === null) continue;
      const acc = bucket[field] ?? { total: 0, count: 0 };
      acc.total += value;
      acc.count += 1;
      bucket[field] = acc;
    }
  });

  const out = new Map<string, Record<string, number | null>>();
  for (const [date, bucket] of sums) {
    const record: Record<string, number | null> = {};
    for (const [field, acc] of Object.entries(bucket)) {
      record[field] = acc.count > 0 ? acc.total / acc.count : null;
    }
    // §10.1: pollen_total sums the available species, missing species as 0.
    // Left null only when no species reported at all, so an area with no
    // pollen coverage is not recorded as a genuine zero.
    const reported = POLLEN_SPECIES.filter((s) => typeof record[s] === 'number');
    record.pollen_total = reported.length
      ? reported.reduce((total, s) => total + (record[s] ?? 0), 0)
      : null;
    out.set(date, record);
  }
  return out;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export interface FetchOutcome {
  days: EnvironmentDay[];
  /** False when the network failed or the payload was rejected. */
  ok: boolean;
}

export async function fetchEnvironment(
  coordinates: Coordinates,
  today: string,
): Promise<FetchOutcome> {
  const { latitude, longitude } = coarsen(coordinates);
  const common = {
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: 'auto',
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
  };

  const [weatherRaw, airRaw] = await Promise.all([
    getJsonWithRetry(FORECAST_URL, { ...common, daily: DAILY_FIELDS }),
    getJsonWithRetry(AIR_QUALITY_URL, { ...common, hourly: HOURLY_AQ_FIELDS }),
  ]);

  const daily = parseDaily(weatherRaw, DAILY_FIELDS.split(','));
  if (!daily) {
    console.warn('[fleur] rejected malformed weather payload');
    return { days: [], ok: false };
  }

  const hourly = parseHourly(airRaw, HOURLY_AQ_FIELDS.split(','));
  if (airRaw !== null && !hourly) {
    console.warn('[fleur] rejected malformed air-quality payload');
  }
  const airByDate = hourly ? aggregateDaily(hourly) : new Map();

  const fetchedAt = new Date().toISOString();
  const pick = (field: string, index: number): number | null =>
    daily.values[field]?.[index] ?? null;

  const days: EnvironmentDay[] = daily.time.map((date, index) => {
    const air = airByDate.get(date) ?? {};
    return {
      date,
      tempMeanC: pick('temperature_2m_mean', index),
      tempMinC: pick('temperature_2m_min', index),
      tempMaxC: pick('temperature_2m_max', index),
      humidityMeanPct: pick('relative_humidity_2m_mean', index),
      dewPointC: pick('dew_point_2m_mean', index),
      pressureHpa: pick('surface_pressure_mean', index),
      uvIndexMax: pick('uv_index_max', index),
      precipitationMm: pick('precipitation_sum', index),
      windSpeedMax: pick('wind_speed_10m_max', index),
      pm25: air.pm2_5 ?? null,
      pm10: air.pm10 ?? null,
      ozone: air.ozone ?? null,
      pollenTotal: air.pollen_total ?? null,
      isForecast: date > today,
      fetchedAt,
    };
  });

  return { days, ok: true };
}

/** API-3: the hard rate limit, evaluated against the stored `fetched_at`. */
export function canFetch(lastFetchedAt: string | null, now: number = Date.now()): boolean {
  if (!lastFetchedAt) return true;
  const last = Date.parse(lastFetchedAt);
  if (Number.isNaN(last)) return true;
  return now - last >= MIN_FETCH_INTERVAL_MS;
}

/** FR-3.1: data older than 6 hours should be refreshed when the app opens. */
export function isStale(lastFetchedAt: string | null, now: number = Date.now()): boolean {
  if (!lastFetchedAt) return true;
  const last = Date.parse(lastFetchedAt);
  if (Number.isNaN(last)) return true;
  return now - last >= STALE_AFTER_MS;
}
