/**
 * Database tests (REQUIREMENTS §15.2).
 *
 * Required cases: migration from empty; the unique-per-date constraint;
 * delete-all clearing everything. Runs against real SQLite via the mock in
 * `src/db/__mocks__/expo-sqlite.ts`, so the schema's CHECK constraints and
 * upsert semantics are genuinely exercised.
 */

import * as SQLite from 'expo-sqlite';

import { resetDatabase, runMigrations } from '../migrations';
import { SCHEMA_VERSION, TABLE_NAMES } from '../schema';
import {
  countCheckInDays,
  deleteCheckIn,
  exportCsv,
  getCheckIn,
  getPreviousCheckIn,
  getProfile,
  insertPrediction,
  listCheckIns,
  loadFeatureInputRows,
  saveCheckIn,
  saveProfile,
  upsertEnvironment,
  upsertWearable,
} from '../queries';
import { emptyCheckIn, type CheckIn, type Profile } from '../../types/models';

type Db = Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>;

async function freshDb(): Promise<Db> {
  const db = await SQLite.openDatabaseAsync(':memory:');
  await runMigrations(db);
  return db;
}

const profile: Profile = {
  psoriasisType: 'plaque',
  onsetYear: 2015,
  onSystemic: true,
  latitude: 51.51,
  longitude: -0.13,
  cityLabel: 'London',
  disclaimerAckAt: '2026-01-01T09:00:00Z',
  createdAt: '2026-01-01T09:00:00Z',
};

function checkIn(date: string, overrides: Partial<CheckIn> = {}): CheckIn {
  return { ...emptyCheckIn(date), severity: 5, ...overrides };
}

describe('migrations', () => {
  it('builds every table from an empty database and records the version', async () => {
    const db = await freshDb();
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table';",
    );
    const names = tables.map((t) => t.name);
    for (const table of TABLE_NAMES) {
      expect(names).toContain(table);
    }
    const version = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM meta WHERE key = 'schema_version';",
    );
    expect(Number(version?.value)).toBe(SCHEMA_VERSION);
  });

  it('is idempotent when run again', async () => {
    const db = await freshDb();
    await saveCheckIn(db, checkIn('2026-01-01'));
    await runMigrations(db);
    // Re-running must not wipe anything.
    expect(await countCheckInDays(db)).toBe(1);
  });
});

