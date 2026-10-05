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
    this.exclusiveQueue = run.catch(() => undefined);
    return run;
  }

  closeSync(): void {
    this.db.close();
  }
}

export async function openDatabaseAsync(_name: string): Promise<MockDatabase> {
  return new MockDatabase(':memory:');
}

export function openDatabaseSync(_name: string): MockDatabase {
  return new MockDatabase(':memory:');
}

export type SQLiteDatabase = MockDatabase;
