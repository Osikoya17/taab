import type { SubscriptionState } from '@/features/billing/types';
import type {
  ActivityEvent,
  AppNotification,
  Expense,
  Group,
  NotificationPreferences,
  RecurringExpense,
  Reminder,
  Settlement,
  UserProfile,
} from '@/types/models';

/**
 * Shared ledger repository. The device demo uses AsyncStorage; the server uses
 * SQLite. Writes are serialized and only become visible after durable commit.
 */
export type MockDatabase = {
  version: 1;
  profiles: Record<string, UserProfile>;
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  activity: ActivityEvent[];
  reminders: Reminder[];
  recurring: RecurringExpense[];
  notifications: Record<string, AppNotification[]>;
  notificationPreferences: Record<string, NotificationPreferences>;
  subscriptions: Record<string, SubscriptionState>;
  pushTokens: Record<string, string>;
  inviteLinks: Record<string, { groupId: string; expiresAt: string }>;
  pendingDeletions: Record<string, { userId: string; email: string; name: string; createdAt: string }>;
  pushOutbox: Record<string, { userId: string; notificationId: string; attempts: number; nextAttemptAt: string; ticketId?: string }>;
};

const STORAGE_KEY = 'taab.mock-db.v1';

function emptyDatabase(): MockDatabase {
  return {
    version: 1,
    profiles: {},
    groups: [],
    expenses: [],
    settlements: [],
    activity: [],
    reminders: [],
    recurring: [],
    notifications: {},
    notificationPreferences: {},
    subscriptions: {},
    pushTokens: {},
    inviteLinks: {},
    pendingDeletions: {},
    pushOutbox: {},
  };
}

let db: MockDatabase | null = null;
let loading: Promise<MockDatabase> | null = null;
let mutations: Promise<unknown> = Promise.resolve();
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
let storage: Storage;
let simulateLatency = true;
let generateId: ((prefix: string) => string) | undefined;
export let allowDemoData = true;

/** Configure once at startup: device storage for demo, SQLite for the server. */
export function configureDatabase(options: { storage: Storage; simulateLatency?: boolean; generateId?: (prefix: string) => string; allowDemoData?: boolean }) {
  storage = options.storage;
  simulateLatency = options.simulateLatency ?? true;
  generateId = options.generateId;
  allowDemoData = options.allowDemoData ?? true;
  db = null;
  loading = null;
}

async function load(): Promise<MockDatabase> {
  if (db) return db;
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as MockDatabase) : null;
        if (parsed && parsed.version !== 1) throw new Error('Unsupported database version');
        db = parsed ? { ...emptyDatabase(), ...parsed } : emptyDatabase();
      } catch (error) {
        loading = null;
        throw error;
      }
      return db;
    })();
  }
  return loading;
}

/** Simulated network latency so loading states are exercised. */
function latency(min = 180, max = 420) {
  if (!simulateLatency) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
}

/** Deep copy so callers can never mutate the "server" state by accident. */
function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export async function read<T>(fn: (db: MockDatabase) => T): Promise<T> {
  const database = await load();
  await latency();
  return clone(fn(database));
}

export async function write<T>(fn: (db: MockDatabase) => T): Promise<T> {
  await latency(260, 560);
  const operation = mutations.then(async () => {
    const draft = clone(await load());
    const result = fn(draft);
    await storage.setItem(STORAGE_KEY, JSON.stringify(draft));
    db = draft;
    return clone(result);
  });
  mutations = operation.catch(() => undefined);
  return operation;
}

export function createId(prefix: string) {
  if (generateId) return generateId(prefix);
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function resetDatabase() {
  const operation = mutations.then(async () => {
    await load();
    await storage.removeItem(STORAGE_KEY);
    db = emptyDatabase();
    loading = null;
  });
  mutations = operation.catch(() => undefined);
  await operation;
}
