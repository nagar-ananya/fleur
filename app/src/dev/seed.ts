/**
 * Developer-mode data seeding.
 *
 * NOT A PRODUCT FEATURE. The Settings entry that calls this is hidden unless
 * developer mode is on: always in a development build (`DEV_TOOLS_ENABLED`),
 * and in a release build only after tapping the Settings footer
 * `DEV_MODE_TAPS` times, so a demo phone can be filled without a computer.
 *
 * It exists because of a real testing problem. FR-4.2 refuses to show a risk
 * value until 14 distinct days are logged, and FR-2.4 caps back-filling at 7
 * days — so on a fresh install the forecast, its contributor list and
 * `/risk-detail` are all unreachable for a fortnight. That makes the most
 * important screens in the app impossible to review by hand.
 *
 * The generated series deliberately mirrors the shape `ml/simulate.py` builds:
 * autocorrelated self-reports rather than i.i.d. noise, a planted illness
 * episode and a stressful stretch at lags the rules can actually see, and a
 * recent upward drift so the risk lands somewhere interesting rather than
 * pinned at the floor.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { saveCheckIn } from '../db/queries';
import { emptyCheckIn, type CheckIn } from '../types/models';
import { addDays, todayLocal } from '../utils/dates';

/** Developer mode's starting state: on in development builds, off in release. */
export const DEV_TOOLS_ENABLED: boolean = __DEV__;

/** `meta` key remembering whether developer mode was switched on or off. */
export const DEV_MODE_KEY = 'dev_mode';

/** Taps on the Settings footer that toggle developer mode. */
export const DEV_MODE_TAPS = 5;

export const DEFAULT_SEED_DAYS = 30;

/** Small deterministic PRNG, so re-seeding twice gives the same history. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

export interface SeedResult {
  days: number;
  from: string;
  to: string;
}

/**
 * Write `days` consecutive check-ins ending today.
 *
 * Uses the normal `saveCheckIn` path — same upsert, same validation, same
 * one-row-per-date rule (FR-2.5) — so seeded data is indistinguishable from
 * hand-entered data and re-running simply overwrites.
 */
export async function seedDemoCheckIns(
  db: SQLiteDatabase,
  days: number = DEFAULT_SEED_DAYS,
  seed = 20260730,
): Promise<SeedResult> {
  const random = mulberry32(seed);
  const today = todayLocal();
  const from = addDays(today, -(days - 1));

  // Autocorrelated wander rather than independent draws (SIM-4's reasoning).
  let severityNoise = 0;
  let stressNoise = 0;
  let sleepNoise = 0;

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const daysAgo = offset;

    severityNoise = 0.6 * severityNoise + (random() - 0.5) * 1.8;
    stressNoise = 0.6 * stressNoise + (random() - 0.5) * 3.4;
    sleepNoise = 0.55 * sleepNoise + (random() - 0.5) * 1.8;

    // A stressful fortnight, then an illness — both placed at lags the rules
    // can see, so the contributor list on /risk-detail has real content.
    const stressfulStretch = daysAgo <= 13 && daysAgo >= 8;
    const illnessEpisode = daysAgo <= 12 && daysAgo >= 9;
    const soreThroatDays = daysAgo <= 12 && daysAgo >= 11;
    const injuryDay = daysAgo === 12;

    // Recent upward drift, so the forecast is not pinned at the floor.
    const drift = daysAgo <= 4 ? (5 - daysAgo) * 0.55 : 0;

    const severity = Math.round(
      clamp(3.4 + severityNoise + drift + (illnessEpisode ? 0.8 : 0), 0, 10),
    );
    const stress = Math.round(
      clamp(4 + stressNoise + (stressfulStretch ? 2.8 : 0), 0, 10),
    );
    const sleepHours =
      Math.round(clamp(7.2 + sleepNoise - (stressfulStretch ? 1.1 : 0), 3.5, 10) * 2) / 2;

    const weekend = [0, 6].includes(dayOfWeek(date));

    const checkIn: CheckIn = {
      ...emptyCheckIn(date),
      severity,
      itch: Math.round(clamp(severity * 0.7 + (random() - 0.5) * 2.4, 0, 10)),
      stress,
      sleepHours,
      waterGlasses: Math.round(clamp(6 + (random() - 0.5) * 4, 0, 25)),
      alcoholUnits: weekend
        ? Math.round(clamp(random() * 5, 0, 20) * 2) / 2
        : Math.round(clamp(random() * 1.4, 0, 20) * 2) / 2,
      dietDairy: random() < 0.45,
      dietGluten: random() < 0.55,
      dietProcessed: random() < 0.3,
      dietSugar: random() < 0.45,
      dietRedMeat: random() < 0.25,
      illness: illnessEpisode,
      soreThroat: soreThroatDays,
      skinInjury: injuryDay,
      newProduct: daysAgo === 20,
      medTaken: random() < 0.85,
      notes: null,
    };

    await saveCheckIn(db, checkIn);
  }

  return { days, from, to: today };
}

function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
