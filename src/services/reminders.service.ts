import { connectService } from './api/service';
import type { MinorUnits, Reminder } from '@/types/models';

import { ServiceError } from './api/errors';
import { createId, read, write } from './mock/db';
import { groupBalances, logActivity, memberName, requireGroup } from './mock/ledger';
import { requireSession } from './session';

/** One nudge per person per taab per day keeps reminders friendly, not spammy. */
export const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type ReminderStatus = {
  lastSentAt: string | null;
  nextAllowedAt: string | null;
  canSend: boolean;
  history: Reminder[];
};

export const localRemindersService = {
  async getStatus(groupId: string, toUserId: string): Promise<ReminderStatus> {
    const me = requireSession();
    return read((db) => {
      requireGroup(db, groupId, me.userId);
      const history = db.reminders
        .filter((r) => r.groupId === groupId && r.toUserId === toUserId && r.fromUserId === me.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const last = history[0]?.createdAt ?? null;
      const nextAllowed = last ? Date.parse(last) + REMINDER_COOLDOWN_MS : null;
      return {
        lastSentAt: last,
        nextAllowedAt: nextAllowed ? new Date(nextAllowed).toISOString() : null,
        canSend: !nextAllowed || nextAllowed <= Date.now(),
        history,
      };
    });
  },

  async sendReminder(input: { groupId: string; toUserId: string; message: string }): Promise<Reminder> {
    const me = requireSession();
    return write((db) => {
      const group = requireGroup(db, input.groupId, me.userId);
      if (input.toUserId === me.userId || !group.members.some((m) => m.userId === input.toUserId) || !input.message.trim() || input.message.length > 500) throw new ServiceError('validation');
      const last = db.reminders
        .filter((r) => r.groupId === input.groupId && r.toUserId === input.toUserId && r.fromUserId === me.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (last && Date.parse(last.createdAt) + REMINDER_COOLDOWN_MS > Date.now()) throw new ServiceError('rate_limited');

      const owed: MinorUnits = Math.max(0, -(groupBalances(db, group).get(input.toUserId) ?? 0));
      if (owed === 0) throw new ServiceError('validation', 'nothing_outstanding');

      const reminder: Reminder = {
        id: createId('r'),
        groupId: group.id,
        fromUserId: me.userId,
        toUserId: input.toUserId,
        amount: owed,
        currency: group.currency,
        message: input.message.trim(),
        createdAt: new Date().toISOString(),
      };
      db.reminders.push(reminder);
      logActivity(db, {
        type: 'reminder_sent',
        groupId: group.id,
        groupName: group.name,
        actorId: me.userId,
        actorName: memberName(group, me.userId),
        targetUserId: input.toUserId,
        targetName: memberName(group, input.toUserId),
        amount: owed,
        currency: group.currency,
      });
      // The backend delivers the push notification to the recipient here.
      return reminder;
    });
  },
};

export const remindersService = connectService('reminders', localRemindersService);
