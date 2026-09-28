import { hasPlusAccess } from '@/features/billing/access';
import { computeBalances, type Balances } from '@/features/settlements/balances';
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
    db.settlements.filter((s) => s.groupId === group.id),
  );
}

export function memberName(group: Group, userId: string): string {
  return group.members.find((m) => m.userId === userId)?.name ?? 'Someone';
}

export function userHasPlus(db: MockDatabase, userId: string): boolean {
  const subscription = db.subscriptions[userId];
  return subscription ? hasPlusAccess(subscription) : false;
}

export function logActivity(db: MockDatabase, event: Omit<ActivityEvent, 'id' | 'createdAt'> & { createdAt?: string }) {
  const createdAt = event.createdAt ?? new Date().toISOString();
  db.activity.push({ id: createId('a'), ...event, createdAt });
  const category: NotificationCategory = event.type === 'expense_created' ? 'new_expense'
    : event.type === 'payment_recorded' ? 'payment_received'
      : event.type === 'reminder_sent' ? 'reminder'
        : event.type === 'member_joined' ? 'member_joined' : 'group_activity';
  const titles: Record<NotificationCategory, string> = {
    new_expense: 'New expense', payment_received: 'Payment recorded', reminder: 'A friendly reminder',
    member_joined: 'New member', group_activity: 'Group updated', settlement: 'Settlement', recurring_expense: 'Recurring expense',
  };
  const group = db.groups.find((g) => g.id === event.groupId);
  for (const member of group?.members ?? []) {
    if (member.userId === event.actorId || member.status !== 'active') continue;
    if (event.targetUserId && member.userId !== event.targetUserId) continue;
    if (!(db.notificationPreferences[member.userId]?.[category] ?? category !== 'group_activity')) continue;
    const notificationId = createId('n');
    (db.notifications[member.userId] ??= []).push({
      id: notificationId, category, title: titles[category],
      body: `${event.actorName} · ${event.title ?? event.groupName}`,
      groupId: event.groupId, expenseId: event.expenseId, read: false, createdAt,
    });
    if (db.pushTokens[member.userId]?.length) db.pushOutbox[notificationId] = { userId: member.userId, notificationId, attempts: 0, nextAttemptAt: createdAt };
  }
}

export function touchGroup(group: Group, at = new Date().toISOString()) {
  group.updatedAt = at;
}
