import type { WearableDay } from '../types/models';

export const HEALTH_ENABLED = false;

export const REQUESTED_SCOPES = ['sleep_analysis', 'resting_heart_rate', 'step_count'] as const;

export const READ_WINDOW_DAYS = 14;
export const MIN_READ_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type HealthAvailability =
  | 'disabled'
  | 'unsupported'
  | 'denied'
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
  return 'unsupported';
}

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
