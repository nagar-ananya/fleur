/**
 * A small per-day checklist backed by the `meta` table.
 *
 * Wind-down and skin-routine ticks are real user state worth remembering for
 * the rest of the day, but they are not check-in data — ticking a step here
 * does not log medication adherence, that lives in the check-in where the
 * model reads it (see `SKIN_PM_STEPS`). Storing them in `meta` under a
 * date-scoped key keeps that boundary: a fresh key appears each day, and
 * nothing here ever reaches `loadFeatureInputRows`.
 */

import { useCallback, useEffect, useState } from 'react';

import { getMeta, setMeta } from '../db/queries';
import { useApp } from './appState';

export function useDailyChecklist(
  namespace: string,
  date: string,
): { done: Record<string, boolean>; toggle: (key: string) => void; loaded: boolean } {
  const { db } = useApp();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const storageKey = `checklist:${namespace}:${date}`;

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    setLoaded(false);
    void getMeta(db, storageKey).then((raw) => {
      if (cancelled) return;
      setDone(safeParse(raw));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db, storageKey]);

  const toggle = useCallback(
    (key: string) => {
      setDone((current) => {
        const next = { ...current, [key]: !current[key] };
        if (db) void setMeta(db, storageKey, JSON.stringify(next));
        return next;
      });
    },
    [db, storageKey],
  );

  return { done, toggle, loaded };
}

function safeParse(raw: string | null): Record<string, boolean> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}
