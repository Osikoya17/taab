import { connectService } from './api/service';
import type { AppNotification, NotificationCategory, NotificationPreferences } from '@/types/models';

import { ServiceError } from './api/errors';
import { createId, read, write } from './mock/db';
import { requireSession } from './session';

/** Phones and tablets one account can receive push notifications on. */
const MAX_PUSH_DEVICES = 5;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  new_expense: true,
  payment_received: true,
  settlement: true,
  reminder: true,
  member_joined: true,
  recurring_expense: true,
  group_activity: false,
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, { title: string; detail: string }> = {
  new_expense: { title: 'Expenses', detail: 'When someone adds or changes a bill' },
  payment_received: { title: 'Payments received', detail: 'When someone says they’ve paid you, so you can confirm it' },
  settlement: { title: 'Payment confirmations', detail: 'When someone confirms your payment, or says it didn’t arrive' },
  reminder: { title: 'Reminders', detail: 'Friendly nudges about what you owe' },
  member_joined: { title: 'New members', detail: 'When someone joins one of your taabs' },
  recurring_expense: { title: 'Recurring expenses', detail: 'When a repeating bill is due' },
  group_activity: { title: 'Other group activity', detail: 'Edits, deletions and everything else' },
};

const TEST_TITLE = 'Test notification';

export const localNotificationsService = {
  async list(): Promise<AppNotification[]> {
    const me = requireSession();
    return read((db) => [...(db.notifications[me.userId] ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  async markAllRead(): Promise<void> {
    const me = requireSession();
    await write((db) => {
      for (const n of db.notifications[me.userId] ?? []) n.read = true;
    });
  },

  async getPreferences(): Promise<NotificationPreferences> {
    const me = requireSession();
    return read((db) => ({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...db.notificationPreferences[me.userId] }));
  },

  async updatePreferences(patch: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const me = requireSession();
    return write((db) => {
      const next = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...db.notificationPreferences[me.userId], ...patch };
      db.notificationPreferences[me.userId] = next;
      return next;
    });
  },

  /**
   * Sends yourself a test notification, so you can see whether this phone gets
   * pushes. Returns how many of your devices the server can reach.
   */
  async sendTest(): Promise<{ devices: number }> {
    const me = requireSession();
    return write((db) => {
      const now = new Date();
      const recent = (db.notifications[me.userId] ?? []).some((n) => n.title === TEST_TITLE && now.getTime() - Date.parse(n.createdAt) < 30_000);
      if (recent) throw new ServiceError('rate_limited');
      const id = createId('n');
      (db.notifications[me.userId] ??= []).push({ id, category: 'group_activity', title: TEST_TITLE, body: 'Notifications are working on this phone.', read: false, test: true, createdAt: now.toISOString() });
      const devices = db.pushTokens[me.userId]?.length ?? 0;
      if (devices) db.pushOutbox[id] = { userId: me.userId, notificationId: id, attempts: 0, nextAttemptAt: now.toISOString() };
      return { devices };
    });
  },

  /** The backend stores each device's Expo push token and filters sends by preferences. */
  async registerPushToken(token: string): Promise<void> {
    const me = requireSession();
    await write((db) => {
      // A shared device must stop receiving the previous account's notifications.
      for (const [userId, tokens] of Object.entries(db.pushTokens)) {
        if (userId === me.userId || !tokens.includes(token)) continue;
        const remaining = tokens.filter((t) => t !== token);
        if (remaining.length) db.pushTokens[userId] = remaining;
        else delete db.pushTokens[userId];
      }
      // Re-registering moves the device to the end; the oldest device drops off past the cap.
      const mine = (db.pushTokens[me.userId] ?? []).filter((t) => t !== token);
      db.pushTokens[me.userId] = [...mine, token].slice(-MAX_PUSH_DEVICES);
    });
  },
};

export const notificationsService = connectService('notifications', localNotificationsService);
