import { connectService } from './api/service';
import { OPERATIONAL_LIMITS } from '@/features/billing/products';
import { simplifyDebts, totalOutstanding, type Transfer } from '@/features/settlements/balances';
import { env } from '@/lib/env';
import type { CurrencyCode, Group, GroupMember, GroupType, MinorUnits } from '@/types/models';

import { ServiceError } from './api/errors';
import { allowDemoData, createId, read, write, type MockDatabase } from './mock/db';
import { connectionsOf, groupBalances, groupsForUser, logActivity, replaceUserInChanges, requireGroup, touchGroup } from './mock/ledger';
import { DIRECTORY_USERS } from './mock/seed';
import { requireSession } from './session';
import { groupInputSchema, inviteSchema } from './validation';

export type GroupSummary = {
  group: Group;
  /** Positive: the group owes you. Negative: you owe the group. */
  myBalance: MinorUnits;
  outstanding: MinorUnits;
  isSettled: boolean;
  expenseCount: number;
  lastActivityAt: string;
  /** Payments you recorded that the receiver hasn't confirmed; not yet in `myBalance`. */
  myPendingPaid: MinorUnits;
  /** Payments to you waiting for your answer; not yet in `myBalance`. */
  myPendingReceived: MinorUnits;
};

export type MemberBalance = {
  userId: string;
  name: string;
  avatarUrl?: string;
  amount: MinorUnits;
  /** Recorded by this member as paid, still waiting for the receiver. */
  pendingPaid: MinorUnits;
};

function pendingTotals(db: MockDatabase, groupId: string) {
  const paid = new Map<string, MinorUnits>();
  const received = new Map<string, MinorUnits>();
  for (const s of db.settlements) {
    if (s.groupId !== groupId || s.status !== 'pending') continue;
    paid.set(s.fromUserId, (paid.get(s.fromUserId) ?? 0) + s.amount);
    received.set(s.toUserId, (received.get(s.toUserId) ?? 0) + s.amount);
  }
  return { paid, received };
}

export type GroupDetail = GroupSummary & {
  balances: MemberBalance[];
  /** Simplified transfers that would settle the whole group. */
  transfers: Transfer[];
};

export type Invite =
  | { kind: 'user'; userId: string }
  | { kind: 'email'; email: string; name?: string }
  | { kind: 'phone'; phone: string; name: string };

export type CreateGroupInput = {
  name: string;
  description?: string;
  type: GroupType;
  currency: CurrencyCode;
  invites: Invite[];
};

export type PersonResult = { userId: string; name: string; email: string };

function summarize(db: MockDatabase, group: Group, userId: string): GroupSummary {
  const balances = groupBalances(db, group);
  const outstanding = totalOutstanding(balances);
  const pending = pendingTotals(db, group.id);
  return {
    group,
    myBalance: balances.get(userId) ?? 0,
    outstanding,
    isSettled: outstanding === 0,
    expenseCount: db.expenses.filter((e) => e.groupId === group.id).length,
    lastActivityAt: group.updatedAt,
    myPendingPaid: pending.paid.get(userId) ?? 0,
    myPendingReceived: pending.received.get(userId) ?? 0,
  };
}

function detail(db: MockDatabase, group: Group, userId: string): GroupDetail {
  const balances = groupBalances(db, group);
  const pending = pendingTotals(db, group.id);
  return {
    ...summarize(db, group, userId),
    balances: group.members.map((m) => ({
      userId: m.userId,
      name: m.name,
      avatarUrl: m.avatarUrl,
      amount: balances.get(m.userId) ?? 0,
      pendingPaid: pending.paid.get(m.userId) ?? 0,
    })),
    transfers: simplifyDebts(balances),
  };
}

/**
 * People you already share a taab with can be added straight away. Anyone
 * else becomes a pending invite they accept from the invite link, so nobody
 * is put into a stranger's group without agreeing. The demo directory is
 * fictional, so the demo adds its people directly.
 */
