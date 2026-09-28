import { configureDatabase, read, resetDatabase, write } from './db';

describe('database commits', () => {
  let persisted: string | null;
  let failSave: boolean;
  beforeEach(() => {
    persisted = null;
    failSave = false;
    configureDatabase({ simulateLatency: false, storage: {
      getItem: async () => persisted,
      setItem: async (_key, value) => { if (failSave) throw new Error('Disk full'); persisted = value; },
      removeItem: async () => { persisted = null; },
    } });
  });
  it('rolls back partial mutations if validation throws', async () => {
    await expect(write((db) => { db.pushTokens.a = ['token']; throw new Error('invalid'); })).rejects.toThrow();
    expect(await read((db) => db.pushTokens.a)).toBeUndefined();
    expect(persisted).toBeNull();
  });
  it('reports storage errors and retains the last committed state', async () => {
    await write((db) => { db.pushTokens.a = ['old']; });
    failSave = true;
    await expect(write((db) => { db.pushTokens.a = ['new']; })).rejects.toThrow('Disk full');
    expect(await read((db) => db.pushTokens.a)).toEqual(['old']);
  });
  it('serializes concurrent writes and clears durable state on reset', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => write((db) => { db.pushTokens[String(i)] = ['token']; })));
    expect(Object.keys(await read((db) => db.pushTokens))).toHaveLength(20);
    await resetDatabase();
    expect(persisted).toBeNull();
    expect(await read((db) => db.pushTokens)).toEqual({});
  });
  it('upgrades single push tokens saved by older versions', async () => {
    persisted = JSON.stringify({ version: 1, pushTokens: { a: 'ExpoPushToken[old]' } });
    expect(await read((db) => db.pushTokens.a)).toEqual(['ExpoPushToken[old]']);
  });
});