describe('check-ins', () => {
  it('round-trips every field', async () => {
    const db = await freshDb();
    const original = checkIn('2026-02-01', {
      severity: 7,
      itch: 4,
      stress: 8,
      sleepHours: 6.5,
      waterGlasses: 5,
      alcoholUnits: 2.5,
      dietDairy: true,
      dietSugar: true,
      illness: true,
      soreThroat: true,
      skinInjury: true,
      newProduct: true,
      medTaken: true,
      notes: 'flare on both elbows',
    });
    await saveCheckIn(db, original);
    expect(await getCheckIn(db, '2026-02-01')).toEqual(original);
  });

  it('allows exactly one row per date, overwriting on a second save (FR-2.5)', async () => {
    const db = await freshDb();
    await saveCheckIn(db, checkIn('2026-02-01', { severity: 3 }));
    await saveCheckIn(db, checkIn('2026-02-01', { severity: 9, notes: 'worse' }));

    expect(await countCheckInDays(db)).toBe(1);
    const stored = await getCheckIn(db, '2026-02-01');
    expect(stored?.severity).toBe(9);
    expect(stored?.notes).toBe('worse');
  });

  it('preserves created_at across an overwrite', async () => {
    const db = await freshDb();
    await saveCheckIn(db, checkIn('2026-02-01', { severity: 3 }));
    const first = await db.getFirstAsync<{ created_at: string }>(
      'SELECT created_at FROM checkin WHERE date = ?;',
      '2026-02-01',
    );
    await saveCheckIn(db, checkIn('2026-02-01', { severity: 4 }));
    const second = await db.getFirstAsync<{ created_at: string }>(
      'SELECT created_at FROM checkin WHERE date = ?;',
      '2026-02-01',
    );
    expect(second?.created_at).toBe(first?.created_at);
  });

  it('rejects a severity outside 0-10 via the CHECK constraint', async () => {
    const db = await freshDb();
    await expect(saveCheckIn(db, checkIn('2026-02-01', { severity: 47 }))).rejects.toThrow();
  });

  it('finds the previous check-in for slider pre-fill (FR-2.3)', async () => {
    const db = await freshDb();
    await saveCheckIn(db, checkIn('2026-02-01', { severity: 2, stress: 3 }));
    await saveCheckIn(db, checkIn('2026-02-04', { severity: 6, stress: 8 }));
    const previous = await getPreviousCheckIn(db, '2026-02-05');
    expect(previous?.date).toBe('2026-02-04');
    expect(previous?.stress).toBe(8);
    expect(await getPreviousCheckIn(db, '2026-02-01')).toBeNull();
  });

  it('deletes a single day, returning a date to un-logged', async () => {
    const db = await freshDb();
    await saveCheckIn(db, checkIn('2026-02-01'));
    await saveCheckIn(db, checkIn('2026-02-02'));

    expect(await deleteCheckIn(db, '2026-02-02')).toBe(true);
    expect(await getCheckIn(db, '2026-02-02')).toBeNull();
    // Only the targeted day goes.
    expect(await getCheckIn(db, '2026-02-01')).not.toBeNull();
    expect(await countCheckInDays(db)).toBe(1);
  });

  it('reports false when there was nothing to delete', async () => {
    const db = await freshDb();
    expect(await deleteCheckIn(db, '2026-02-09')).toBe(false);
  });

  it('allows logging a deleted day afresh', async () => {
    const db = await freshDb();
    await saveCheckIn(db, checkIn('2026-02-01', { severity: 8 }));
    await deleteCheckIn(db, '2026-02-01');
    await saveCheckIn(db, checkIn('2026-02-01', { severity: 2 }));

    const stored = await getCheckIn(db, '2026-02-01');
    expect(stored?.severity).toBe(2);
    expect(await countCheckInDays(db)).toBe(1);
  });

  it('lists a date range in ascending order', async () => {
    const db = await freshDb();
    for (const date of ['2026-02-03', '2026-02-01', '2026-02-02']) {
      await saveCheckIn(db, checkIn(date));
    }
    const listed = await listCheckIns(db, '2026-02-01', '2026-02-02');
    expect(listed.map((c) => c.date)).toEqual(['2026-02-01', '2026-02-02']);
  });
});

describe('profile', () => {
  it('round-trips and stays a single row', async () => {
    const db = await freshDb();
    await saveProfile(db, profile);
    await saveProfile(db, { ...profile, cityLabel: 'Leeds' });
    expect(await getProfile(db)).toEqual({ ...profile, cityLabel: 'Leeds' });
    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM profile;');
    expect(count?.n).toBe(1);
  });

  it('returns null before onboarding', async () => {
    expect(await getProfile(await freshDb())).toBeNull();
  });
});

