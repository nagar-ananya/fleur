export const SELF_VARS = [
  'severity',
  'itch',
  'stress',
  'sleep_hours',
  'water_glasses',
  'alcohol_units',
  'diet_dairy',
  'diet_gluten',
  'diet_processed',
  'diet_sugar',
  'diet_red_meat',
  'illness',
  'sore_throat',
  'skin_injury',
] as const;

export const ENV_VARS = [
  'temp_mean_c',
  'humidity_mean_pct',
  'dew_point_c',
  'pressure_hpa',
  'uv_index_max',
  'precipitation_mm',
  'pm2_5',
  'pollen_total',
] as const;

export const WEARABLE_VARS = ['sleep_hours_device', 'resting_hr', 'steps'] as const;

export const BASE_VARS: readonly string[] = [...SELF_VARS, ...ENV_VARS, ...WEARABLE_VARS];

export const FRAME_COLUMNS: readonly string[] = [
  ...BASE_VARS,
  'temp_delta_1d',
  'humidity_delta_1d',
  'pressure_delta_1d',
  'sleep_debt_7d',
  'severity_baseline',
  'severity_delta',
];

const MIN_PERIODS: Readonly<Record<number, number>> = { 3: 2, 7: 5, 14: 9 };

// A missing day can copy the day before it, but only for up to 3 days.
export const FFILL_LIMIT = 3;

export const MAX_MISSING_FRACTION = 0.4;
export const RECENT_WINDOW = 14;

// How many days of check-ins we need before showing a score.
export const MIN_HISTORY_DAYS = 14;

const BASELINE_WINDOW = 14;
const SLEEP_TARGET_HOURS = 7.5;
const SLEEP_DEBT_WINDOW = 7;

export interface FrameInputRow {
  readonly date: string;
  readonly [column: string]: string | number | null | undefined;
}

export type Series = (number | null)[];

export interface DailyFrame {
  readonly dates: readonly string[];
  readonly columns: Readonly<Record<string, Series>>;
  readonly hasCheckin: readonly number[];
}

const MS_PER_DAY = 86_400_000;

function toUtcMillis(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMillis(millis: number): string {
  const dt = new Date(millis);
  const month = `${dt.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${dt.getUTCDate()}`.padStart(2, '0');
  return `${dt.getUTCFullYear()}-${month}-${day}`;
}

export function addDays(date: string, days: number): string {
  return fromUtcMillis(toUtcMillis(date) + days * MS_PER_DAY);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMillis(to) - toUtcMillis(from)) / MS_PER_DAY);
}

function forwardFill(series: Series, limit: number): Series {
  const out: Series = new Array(series.length).fill(null);
  let last: number | null = null;
  let filled = 0;
  for (let i = 0; i < series.length; i += 1) {
    const value = series[i];
    if (value !== null) {
      out[i] = value;
      last = value;
      filled = 0;
    } else if (last !== null && filled < limit) {
      out[i] = last;
      filled += 1;
    } else {
      out[i] = null;
    }
  }
  return out;
}

function rollingMean(series: Series, window: number, minPeriods: number): Series {
  const out: Series = new Array(series.length).fill(null);
  for (let i = 0; i < series.length; i += 1) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - window + 1); j <= i; j += 1) {
      const value = series[j];
      if (value !== null) {
        sum += value;
        count += 1;
      }
    }
    out[i] = count >= minPeriods ? sum / count : null;
  }
  return out;
}

function rollingSumComplete(series: Series, window: number): Series {
  const out: Series = new Array(series.length).fill(null);
  for (let i = 0; i < series.length; i += 1) {
    if (i + 1 < window) continue;
    let sum = 0;
    let complete = true;
    for (let j = i - window + 1; j <= i; j += 1) {
      const value = series[j];
      if (value === null) {
        complete = false;
        break;
      }
      sum += value;
    }
    out[i] = complete ? sum : null;
  }
  return out;
}

function difference(series: Series): Series {
  return series.map((value, i) => {
    if (i === 0) return null;
    const previous = series[i - 1];
    return value === null || previous === null ? null : value - previous;
  });
}

function subtract(a: Series, b: Series): Series {
  return a.map((value, i) => {
    const other = b[i];
    return value === null || other === null ? null : value - other;
  });
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// Turns the saved rows into one list per column, with one value for every day.
export function buildDailyFrame(rows: readonly FrameInputRow[]): DailyFrame {
  if (rows.length === 0) {
    return { dates: [], columns: {}, hasCheckin: [] };
  }

  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byDate = new Map<string, FrameInputRow>();
  for (const row of sorted) byDate.set(row.date, row);

  const first = sorted[0].date;
  const span = daysBetween(first, sorted[sorted.length - 1].date);

  const dates: string[] = [];
  for (let i = 0; i <= span; i += 1) dates.push(addDays(first, i));

  const columns: Record<string, Series> = {};
  for (const name of BASE_VARS) {
    columns[name] = dates.map((date) => toNumber(byDate.get(date)?.[name]));
  }

  const hasCheckin = columns.severity.map((value) => (value === null ? 0 : 1));

  const deviceSleep = columns.sleep_hours_device;
  columns.sleep_hours = columns.sleep_hours.map((value, i) =>
    deviceSleep[i] !== null ? deviceSleep[i] : value,
  );

  for (const name of BASE_VARS) {
    columns[name] = forwardFill(columns[name], FFILL_LIMIT);
  }

  addDerived(columns);
  return { dates, columns, hasCheckin };
}

function addDerived(columns: Record<string, Series>): void {
  columns.temp_delta_1d = difference(columns.temp_mean_c);
  columns.humidity_delta_1d = difference(columns.humidity_mean_pct);
  columns.pressure_delta_1d = difference(columns.pressure_hpa);

  const slept = rollingSumComplete(columns.sleep_hours, SLEEP_DEBT_WINDOW);
  columns.sleep_debt_7d = slept.map((total) =>
    total === null ? null : Math.max(0, SLEEP_DEBT_WINDOW * SLEEP_TARGET_HOURS - total),
  );

  columns.severity_baseline = rollingMean(
    columns.severity,
    BASELINE_WINDOW,
    MIN_PERIODS[BASELINE_WINDOW],
  );
  columns.severity_delta = subtract(columns.severity, columns.severity_baseline);
}

export function recentCheckinCoverage(frame: DailyFrame, index: number): number {
  const start = Math.max(0, index - RECENT_WINDOW + 1);
  let sum = 0;
  for (let i = start; i <= index; i += 1) sum += frame.hasCheckin[i];
  return sum / (index - start + 1);
}

// No score if more than 40% of the last 14 days are missing.
export function canPredict(frame: DailyFrame, index: number): boolean {
  return recentCheckinCoverage(frame, index) >= 1 - MAX_MISSING_FRACTION;
}

export function checkinDayCount(frame: DailyFrame): number {
  return frame.hasCheckin.reduce<number>((total, flag) => total + flag, 0);
}