function inviteToMember(db: MockDatabase, invite: Invite, now: string, inviterId: string): GroupMember {
  const parsed = inviteSchema.safeParse(invite);
  if (!parsed.success) throw new ServiceError('validation');
  invite = parsed.data;
  const directory = [...(allowDemoData ? DIRECTORY_USERS : []), ...Object.values(db.profiles).map((p) => ({ userId: p.id, name: p.name, email: p.email }))];
  const connections = allowDemoData ? null : connectionsOf(db, inviterId);
  const canAddDirectly = (userId: string) => !connections || connections.has(userId);
  switch (invite.kind) {
    case 'user': {
      const person = directory.find((p) => p.userId === invite.userId);
      if (!person || !canAddDirectly(person.userId)) throw new ServiceError('not_found');
      return { userId: person.userId, name: person.name, email: person.email, status: 'active', joinedAt: now };
    }
    case 'email': {
      const known = directory.find((p) => p.email.toLowerCase() === invite.email.toLowerCase());
      if (known && canAddDirectly(known.userId)) return { userId: known.userId, name: known.name, email: known.email, status: 'active', joinedAt: now };
      return {
        userId: createId('inv'),
        name: invite.name?.trim() || invite.email.split('@')[0],
        email: invite.email,
        status: 'invited',
        joinedAt: now,
      };
    }
    case 'phone':
      return { userId: createId('inv'), name: invite.name, phone: invite.phone.replace(/[ ()-]/g, ''), status: 'invited', joinedAt: now };
  }
}

