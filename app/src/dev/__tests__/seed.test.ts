import * as SQLite from 'expo-sqlite';

import { runMigrations } from '../../db/migrations';
import { countCheckInDays, getPreviousCheckIn, loadFeatureInputRows } from '../../db/queries';
import { rulebook } from '../../hooks/appState';
import { deriveRiskState, withDraftCheckIn, type RiskState } from '../../logic/risk';
import { emptyCheckIn, type CheckIn } from '../../types/models';
import { todayLocal } from '../../utils/dates';
import { seedDemoCheckIns } from '../seed';

type Db = Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>;

function score(state: RiskState): number {
  if (state.status !== 'ready') throw new Error(`no score: ${state.status}`);
  return state.score;
}

// Same as the check-in screen: start from yesterday's answers.
async function scoreWithToday(db: Db, change: Partial<CheckIn>): Promise<RiskState> {
  const today = todayLocal();
  const previous = await getPreviousCheckIn(db, today);
  const draft: CheckIn = {
    ...emptyCheckIn(today),
    severity: previous?.severity ?? 0,
    itch: previous?.itch ?? null,
    stress: previous?.stress ?? null,
    sleepHours: previous?.sleepHours ?? 8,
    alcoholUnits: 0,
    ...change,
  };
  const rows = await loadFeatureInputRows(db, today);
  return deriveRiskState(withDraftCheckIn(rows, draft), rulebook);
}

describe('demo seed', () => {
  let db: Db;
  let before: number;

  beforeAll(async () => {
    db = await SQLite.openDatabaseAsync(':memory:');
    await runMigrations(db);
    await seedDemoCheckIns(db);
    before = score(deriveRiskState(await loadFeatureInputRows(db, todayLocal()), rulebook));
  });

  it('writes 30 days and leaves today empty', async () => {
    expect(await countCheckInDays(db)).toBe(30);
    expect(await getPreviousCheckIn(db, todayLocal())).not.toBeNull();
  });

  it('lands just under High', () => {
    expect(before).toBeGreaterThanOrEqual(44);
    expect(before).toBeLessThan(rulebook.bands.high);
  });

  it('stays under High after a normal check-in', async () => {
    expect(score(await scoreWithToday(db, {}))).toBeLessThan(rulebook.bands.high);
  });

  it('goes clearly into High after a bad check-in', async () => {
    const after = score(
      await scoreWithToday(db, { severity: 8, itch: 8, stress: 8, sleepHours: 5, alcoholUnits: 2, dietProcessed: true }),
    );
    expect(after).toBeGreaterThanOrEqual(rulebook.bands.high + 10);
    expect(after - before).toBeGreaterThanOrEqual(15);
  });
});
