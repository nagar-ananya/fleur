/**
 * Test double for `expo-sqlite`, backed by Node's built-in SQLite.
 *
 * Using a real SQL engine rather than a hand-written stub means the database
 * tests actually exercise the schema: CHECK constraints, ON CONFLICT upserts
 * and PRIMARY KEY uniqueness all behave as they will on device. A stub would
 * happily accept `severity = 47`.
 *
 * Requires `--experimental-sqlite` on Node 22 (set in the `test` script).
 */

import { DatabaseSync } from 'node:sqlite';

type Param = string | number | null;

class MockDatabase {
  private readonly db: DatabaseSync;
  private exclusiveQueue: Promise<void> = Promise.resolve();

  constructor(location: string) {
    this.db = new DatabaseSync(location);
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...params: Param[]): Promise<{ changes: number }> {
    const result = this.db.prepare(sql).run(...(params as never[]));
    return { changes: Number(result.changes) };
  }

  async getFirstAsync<T>(sql: string, ...params: Param[]): Promise<T | null> {
    const row = this.db.prepare(sql).get(...(params as never[]));
    return (row as T) ?? null;
  }

  async getAllAsync<T>(sql: string, ...params: Param[]): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as never[])) as T[];
  }

  /**
   * expo-sqlite rolls back if the callback throws; mirror that.
   *
   * Also mirrors the failure mode that bit us on device: this variant does NOT
   * serialise, so overlapping callers hit a nested BEGIN and SQLite rejects it.
   * Reproducing that here is the point — a forgiving stub would have let the
   * bug ship.
   */
  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      await fn();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Serialised transaction: concurrent callers queue instead of colliding. */
  async withExclusiveTransactionAsync(
    fn: (txn: MockDatabase) => Promise<void>,
  ): Promise<void> {
    const run = this.exclusiveQueue.then(async () => {
      this.db.exec('BEGIN');
      try {
        await fn(this);
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    });
    // Keep the chain alive even if this link rejects, so one failure does not
    // wedge every later transaction.
    this.exclusiveQueue = run.catch(() => undefined);
    return run;
  }

  closeSync(): void {
    this.db.close();
  }
}

/** Each open gets a fresh in-memory database so tests cannot leak into each other. */
export async function openDatabaseAsync(_name: string): Promise<MockDatabase> {
  return new MockDatabase(':memory:');
}

export function openDatabaseSync(_name: string): MockDatabase {
  return new MockDatabase(':memory:');
}

export type SQLiteDatabase = MockDatabase;