describe('the ML join', () => {
  it('merges checkin, environment and wearable onto one row per date', async () => {
    const db = await freshDb();
    await saveCheckIn(db, checkIn('2026-03-10', { severity: 6, stress: 7, sleepHours: 5 }));
    await upsertEnvironment(db, [
      {
        date: '2026-03-10',
        tempMeanC: 9.5,
        tempMinC: 4,
        tempMaxC: 12,
        humidityMeanPct: 71,
        dewPointC: 4.2,
        pressureHpa: 1011,
        uvIndexMax: 2.1,
        precipitationMm: 0.4,
        windSpeedMax: 18,
        pm25: 12.3,
        pm10: 20,
        ozone: 55,
        pollenTotal: 8,
        isForecast: false,
        fetchedAt: '2026-03-10T08:00:00Z',
      },
    ]);
    await upsertWearable(db, [
      {
        date: '2026-03-10',
        sleepHours: 6.8,
        sleepEfficiency: 0.9,
        restingHr: 58,
        steps: 8200,
        source: 'healthkit',
        fetchedAt: '2026-03-10T08:00:00Z',
      },
    ]);

    const rows = await loadFeatureInputRows(db, '2026-03-10', 5);
    const row = rows.find((r) => r.date === '2026-03-10');
    expect(row).toBeDefined();
    expect(row?.severity).toBe(6);
    expect(row?.pm2_5).toBe(12.3);
    expect(row?.sleep_hours).toBe(5);
    // The device value travels under its own key; HD-5 precedence is applied
    // later, in features.ts, so both remain visible here.
    expect(row?.sleep_hours_device).toBe(6.8);
  });

  it('survives two overlapping environment writes', async () => {
    // Regression: on a first launch there is no `fetched_at` to rate-limit
    // against, so two refreshes ran at once and the non-serialised
    // `withTransactionAsync` produced "cannot start a transaction within a
    // transaction", losing the whole batch.
    const db = await freshDb();
    const day = (date: string, temp: number) => ({
      date,
      tempMeanC: temp,
      tempMinC: null,
      tempMaxC: null,
      humidityMeanPct: null,
      dewPointC: null,
      pressureHpa: null,
      uvIndexMax: null,
      precipitationMm: null,
      windSpeedMax: null,
      pm25: null,
      pm10: null,
      ozone: null,
      pollenTotal: null,
      isForecast: false,
      fetchedAt: '2026-03-12T06:00:00Z',
    });

    await expect(
      Promise.all([
        upsertEnvironment(db, [day('2026-03-12', 5), day('2026-03-13', 6)]),
        upsertEnvironment(db, [day('2026-03-14', 7), day('2026-03-15', 8)]),
      ]),
    ).resolves.toBeDefined();

    const count = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM environment;',
    );
    expect(count?.n).toBe(4);
  });

  it('upserts environment rather than duplicating a date', async () => {
    const db = await freshDb();
    const day = {
      date: '2026-03-11',
      tempMeanC: 5,
      tempMinC: null,
      tempMaxC: null,
      humidityMeanPct: null,
      dewPointC: null,
      pressureHpa: null,
      uvIndexMax: null,
      precipitationMm: null,
      windSpeedMax: null,
      pm25: null,
      pm10: null,
      ozone: null,
      pollenTotal: null,
      isForecast: true,
      fetchedAt: '2026-03-11T06:00:00Z',
    };
    await upsertEnvironment(db, [day]);
    await upsertEnvironment(db, [{ ...day, tempMeanC: 11, isForecast: false }]);
    const rows = await db.getAllAsync<{ temp_mean_c: number; is_forecast: number }>(
      'SELECT temp_mean_c, is_forecast FROM environment WHERE date = ?;',
      '2026-03-11',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].temp_mean_c).toBe(11);
    expect(rows[0].is_forecast).toBe(0);
  });
});

describe('predictions', () => {
  it('appends a row with its top features serialised', async () => {
    const db = await freshDb();
    await insertPrediction(db, {
      computedAt: '2026-03-10T09:00:00Z',
      forDate: '2026-03-10',
      probability: 0.31,
      band: 'elevated',
      modelVersion: '1.0.0',
      topFeatures: [{ feature: 'stress_lag7', contribution: 0.4 }],
    });
    const row = await db.getFirstAsync<{ top_features: string }>(
      'SELECT top_features FROM prediction;',
    );
    expect(JSON.parse(row?.top_features ?? '[]')).toEqual([
      { feature: 'stress_lag7', contribution: 0.4 },
    ]);
  });
});

describe('CSV export (FR-6.3)', () => {
  it('emits a header even with nothing logged', async () => {
    const csv = await exportCsv(await freshDb());
    expect(csv.split('\n')[0]).toContain('date,severity');
  });

  it('quotes notes containing commas', async () => {
    const db = await freshDb();
    await saveCheckIn(db, checkIn('2026-04-01', { notes: 'elbows, knees' }));
    const csv = await exportCsv(db);
    expect(csv).toContain('"elbows, knees"');
  });
});

describe('delete all data (FR-7.2 / PRIV-4)', () => {
  it('clears every table and leaves a usable empty database', async () => {
    const db = await freshDb();
    await saveProfile(db, profile);
    await saveCheckIn(db, checkIn('2026-05-01'));
    await insertPrediction(db, {
      computedAt: '2026-05-01T09:00:00Z',
      forDate: '2026-05-01',
      probability: 0.2,
      band: 'low',
      modelVersion: '1.0.0',
      topFeatures: [],
    });

    await resetDatabase(db);

    expect(await getProfile(db)).toBeNull();
    expect(await countCheckInDays(db)).toBe(0);
    const predictions = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM prediction;',
    );
    expect(predictions?.n).toBe(0);

    // Still writable afterwards — the user lands back on onboarding, not a crash.
    await saveCheckIn(db, checkIn('2026-05-02'));
    expect(await countCheckInDays(db)).toBe(1);
  });
});
