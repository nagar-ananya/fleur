/**
 * Date helpers (REQUIREMENTS §16).
 *
 * Dates are always 'YYYY-MM-DD' strings in the user's *local* calendar. A
 * check-in belongs to the day the person lived through, not to a UTC instant —
 * someone logging at 11pm must not have it filed under tomorrow.
 */

const MS_PER_DAY = 86_400_000;

function pad(value: number): string {
  return `${value}`.padStart(2, '0');
}

/** Today in the device's local timezone. */
export function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Calendar arithmetic on the date parts only. UTC is used purely as a fixed
 * frame for counting days, so DST transitions cannot shift a result.
 */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * MS_PER_DAY);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

export function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number);
  const [by, bm, bd] = to.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / MS_PER_DAY);
}

/** Inclusive range, oldest first. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const span = daysBetween(from, to);
  for (let i = 0; i <= span; i += 1) out.push(addDays(from, i));
  return out;
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
}

/** FR-2.4: back-filling is allowed for the last 7 days, and never the future. */
export function isEditableDate(date: string, today: string = todayLocal()): boolean {
  const delta = daysBetween(date, today);
  return delta >= 0 && delta <= 7;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function localDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Wednesday, 29 July" */
export function formatLong(date: string): string {
  const dt = localDate(date);
  return `${WEEKDAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

/** "29 Jul" */
export function formatShort(date: string): string {
  const dt = localDate(date);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()].slice(0, 3)}`;
}

export function formatRelative(date: string, today: string = todayLocal()): string {
  const delta = daysBetween(date, today);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  if (delta > 1 && delta < 7) return `${delta} days ago`;
  return formatShort(date);
}

export function weekdayInitial(date: string): string {
  return WEEKDAYS[localDate(date).getDay()].charAt(0);
}

export function monthLabel(date: string): string {
  const dt = localDate(date);
  return `${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}
