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

import { getApiKey, forgetApiKey } from '../ai/keyStore';
import { buildPayload } from '../ai/payload';
import { AI_MODEL, askForSecondOpinion } from '../ai/secondOpinion';
import { canFetch, fetchEnvironment, isStale, type Coordinates } from '../api/openMeteo';
import { clearAiOpinions, getAiOpinion, getMeta, loadFeatureInputRows,
  getLastEnvironmentFetch, getProfile, insertPrediction, saveAiOpinion, setMeta,
  saveCheckIn as saveCheckInRow, upsertEnvironment } from '../db/queries';
import { resetDatabase, runMigrations } from '../db/migrations';
import { DATABASE_NAME } from '../db/schema';
import { buildDailyFrame, checkinDayCount, MIN_HISTORY_DAYS } from '../logic/frame';
import { rulebook } from '../logic/rulebook';
import { deriveRiskState, type RiskState } from '../logic/risk';
import type { CheckIn, Profile, StoredAiOpinion } from '../types/models';
import { todayLocal } from '../utils/dates';

export { rulebook };
export type { RiskState } from '../logic/risk';

export type EnvironmentStatus = 'idle' | 'fetching' | 'ok' | 'unavailable';

export type AnalysisMode = 'local' | 'local_plus_ai';
export type AiStatus = 'off' | 'loading' | 'ok' | 'unavailable';

const ANALYSIS_MODE_KEY = 'analysis_mode';

