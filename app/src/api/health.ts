/**
 * Health-store integration (REQUIREMENTS §10.2).
 *
 * HD-1: behind a feature flag, defaulting to OFF.
 * HD-2: the app is fully functional and demoable with the flag off — manual
 *       sleep entry on the check-in form is the fallback.
 *
 * Target device is Fitbit, read via Android Health Connect (the `WearableDay`
 * type's `health_connect` source) — `wearableSourceLabel` in `types/models.ts`
 * is what turns that technical source value into "Fitbit" on screen. Reading
 * it for real needs `react-native-health-connect`, which needs a *development
 * build*: it does not work in Expo Go. §14.1 lists this as the first thing to
 * cut under time pressure, and §10.2 says to ship with the flag off if it is
 * not working by M6. That is what this file does — it defines the seam and
 * the fallback so nothing above it has to know whether real health data
 * exists.
 *
 * To enable later: install the native module, set HEALTH_ENABLED, and
 * implement `readTrailingDays` against it. Nothing else changes; the check-in
 * form already treats `wearable.sleep_hours` as authoritative when present
 * (HD-5, enforced in `features.ts`).
 */

import type { WearableDay } from '../types/models';

/** HD-1: off by default. Flipping this alone is not enough — see the note above. */
export const HEALTH_ENABLED = false;

/** HD-3: the only scopes we would ever request. Nothing else. */
export const REQUESTED_SCOPES = ['sleep_analysis', 'resting_heart_rate', 'step_count'] as const;

/** HD-4: read at most once a day, for the trailing 14 days. */
export const READ_WINDOW_DAYS = 14;
export const MIN_READ_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type HealthAvailability =
  | 'disabled' // flag off
  | 'unsupported' // no native module in this build
  | 'denied' // user said no
  | 'ready';

export interface HealthStatus {
  availability: HealthAvailability;
  lastReadAt: string | null;
}

export function isAvailable(): boolean {
  return HEALTH_ENABLED;
}

export async function requestPermissions(): Promise<HealthAvailability> {
  if (!HEALTH_ENABLED) return 'disabled';
  // No native module is linked in this build; callers must treat this as a
  // normal, expected outcome rather than an error (HD-2, FR-1.4).
  return 'unsupported';
}

/**
 * Trailing-window wearable data, or an empty array when unavailable.
 *
 * Returning `[]` rather than throwing is deliberate: every caller's correct
 * behaviour when there is no health data is "carry on with what the user typed".
 */
export async function readTrailingDays(_endDate: string): Promise<WearableDay[]> {
  if (!HEALTH_ENABLED) return [];
  return [];
}

export function canRead(lastReadAt: string | null, now: number = Date.now()): boolean {
  if (!HEALTH_ENABLED) return false;
  if (!lastReadAt) return true;
  const last = Date.parse(lastReadAt);
  if (Number.isNaN(last)) return true;
  return now - last >= MIN_READ_INTERVAL_MS;
}
