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
