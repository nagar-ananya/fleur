import type { SQLiteDatabase } from 'expo-sqlite';

import { DROP_ALL, MIGRATIONS, SCHEMA_VERSION } from './schema';

const VERSION_KEY = 'schema_version';

async function readVersion(db: SQLiteDatabase): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM meta WHERE key = ?;',
      VERSION_KEY,
    );
    return row ? Number(row.value) : 0;
  } catch {
    return 0;
  }
}

async function writeVersion(db: SQLiteDatabase, version: number): Promise<void> {
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
    VERSION_KEY,
    String(version),
  );
}

export async function runMigrations(db: SQLiteDatabase): Promise<number> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const current = await readVersion(db);
  if (current >= SCHEMA_VERSION) return current;

  for (let version = current; version < MIGRATIONS.length; version += 1) {
    for (const statement of MIGRATIONS[version]) {
      await db.execAsync(statement);
    }
  }
  await writeVersion(db, SCHEMA_VERSION);
  return SCHEMA_VERSION;
}

export async function resetDatabase(db: SQLiteDatabase): Promise<void> {
  for (const statement of DROP_ALL) {
    await db.execAsync(statement);
  }
  for (const migration of MIGRATIONS) {
    for (const statement of migration) {
      await db.execAsync(statement);
    }
  }
  await writeVersion(db, SCHEMA_VERSION);
}
