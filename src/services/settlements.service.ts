import { connectService } from './api/service';
import { simplifyDebts } from '@/features/settlements/balances';
import type { CurrencyCode, MinorUnits, Settlement, SettlementMethod } from '@/types/models';

import { ServiceError } from './api/errors';
import { createId, read, write } from './mock/db';
import { groupBalances, groupsForUser, logActivity, memberName, requireGroup, touchGroup } from './mock/ledger';
import { requireSession } from './session';
import { settlementSchema } from './validation';

export type SettleSuggestion = {
  groupId: string;
  groupName: string;
  currency: CurrencyCode;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: MinorUnits;
  direction: 'you_owe' | 'owed_to_you';
};

export type RecordSettlementInput = {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: MinorUnits;
  method: SettlementMethod;
  note?: string;
};

export const localSettlementsService = {
  /**
   * Suggested payments that involve you, based on the simplified debt graph of
   * each group. Original expenses stay untouched.
   */
  async getSuggestions(groupId?: string): Promise<SettleSuggestion[]> {
    const me = requireSession();
    return read((db) => {
      const groups = groupId ? [requireGroup(db, groupId, me.userId)] : groupsForUser(db, me.userId);
      const suggestions: SettleSuggestion[] = [];
      for (const group of groups) {
        for (const t of simplifyDebts(groupBalances(db, group))) {
          if (t.fromUserId !== me.userId && t.toUserId !== me.userId) continue;
          suggestions.push({
            groupId: group.id,
            groupName: group.name,
            currency: group.currency,
            fromUserId: t.fromUserId,
            fromName: memberName(group, t.fromUserId),
            toUserId: t.toUserId,
            toName: memberName(group, t.toUserId),
            amount: t.amount,
            direction: t.fromUserId === me.userId ? 'you_owe' : 'owed_to_you',
          });
        }
      }
      // What you owe comes first — that's the question this screen answers.
      return suggestions.sort((a, b) =>
        a.direction === b.direction ? b.amount - a.amount : a.direction === 'you_owe' ? -1 : 1,
      );
    });
  },

  async listGroupSettlements(groupId: string): Promise<Settlement[]> {
    const me = requireSession();
    return read((db) => {
      requireGroup(db, groupId, me.userId);
      return db.settlements.filter((s) => s.groupId === groupId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  },

  async recordSettlement(input: RecordSettlementInput): Promise<Settlement> {
    if (!settlementSchema.safeParse(input).success) throw new ServiceError('validation');
    const me = requireSession();
    return write((db) => {
      const group = requireGroup(db, input.groupId, me.userId);
      const memberIds = new Set(group.members.map((m) => m.userId));
      if (!memberIds.has(input.fromUserId) || !memberIds.has(input.toUserId) || input.fromUserId === input.toUserId) {
        throw new ServiceError('validation');
      }
      // You can record a payment you made or one you received — not between two others.
      if (input.fromUserId !== me.userId && input.toUserId !== me.userId) throw new ServiceError('forbidden');
      if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new ServiceError('validation');

      const now = new Date().toISOString();
      const settlement: Settlement = {
        id: createId('s'),
        groupId: group.id,
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        amount: input.amount,
        currency: group.currency,
        method: input.method,
        note: input.note?.trim() || undefined,
        createdBy: me.userId,
        createdAt: now,
      };
      db.settlements.push(settlement);
      touchGroup(group, now);
      logActivity(db, {
        type: 'payment_recorded',
        groupId: group.id,
        groupName: group.name,
        actorId: input.fromUserId,
        actorName: memberName(group, input.fromUserId),
        targetUserId: input.toUserId,
        targetName: memberName(group, input.toUserId),
        amount: input.amount,
        currency: group.currency,
      });
      return settlement;
    });
  },
};

export const settlementsService = connectService('settlements', localSettlementsService);