export const localGroupsService = {
  async listGroups(): Promise<GroupSummary[]> {
    const me = requireSession();
    return read((db) =>
      groupsForUser(db, me.userId)
        .map((g) => summarize(db, g, me.userId))
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt)),
    );
  },

  async getGroup(groupId: string): Promise<GroupDetail> {
    const me = requireSession();
    return read((db) => detail(db, requireGroup(db, groupId, me.userId), me.userId));
  },

  async createGroup(input: CreateGroupInput): Promise<Group> {
    const parsed = groupInputSchema.safeParse(input);
    if (!parsed.success) throw new ServiceError('validation');
    input = parsed.data;
    const me = requireSession();
    return write((db) => {
      // An abuse-prevention cap, not a paywall: far above what a person uses.
      if (groupsForUser(db, me.userId).length >= OPERATIONAL_LIMITS.activeGroups) throw new ServiceError('limit_reached');
      const now = new Date().toISOString();
      const profileName = db.profiles[me.userId]?.name ?? me.name;
      const members: GroupMember[] = [
        { userId: me.userId, name: profileName, email: me.email, avatarUrl: db.profiles[me.userId]?.avatarUrl, status: 'active', joinedAt: now },
      ];
      for (const invite of input.invites) {
        const m = inviteToMember(db, invite, now, me.userId);
        if (!members.some((x) => sameMember(x, m))) members.push(m);
      }
      const group: Group = {
        id: createId('g'),
        name: input.name.trim(),
        description: input.description?.trim() || undefined,
        type: input.type,
        currency: input.currency,
        members,
        createdBy: me.userId,
        createdAt: now,
        updatedAt: now,
      };
      db.groups.push(group);
      logActivity(db, { type: 'group_created', groupId: group.id, groupName: group.name, actorId: me.userId, actorName: profileName });
      return group;
    });
  },

  async inviteMembers(groupId: string, invites: Invite[]): Promise<Group> {
    if (invites.length > 99) throw new ServiceError('validation');
    const me = requireSession();
    return write((db) => {
      const group = requireGroup(db, groupId, me.userId);
      const now = new Date().toISOString();
      for (const invite of invites) {
        const m = inviteToMember(db, invite, now, me.userId);
        if (group.members.some((x) => sameMember(x, m))) continue;
        if (group.members.length >= 100) throw new ServiceError('limit_reached');
        group.members.push(m);
        if (m.status === 'active') {
          logActivity(db, { type: 'member_joined', groupId, groupName: group.name, actorId: m.userId, actorName: m.name });
        }
      }
      touchGroup(group, now);
      return group;
    });
  },

  /** Opaque invite tokens expire after seven days; the server uses random UUIDs. */
  async getInviteLink(groupId: string): Promise<string> {
    const me = requireSession();
    return write((db) => {
      requireGroup(db, groupId, me.userId);
      const token = createId('join');
      db.inviteLinks[token] = { groupId, expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString() };
      return `${env.inviteBaseUrl.replace(/\/$/, '')}/${token}`;
    });
  },

  async joinGroup(token: string): Promise<Group> {
    const me = requireSession();
    return write((db) => {
      const link = db.inviteLinks[token];
      if (!link || Date.parse(link.expiresAt) <= Date.now()) throw new ServiceError('not_found');
      const group = db.groups.find((g) => g.id === link.groupId);
      if (!group) throw new ServiceError('not_found');
      if (group.members.some((m) => m.userId === me.userId)) return group;
      if (groupsForUser(db, me.userId).length >= OPERATIONAL_LIMITS.activeGroups) throw new ServiceError('limit_reached');
      const pending = group.members.find((m) => m.status === 'invited' && m.email?.toLowerCase() === me.email.toLowerCase());
      if (pending) {
        const previousId = pending.userId;
        pending.userId = me.userId;
        pending.name = me.name;
        pending.status = 'active';
        for (const entry of [...db.expenses, ...db.recurring].filter((e) => e.groupId === group.id)) {
          for (const person of [...entry.paidBy, ...entry.splitBetween]) if (person.userId === previousId) person.userId = me.userId;
        }
        for (const entry of [...db.settlements, ...db.reminders].filter((e) => e.groupId === group.id)) {
          if (entry.fromUserId === previousId) entry.fromUserId = me.userId;
          if (entry.toUserId === previousId) entry.toUserId = me.userId;
        }
        // Past activity about the invite now reads as "You" for the person who joined.
        for (const event of db.activity.filter((e) => e.groupId === group.id)) {
          if (event.actorId === previousId) { event.actorId = me.userId; event.actorName = me.name; }
          if (event.targetUserId === previousId) { event.targetUserId = me.userId; event.targetName = me.name; }
          replaceUserInChanges(event, previousId, me.userId);
        }
      } else {
        if (group.members.length >= 100) throw new ServiceError('limit_reached');
        group.members.push({ userId: me.userId, name: me.name, email: me.email, status: 'active', joinedAt: new Date().toISOString() });
      }
      touchGroup(group);
      logActivity(db, { type: 'member_joined', groupId: group.id, groupName: group.name, actorId: me.userId, actorName: me.name });
      return group;
    });
  },

  /**
   * Finds people to add. With real accounts, only people you already share a
   * taab with are searchable, so the directory can't be used to look up
   * strangers' emails. Invite anyone else by email or with the invite link.
   */
  async searchPeople(query: string): Promise<PersonResult[]> {
    const me = requireSession();
    const q = query.trim().toLowerCase();
    if (!allowDemoData && q.length < 2) return [];
    return read((db) => {
      const connections = allowDemoData ? null : connectionsOf(db, me.userId);
      return [...(allowDemoData ? DIRECTORY_USERS : []), ...Object.values(db.profiles).map((p) => ({ userId: p.id, name: p.name, email: p.email }))]
        .filter((p) => p.userId !== me.userId && (!connections || connections.has(p.userId)))
        .filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
        .slice(0, 20).map((p) => ({ userId: p.userId, name: p.name, email: p.email }));
    });
  },

  async leaveGroup(groupId: string): Promise<void> {
    const me = requireSession();
    await write((db) => {
      const group = requireGroup(db, groupId, me.userId);
      const balance = groupBalances(db, group).get(me.userId) ?? 0;
      // You can only leave once you're square, so nobody is left out of pocket.
      if (balance !== 0) throw new ServiceError('validation', 'unsettled_balance');
      // A payment still waiting for confirmation would move a former member's balance.
      if (db.settlements.some((s) => s.groupId === groupId && s.status === 'pending' && (s.fromUserId === me.userId || s.toUserId === me.userId))) {
        throw new ServiceError('validation', 'pending_payment');
      }
      group.members = group.members.filter((m) => m.userId !== me.userId);
      // Your account for this taab stops being shown once you leave.
      delete db.payoutAccounts[me.userId]?.groups[groupId];
      // A repeating bill cannot keep charging someone who has left the group.
      db.recurring = db.recurring.filter((r) => r.groupId !== groupId ||
        (r.createdBy !== me.userId && ![...r.paidBy, ...r.splitBetween].some((p) => p.userId === me.userId)));
      touchGroup(group);
      if (group.createdBy === me.userId && group.members.length) group.createdBy = group.members[0].userId;
    });
  },
};

function sameMember(a: GroupMember, b: GroupMember) {
  return a.userId === b.userId || (!!a.email && a.email.toLowerCase() === b.email?.toLowerCase()) || (!!a.phone && a.phone === b.phone);
}

export const groupsService = connectService('groups', localGroupsService);
