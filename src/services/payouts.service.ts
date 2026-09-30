import { connectService } from './api/service';
import type { PayoutAccount } from '@/types/models';

import { ServiceError } from './api/errors';
import { read, write, type MockDatabase } from './mock/db';
import { groupsForUser, requireGroup } from './mock/ledger';
import { requireSession } from './session';
import { payoutAccountSchema } from './validation';

export type MyPayoutAccounts = {
  default?: PayoutAccount;
  /** Every taab you're in, with the account used there if it isn't your default. */
  groups: { groupId: string; groupName: string; account?: PayoutAccount }[];
};

/** A member's account as others in the taab see it, and whether it's their default. */
export type MemberPayout = PayoutAccount & { source: 'taab' | 'default' };

function clean(input: PayoutAccount): PayoutAccount {
  const parsed = payoutAccountSchema.safeParse({ ...input, accountNumber: String(input.accountNumber ?? '').replace(/[\s-]/g, '') });
  if (!parsed.success) throw new ServiceError('validation');
  return parsed.data;
}

/** The account a member wants to be paid into for this taab, if they've added one. */
export function payoutFor(db: MockDatabase, userId: string, groupId: string): MemberPayout | undefined {
  const saved = db.payoutAccounts[userId];
  const account = saved?.groups[groupId] ?? saved?.default;
  if (!account) return undefined;
  return { ...account, source: saved?.groups[groupId] ? 'taab' : 'default' };
}

export const localPayoutsService = {
  async getMine(): Promise<MyPayoutAccounts> {
    const me = requireSession();
    return read((db) => {
      const saved = db.payoutAccounts[me.userId];
      return {
        default: saved?.default,
        groups: groupsForUser(db, me.userId).map((g) => ({ groupId: g.id, groupName: g.name, account: saved?.groups[g.id] })),
      };
    });
  },

  /** Your usual account, shown in every taab that doesn't have its own. `null` removes it. */
  async setDefault(account: PayoutAccount | null): Promise<void> {
    const me = requireSession();
    const value = account ? clean(account) : null;
    await write((db) => {
      const saved = (db.payoutAccounts[me.userId] ??= { groups: {} });
      if (value) saved.default = value;
      else delete saved.default;
    });
  },

  /** A different account for one taab. `null` goes back to your default. */
  async setForGroup(groupId: string, account: PayoutAccount | null): Promise<void> {
    const me = requireSession();
    const value = account ? clean(account) : null;
    await write((db) => {
      requireGroup(db, groupId, me.userId);
      const saved = (db.payoutAccounts[me.userId] ??= { groups: {} });
      if (value) saved.groups[groupId] = value;
      else delete saved.groups[groupId];
    });
  },

  /** Members' accounts for paying them back. Only people in the taab can see them. */
  async getGroupAccounts(groupId: string): Promise<Record<string, MemberPayout>> {
    const me = requireSession();
    return read((db) => {
      const group = requireGroup(db, groupId, me.userId);
      const accounts: Record<string, MemberPayout> = {};
      for (const member of group.members) {
        if (member.status !== 'active') continue;
        const account = payoutFor(db, member.userId, groupId);
        if (account) accounts[member.userId] = account;
      }
      return accounts;
    });
  },
};

export const payoutsService = connectService('payouts', localPayoutsService);
