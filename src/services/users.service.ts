import { connectService } from './api/service';
import { DEFAULT_CURRENCY } from '@/constants/currencies';
import type { CurrencyCode, UseCase, UserProfile } from '@/types/models';

import { allowDemoData, createId, read, write } from './mock/db';
import { seedDemoData } from './mock/seed';
import { requireSession, type SessionIdentity } from './session';
import { ServiceError } from './api/errors';
import { profilePatchSchema, setupSchema } from './validation';

export type ProfilePatch = Partial<Pick<UserProfile, 'name' | 'avatarUrl' | 'defaultCurrency' | 'useCase'>>;

export type SetupInput = {
  name: string;
  useCase: UseCase;
  currency: CurrencyCode;
  /** Seeds Flat 12, Detty December and Weekend Trip so the app can be explored. */
  includeSampleTaabs: boolean;
};

function defaultProfile(identity: SessionIdentity): UserProfile {
  return {
    id: identity.userId,
    name: identity.name,
    email: identity.email,
    avatarUrl: identity.avatarUrl,
    defaultCurrency: DEFAULT_CURRENCY,
    createdAt: identity.createdAt,
    setupComplete: false,
  };
}

export const localUsersService = {
  async getProfile(): Promise<UserProfile> {
    const me = requireSession();
    return read((db) => db.profiles[me.userId] ?? defaultProfile(me));
  },

  async updateProfile(patch: ProfilePatch): Promise<UserProfile> {
    const parsed = profilePatchSchema.safeParse(patch);
    if (!parsed.success) throw new ServiceError('validation');
    patch = parsed.data;
    const me = requireSession();
    return write((db) => {
      const profile = { ...(db.profiles[me.userId] ?? defaultProfile(me)), ...patch };
      db.profiles[me.userId] = profile;
      if (patch.name || patch.avatarUrl !== undefined) {
        // Member names are denormalised onto groups; keep them in sync.
        for (const group of db.groups) {
          for (const m of group.members) {
            if (m.userId !== me.userId) continue;
            if (patch.name) m.name = patch.name;
            if (patch.avatarUrl !== undefined) m.avatarUrl = patch.avatarUrl;
          }
        }
      }
      return profile;
    });
  },

  async completeSetup(input: SetupInput): Promise<UserProfile> {
    const parsed = setupSchema.safeParse(input);
    if (!parsed.success) throw new ServiceError('validation');
    input = parsed.data;
    const me = requireSession();
    return write((db) => {
      const profile: UserProfile = {
        ...(db.profiles[me.userId] ?? defaultProfile(me)),
        name: input.name,
        useCase: input.useCase,
        defaultCurrency: input.currency,
        setupComplete: true,
      };
      db.profiles[me.userId] = profile;
      const alreadySeeded = db.groups.some((g) => g.members.some((m) => m.userId === me.userId));
      if (allowDemoData && input.includeSampleTaabs && !alreadySeeded) {
        seedDemoData(db, { userId: me.userId, name: input.name, email: me.email });
      }
      return profile;
    });
  },

  /**
   * Removes the user's taab data. The Clerk user itself is deleted through
   * Clerk; a real backend also handles this from Clerk's `user.deleted` webhook.
   */
  async deleteAccountData(): Promise<void> {
    const me = requireSession();
    await write((db) => {
      delete db.profiles[me.userId];
      delete db.notifications[me.userId];
      delete db.subscriptions[me.userId];
      delete db.pushTokens[me.userId];
      delete db.notificationPreferences[me.userId];
      delete db.pendingDeletions[me.userId];
      for (const [id, job] of Object.entries(db.pushOutbox)) if (job.userId === me.userId) delete db.pushOutbox[id];
      const ownGroups = new Set(db.groups.filter((g) => g.members.every((m) => m.userId === me.userId)).map((g) => g.id));
      const anonymousId = createId('deleted');
      for (const group of db.groups) {
        const member = group.members.find((m) => m.userId === me.userId);
        if (member) {
          member.userId = anonymousId;
          member.name = 'Deleted member';
          delete member.email;
          delete member.phone;
          delete member.avatarUrl;
          member.status = 'invited';
        }
        if (group.createdBy === me.userId) group.createdBy = group.members.find((m) => m.status === 'active')?.userId ?? anonymousId;
      }
      for (const expense of db.expenses) {
        for (const p of [...expense.paidBy, ...expense.splitBetween]) if (p.userId === me.userId) p.userId = anonymousId;
        if (expense.createdBy === me.userId) expense.createdBy = anonymousId;
      }
      for (const payment of db.settlements) {
        if (payment.fromUserId === me.userId) payment.fromUserId = anonymousId;
        if (payment.toUserId === me.userId) payment.toUserId = anonymousId;
        if (payment.createdBy === me.userId) payment.createdBy = anonymousId;
      }
      for (const event of db.activity) {
        if (event.actorId === me.userId) { event.actorId = anonymousId; event.actorName = 'Deleted member'; }
        if (event.targetUserId === me.userId) { event.targetUserId = anonymousId; event.targetName = 'Deleted member'; }
      }
      // Notification text can contain the former display name; activity remains available.
      for (const group of db.groups.filter((g) => g.members.some((m) => m.userId === anonymousId))) {
        for (const id of Object.keys(db.notifications)) db.notifications[id] = db.notifications[id].filter((n) => n.groupId !== group.id);
      }
      db.groups = db.groups.filter((g) => !ownGroups.has(g.id));
      db.expenses = db.expenses.filter((e) => !ownGroups.has(e.groupId));
      db.settlements = db.settlements.filter((s) => !ownGroups.has(s.groupId));
      db.activity = db.activity.filter((a) => !ownGroups.has(a.groupId));
      db.reminders = db.reminders.filter((r) => !ownGroups.has(r.groupId) && r.fromUserId !== me.userId && r.toUserId !== me.userId);
      db.recurring = db.recurring.filter((r) => !ownGroups.has(r.groupId) && r.createdBy !== me.userId && ![...r.paidBy, ...r.splitBetween].some((p) => p.userId === me.userId));
      for (const [token, invite] of Object.entries(db.inviteLinks)) if (ownGroups.has(invite.groupId)) delete db.inviteLinks[token];
    });
  },
};

export const usersService = connectService('users', localUsersService);
