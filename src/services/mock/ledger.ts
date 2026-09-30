import { computeBalances, countsTowardBalance, type Balances } from '@/features/settlements/balances';
import type { ActivityEvent, Group, NotificationCategory } from '@/types/models';

import { ServiceError } from '../api/errors';
import { createId, type MockDatabase } from './db';

/** Server-side helpers shared by mock services. */

export function groupsForUser(db: MockDatabase, userId: string): Group[] {
  return db.groups.filter((g) => g.members.some((m) => m.userId === userId));
}

/** Everyone with an account who already shares a taab with this user. */
export function connectionsOf(db: MockDatabase, userId: string): Set<string> {
  const people = new Set<string>();
  for (const group of groupsForUser(db, userId)) {
    for (const member of group.members) if (member.status === 'active' && member.userId !== userId) people.add(member.userId);
  }
  return people;
}

export function requireGroup(db: MockDatabase, groupId: string, userId: string): Group {
  const group = db.groups.find((g) => g.id === groupId);
  if (!group) throw new ServiceError('not_found');
  if (!group.members.some((m) => m.userId === userId)) throw new ServiceError('forbidden');
  return group;
}

export function groupBalances(db: MockDatabase, group: Group): Balances {
  return computeBalances(
    group.members.map((m) => m.userId),
    db.expenses.filter((e) => e.groupId === group.id),
    db.settlements.filter((s) => s.groupId === group.id && countsTowardBalance(s)),
  );
}

export function memberName(group: Group, userId: string): string {
  return group.members.find((m) => m.userId === userId)?.name ?? 'Someone';
}

const CATEGORY_BY_TYPE: Partial<Record<ActivityEvent['type'], NotificationCategory>> = {
  expense_created: 'new_expense',
  // Changes to a bill matter as much as new ones, so they share its setting.
  expense_edited: 'new_expense',
  payment_recorded: 'payment_received',
  payment_confirmed: 'settlement',
  payment_declined: 'settlement',
  reminder_sent: 'reminder',
  member_joined: 'member_joined',
};

/**
 * Records an event and notifies the rest of the group, or only the target
 * when there is one. `notice` replaces the default notification wording.
 */
export function logActivity(
  db: MockDatabase,
  event: Omit<ActivityEvent, 'id' | 'createdAt'> & { createdAt?: string },
  notice?: { title: string; body: string },
) {
  const createdAt = event.createdAt ?? new Date().toISOString();
  db.activity.push({ id: createId('a'), ...event, createdAt });
  const category = CATEGORY_BY_TYPE[event.type] ?? 'group_activity';
  const titles: Record<NotificationCategory, string> = {
    new_expense: event.type === 'expense_edited' ? 'Expense changed' : 'New expense', payment_received: 'Payment recorded', reminder: 'A friendly reminder',
    member_joined: 'New member', group_activity: 'Group updated', settlement: 'Settlement', recurring_expense: 'Recurring expense',
  };
  const group = db.groups.find((g) => g.id === event.groupId);
  for (const member of group?.members ?? []) {
    if (member.userId === event.actorId || member.status !== 'active') continue;
    if (event.targetUserId && member.userId !== event.targetUserId) continue;
    notifyUser(db, member.userId, category, {
      title: notice?.title ?? titles[category],
      body: notice?.body ?? `${event.actorName} · ${event.title ?? event.groupName}`,
      groupId: event.groupId, expenseId: event.expenseId,
    }, createdAt);
  }
}

/** Adds an in-app notification (and a push, if they have a device) unless the person turned that category off. */
export function notifyUser(
  db: MockDatabase,
  userId: string,
  category: NotificationCategory,
  notice: { title: string; body: string; groupId?: string; expenseId?: string },
  createdAt = new Date().toISOString(),
) {
  if (!(db.notificationPreferences[userId]?.[category] ?? category !== 'group_activity')) return;
  const notificationId = createId('n');
  (db.notifications[userId] ??= []).push({ id: notificationId, category, ...notice, read: false, createdAt });
  if (db.pushTokens[userId]?.length) db.pushOutbox[notificationId] = { userId, notificationId, attempts: 0, nextAttemptAt: createdAt };
}

/** Keeps edit history pointing at the right person when an id is replaced (joining, deleting an account). */
export function replaceUserInChanges(event: ActivityEvent, fromId: string, toId: string) {
  for (const change of event.changes ?? []) {
    if (change.field !== 'paidBy' && change.field !== 'split') continue;
    for (const person of [...change.from, ...change.to]) if (person.userId === fromId) person.userId = toId;
  }
}

export function touchGroup(group: Group, at = new Date().toISOString()) {
  group.updatedAt = at;
}
