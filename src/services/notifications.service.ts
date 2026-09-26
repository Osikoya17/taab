import { connectService } from './api/service';
import type { AppNotification, NotificationCategory, NotificationPreferences } from '@/types/models';

import { read, write } from './mock/db';
import { requireSession } from './session';

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
  new_expense: { title: 'New expenses', detail: 'When someone adds a bill you’re part of' },
  payment_received: { title: 'Payments received', detail: 'When someone pays you back' },
  settlement: { title: 'Settlements', detail: 'When you’re settled up with someone' },
  reminder: { title: 'Reminders', detail: 'Friendly nudges about what you owe' },
  member_joined: { title: 'New members', detail: 'When someone joins one of your taabs' },
  recurring_expense: { title: 'Recurring expenses', detail: 'When a repeating bill is due' },
  group_activity: { title: 'Other group activity', detail: 'Edits, deletions and everything else' },
};

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

  /** The backend stores the Expo push token and filters sends by preferences. */
  async registerPushToken(token: string): Promise<void> {
    const me = requireSession();
    await write((db) => {
      db.pushTokens[me.userId] = token;
    });
  },
};

export const notificationsService = connectService('notifications', localNotificationsService);