interface AppState {
  ready: boolean;
  profile: Profile | null;
  risk: RiskState;
  environmentStatus: EnvironmentStatus;
  checkinDays: number;
  today: string;
  todayLogged: boolean;
  db: SQLite.SQLiteDatabase | null;
  analysisMode: AnalysisMode;
  aiOpinion: StoredAiOpinion | null;
  aiStatus: AiStatus;
  setAnalysisMode: (mode: AnalysisMode) => Promise<void>;
  refreshAiOpinion: (force?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  saveCheckIn: (checkIn: CheckIn) => Promise<void>;
  setProfile: (profile: Profile) => void;
  refreshEnvironment: (coordinates: Coordinates, force?: boolean) => Promise<boolean>;
  deleteAllData: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

// Holds the database, profile and current score for the whole app.
export function AppProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const fetchInFlight = useRef(false);
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [risk, setRisk] = useState<RiskState>({ status: 'loading' });
  const [environmentStatus, setEnvironmentStatus] = useState<EnvironmentStatus>('idle');
  const [checkinDays, setCheckinDays] = useState(0);
  const [todayLogged, setTodayLogged] = useState(false);
  const [analysisMode, setAnalysisModeState] = useState<AnalysisMode>('local');
  const [aiOpinion, setAiOpinion] = useState<StoredAiOpinion | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus>('off');
  const aiInFlight = useRef(false);
  const today = todayLocal();

  const recompute = useCallback(async (): Promise<void> => {
    const db = dbRef.current;
    if (!db) return;

    try {
      const rows = await loadFeatureInputRows(db, todayLocal());
      setCheckinDays(checkinDayCount(buildDailyFrame(rows)));
      setTodayLogged(rows.some((r) => r.date === todayLocal() && r.severity !== null &&
        r.severity !== undefined));

      const next = deriveRiskState(rows, rulebook);
      setRisk(next);

      if (next.status === 'ready') {
        try {
          await insertPrediction(db, {
            computedAt: new Date().toISOString(),
            forDate: next.date,
            probability: next.score / 100,
            band: next.band,
            modelVersion: rulebook.rulebook_version,
            topFeatures: next.drivers.map((r) => ({ feature: r.id, contribution: r.points })),
            source: 'local',
          });
        } catch (error) {
          console.error('[fleur] could not log prediction (risk value is still correct)', error);
        }
      }
    } catch (error) {
      console.error('[fleur] recompute failed, the score on screen may be out of date', error);
    }
  }, []);

  const refreshAiOpinion = useCallback(
    async (force = false): Promise<void> => {
      const db = dbRef.current;
      if (!db) return;

      const mode = (await getMeta(db, ANALYSIS_MODE_KEY)) as AnalysisMode | null;
      if (mode !== 'local_plus_ai') {
        setAiStatus('off');
        setAiOpinion(null);
        return;
      }

      const date = todayLocal();
      if (!force) {
        const cached = await getAiOpinion(db, date);
        if (cached) {
          setAiOpinion(cached);
          setAiStatus('ok');
          return;
        }
      }

      if (aiInFlight.current) return;
      aiInFlight.current = true;
      setAiStatus('loading');
      try {
        const apiKey = await getApiKey();
        if (!apiKey) {
          setAiStatus('unavailable');
          return;
        }

        const rows = await loadFeatureInputRows(db, date);
        const frame = buildDailyFrame(rows);
        if (frame.dates.length === 0) {
          setAiStatus('unavailable');
          return;
        }

        const opinion = await askForSecondOpinion(
          buildPayload(frame, frame.dates.length - 1),
          apiKey,
        );
        if (!opinion) {
          setAiStatus('unavailable');
          return;
        }

        const stored: StoredAiOpinion = {
          date,
          score: opinion.score,
          band: opinion.band,
          factorIds: opinion.factorIds,
          summary: opinion.summary,
          model: AI_MODEL,
          createdAt: new Date().toISOString(),
        };
        await saveAiOpinion(db, stored);
        setAiOpinion(stored);
        setAiStatus('ok');
      } catch (error) {
        console.warn('[fleur] AI second opinion unavailable', error);
        setAiStatus('unavailable');
      } finally {
        aiInFlight.current = false;
      }
    },
    [],
  );

  const setAnalysisMode = useCallback(
    async (mode: AnalysisMode): Promise<void> => {
      const db = dbRef.current;
      if (!db) return;
      await setMeta(db, ANALYSIS_MODE_KEY, mode);
      setAnalysisModeState(mode);
      if (mode === 'local') {
        setAiStatus('off');
        setAiOpinion(null);
      } else {
        await refreshAiOpinion();
      }
    },
    [refreshAiOpinion],
  );

  const refresh = useCallback(async (): Promise<void> => {
    const db = dbRef.current;
    if (!db) return;
    try {
      setProfileState(await getProfile(db));
    } catch (error) {
      console.error('[fleur] could not reload profile', error);
    }
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
        const mode = (await getMeta(db, ANALYSIS_MODE_KEY)) as AnalysisMode | null;
        if (!cancelled && mode === 'local_plus_ai') setAnalysisModeState(mode);
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

  useEffect(() => {
    if (!ready || analysisMode !== 'local_plus_ai') return;
    void refreshAiOpinion();
  }, [ready, analysisMode, refreshAiOpinion]);

  const saveCheckIn = useCallback(
    async (checkIn: CheckIn): Promise<void> => {
      const db = dbRef.current;
      if (!db) return;
      await saveCheckInRow(db, checkIn);
      await recompute();
      if (checkIn.date === todayLocal() && analysisMode === 'local_plus_ai') {
        await refreshAiOpinion(true);
      }
    },
    [recompute, analysisMode, refreshAiOpinion],
  );

  const setProfile = useCallback((next: Profile): void => {
    setProfileState(next);
  }, []);

  const refreshEnvironment = useCallback(
    async (coordinates: Coordinates, force = false): Promise<boolean> => {
      const db = dbRef.current;
      if (!db) return false;

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
        await recompute();
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

  const deleteAllData = useCallback(async (): Promise<void> => {
    const db = dbRef.current;
    if (!db) return;
    await resetDatabase(db);
    await forgetApiKey();
    setProfileState(null);
    setCheckinDays(0);
    setTodayLogged(false);
    setAnalysisModeState('local');
    setAiOpinion(null);
    setAiStatus('off');
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
      analysisMode,
      aiOpinion,
      aiStatus,
      setAnalysisMode,
      refreshAiOpinion,
      refresh,
      saveCheckIn,
      setProfile,
      refreshEnvironment,
      deleteAllData,
    }),
    [ready, profile, risk, environmentStatus, checkinDays, today, todayLogged,
     analysisMode, aiOpinion, aiStatus, setAnalysisMode, refreshAiOpinion, refresh,
     saveCheckIn, setProfile, refreshEnvironment, deleteAllData],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
