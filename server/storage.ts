import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

import { configureDatabase } from '../src/services/mock/db';

/** Single-process SQLite store. Each domain mutation commits a complete ledger atomically. */
export function openDatabase(filename: string) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  configureDatabase({
    simulateLatency: false, allowDemoData: false, generateId: (prefix) => `${prefix}_${randomUUID()}`,
    storage: {
      async getItem(key) {
        const row = database.prepare('SELECT value FROM state WHERE key = ?').get(key);
        return typeof row?.value === 'string' ? row.value : null;
      },
      async setItem(key, value) {
        database.prepare('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
      },
      async removeItem(key) { database.prepare('DELETE FROM state WHERE key = ?').run(key); },
    },
  });
  return database;
}

export type ReceiptStore = {
  /** Stores a validated `data:` URI and returns its id. */
  put(dataUri: string): string;
  get(id: string): string | null;
  /** Deletes receipts no expense points to any more, once they are older than `graceMs`. */
  prune(referencedIds: Set<string>, graceMs: number): number;
};

/**
 * Receipt photos live in their own table so the ledger stays small: every
 * ledger write re-serialises the whole state, and photos would dominate it.
 */
export function createReceiptStore(database: DatabaseSync): ReceiptStore {
  database.exec('CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER NOT NULL)');
  return {
    put(dataUri) {
      const id = randomUUID();
      database.prepare('INSERT INTO receipts (id, data, created_at) VALUES (?, ?, ?)').run(id, dataUri, Date.now());
      return id;
    },
    get(id) {
      const row = database.prepare('SELECT data FROM receipts WHERE id = ?').get(id);
      return typeof row?.data === 'string' ? row.data : null;
    },
    prune(referencedIds, graceMs) {
      const rows = database.prepare('SELECT id FROM receipts WHERE created_at < ?').all(Date.now() - graceMs);
      const remove = database.prepare('DELETE FROM receipts WHERE id = ?');
      let removed = 0;
      for (const row of rows) {
        if (typeof row.id === 'string' && !referencedIds.has(row.id)) {
          remove.run(row.id);
          removed++;
        }
      }
      return removed;
    },
  };
}
