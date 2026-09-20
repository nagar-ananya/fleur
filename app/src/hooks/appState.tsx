/**
 * Application state: React Context + hooks, per §5.1. No Redux, no Zustand.
 *
 * Owns the database handle, the profile, the current risk, and the environment
 * refresh cycle. Scoring is synchronous and cheap (§11.2), so risk is recomputed
 * eagerly on app open, on check-in save, and after a successful fetch (FR-4.3)
 * rather than being memoised behind an effect.
 */

import * as SQLite from 'expo-sqlite';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import modelJson from '../../assets/model.json';
import { canFetch, fetchEnvironment, isStale, type Coordinates } from '../api/openMeteo';
import { loadFeatureInputRows, getLastEnvironmentFetch, getProfile, insertPrediction,
  saveCheckIn as saveCheckInRow, upsertEnvironment } from '../db/queries';
import { resetDatabase, runMigrations } from '../db/migrations';
import { DATABASE_NAME } from '../db/schema';
import { latestFeatureVector, MIN_HISTORY_DAYS } from '../ml/features';
import type { Model } from '../ml/model';
import { score, topContributors, protectiveContributors, type Contribution } from '../ml/scorer';
import type { CheckIn, Profile } from '../types/models';
import type { RiskBand } from '../types/models';
import { todayLocal } from '../utils/dates';

export const model = modelJson as unknown as Model;

export type RiskState =
  | { status: 'loading' }
  /** Fewer than `min_days_required` distinct check-in days (FR-4.2). */
  | { status: 'collecting'; days: number; required: number }
  /** Enough history overall, but too much of the recent window is missing (§7.5.3). */
  | { status: 'sparse'; days: number }
  | {
      status: 'ready';
      probability: number;
      band: RiskBand;
      date: string;
      drivers: readonly Contribution[];
      protective: readonly Contribution[];
    };

export type EnvironmentStatus = 'idle' | 'fetching' | 'ok' | 'unavailable';

interface AppState {
  ready: boolean;
  profile: Profile | null;
  risk: RiskState;
  environmentStatus: EnvironmentStatus;
  checkinDays: number;
  today: string;
  todayLogged: boolean;
  db: SQLite.SQLiteDatabase | null;
  refresh: () => Promise<void>;
  saveCheckIn: (checkIn: CheckIn) => Promise<void>;
  setProfile: (profile: Profile) => void;
  refreshEnvironment: (coordinates: Coordinates, force?: boolean) => Promise<boolean>;
  deleteAllData: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);
  /** Guards against overlapping environment refreshes; see refreshEnvironment. */
  const fetchInFlight = useRef(false);
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [risk, setRisk] = useState<RiskState>({ status: 'loading' });
  const [environmentStatus, setEnvironmentStatus] = useState<EnvironmentStatus>('idle');
  const [checkinDays, setCheckinDays] = useState(0);
  const [todayLogged, setTodayLogged] = useState(false);
  const today = todayLocal();

  /** FR-4.1/FR-4.3: recompute entirely on-device, no network involved. */
  const recompute = useCallback(async (): Promise<void> => {
    const db = dbRef.current;
    if (!db) return;

    const rows = await loadFeatureInputRows(db, todayLocal());
    const { vector, canPredict, checkinDays: days, date } = latestFeatureVector(rows);
    setCheckinDays(days);
    setTodayLogged(rows.some((r) => r.date === todayLocal() && r.severity !== null &&
      r.severity !== undefined));

    if (days < MIN_HISTORY_DAYS) {
      setRisk({ status: 'collecting', days, required: MIN_HISTORY_DAYS });
      return;
    }
    if (!canPredict || date === null) {
      setRisk({ status: 'sparse', days });
      return;
    }

    const result = score(vector, model);
    setRisk({
      status: 'ready',
      probability: result.probability,
      band: result.band,
      date,
      drivers: topContributors(result),
      protective: protectiveContributors(result),
    });

    // §6.5: append-only log so predictions can be evaluated later.
    await insertPrediction(db, {
      computedAt: new Date().toISOString(),
      forDate: date,
      probability: result.probability,
      band: result.band,
      modelVersion: model.model_version,
      topFeatures: topContributors(result).map((c) => ({
        feature: c.name,
        contribution: c.contribution,
      })),
    });
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const db = dbRef.current;
    if (!db) return;
    setProfileState(await getProfile(db));
    await recompute();
  }, [recompute]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
        await runMigrations(db);
        if (cancelled) return;
        dbRef.current = db;
        setProfileState(await getProfile(db));
        await recompute();
      } catch (error) {
        console.error('[fleur] database init failed', error);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recompute]);

  const saveCheckIn = useCallback(
    async (checkIn: CheckIn): Promise<void> => {
      const db = dbRef.current;
      if (!db) return;
      await saveCheckInRow(db, checkIn);
      await recompute(); // FR-4.3
    },
    [recompute],
  );

  const setProfile = useCallback((next: Profile): void => {
    setProfileState(next);
  }, []);

  /**
   * FR-3.1 / API-3. Returns whether fresh data landed. A failure here is
   * non-blocking by design (FR-3.3) — the caller shows an indicator and the
   * cached rows keep working offline.
   */
  const refreshEnvironment = useCallback(
    async (coordinates: Coordinates, force = false): Promise<boolean> => {
      const db = dbRef.current;
      if (!db) return false;

      // The stored-timestamp rate limit (API-3) cannot catch overlapping
      // callers: on a first launch there is no `fetched_at` yet, so two
      // concurrent refreshes both pass it and then collide in SQLite. The
      // Today screen reliably triggers exactly that, because its effect re-runs
      // when `profile` arrives while the first fetch is still in flight.
      if (fetchInFlight.current) return false;

      const lastFetch = await getLastEnvironmentFetch(db);
      if (!canFetch(lastFetch)) return false;
      if (!force && !isStale(lastFetch)) return false;

      fetchInFlight.current = true;
      setEnvironmentStatus('fetching');
      try {
        const { days, ok } = await fetchEnvironment(coordinates, todayLocal());
        if (!ok || days.length === 0) {
          setEnvironmentStatus('unavailable');
          return false;
        }
        await upsertEnvironment(db, days);
        setEnvironmentStatus('ok');
        await recompute(); // FR-4.3
        return true;
      } catch (error) {
        console.warn('[fleur] environment refresh failed', error);
        setEnvironmentStatus('unavailable');
        return false;
      } finally {
        fetchInFlight.current = false;
      }
    },
    [recompute],
  );

  /** FR-7.2 / PRIV-4 */
  const deleteAllData = useCallback(async (): Promise<void> => {
    const db = dbRef.current;
    if (!db) return;
    await resetDatabase(db);
    setProfileState(null);
    setCheckinDays(0);
    setTodayLogged(false);
    setEnvironmentStatus('idle');
    setRisk({ status: 'collecting', days: 0, required: MIN_HISTORY_DAYS });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      ready,
      profile,
      risk,
      environmentStatus,
      checkinDays,
      today,
      todayLogged,
      db: dbRef.current,
      refresh,
      saveCheckIn,
      setProfile,
      refreshEnvironment,
      deleteAllData,
    }),
    [ready, profile, risk, environmentStatus, checkinDays, today, todayLogged, refresh,
     saveCheckIn, setProfile, refreshEnvironment, deleteAllData],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
