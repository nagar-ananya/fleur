import { useCallback, useEffect, useState } from 'react';

import { getMeta, listCheckIns, setMeta, deleteMeta } from '../db/queries';
import { addDays, daysBetween, todayLocal } from '../utils/dates';
import { useApp } from './appState';

const META_KEY = 'elimination_test';
export const ELIMINATION_TOTAL_DAYS = 14;
export const ELIMINATION_PHASE_DAYS = 7;

export const ELIMINATION_CANDIDATES: Readonly<Record<string, string>> = {
  alcohol_units: 'Alcohol',
  diet_dairy: 'Dairy',
  diet_gluten: 'Gluten',
  diet_processed: 'Processed food',
  diet_sugar: 'Sugar',
  diet_red_meat: 'Red meat',
};

interface StoredTest {
  variable: string;
  label: string;
  startDate: string;
}

export type EliminationState =
  | { status: 'none' }
  | { status: 'running'; variable: string; label: string; day: number; phase: 'usual' | 'avoiding' }
  | {
      status: 'complete';
      variable: string;
      label: string;
      week1Mean: number | null;
      week2Mean: number | null;
    };

export function useEliminationTest(): {
  state: EliminationState;
  loaded: boolean;
  start: (variable: string, label: string) => void;
  clear: () => void;
} {
  const { db } = useApp();
  const [state, setState] = useState<EliminationState>({ status: 'none' });
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!db) return;
    const raw = await getMeta(db, META_KEY);
    if (!raw) {
      setState({ status: 'none' });
      setLoaded(true);
      return;
    }
    const stored = safeParse(raw);
    if (!stored) {
      setState({ status: 'none' });
      setLoaded(true);
      return;
    }
    const today = todayLocal();
    const elapsed = daysBetween(stored.startDate, today);
    if (elapsed < ELIMINATION_TOTAL_DAYS) {
      setState({
        status: 'running',
        variable: stored.variable,
        label: stored.label,
        day: elapsed + 1,
        phase: elapsed < ELIMINATION_PHASE_DAYS ? 'usual' : 'avoiding',
      });
      setLoaded(true);
      return;
    }
    const week1 = await listCheckIns(db, stored.startDate, addDays(stored.startDate, 6));
    const week2 = await listCheckIns(
      db,
      addDays(stored.startDate, 7),
      addDays(stored.startDate, 13),
    );
    setState({
      status: 'complete',
      variable: stored.variable,
      label: stored.label,
      week1Mean: mean(week1.map((c) => c.severity)),
      week2Mean: mean(week2.map((c) => c.severity)),
    });
    setLoaded(true);
  }, [db]);

  useEffect(() => {
    void load();
  }, [load]);

  const start = useCallback(
    (variable: string, label: string) => {
      if (!db) return;
      const stored: StoredTest = { variable, label, startDate: todayLocal() };
      void setMeta(db, META_KEY, JSON.stringify(stored)).then(load);
    },
    [db, load],
  );

  const clear = useCallback(() => {
    if (!db) return;
    void deleteMeta(db, META_KEY).then(load);
  }, [db, load]);

  return { state, loaded, start, clear };
}

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function safeParse(raw: string): StoredTest | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'variable' in parsed &&
      'label' in parsed &&
      'startDate' in parsed
    ) {
      return parsed as StoredTest;
    }
    return null;
  } catch {
    return null;
  }
}
