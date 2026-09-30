import { connectService } from './api/service';
import { isWithinAmountLimit } from '@/constants/currencies';
import { simplifyDebts } from '@/features/settlements/balances';
import type { CurrencyCode, MinorUnits, Settlement, SettlementMethod } from '@/types/models';
import { payoutFor, type MemberPayout } from './payouts.service';
import { formatMoney } from '@/utils/money';

import { ServiceError } from './api/errors';
import { createId, read, write, type MockDatabase } from './mock/db';
import { groupBalances, groupsForUser, logActivity, memberName, notifyUser, requireGroup, touchGroup } from './mock/ledger';
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
  /** Already recorded between these two but not yet confirmed by the receiver. */
  pendingAmount: MinorUnits;
  /** Where to send it, when you're the one paying and they've added an account. */
  payTo?: MemberPayout;
};

export type RecordSettlementInput = {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: MinorUnits;
  method: SettlementMethod;
  note?: string;
};

/** A payment waiting for its receiver, with the names the screens need. */
export type PendingPayment = {
  settlement: Settlement;
  groupName: string;
  fromName: string;
  toName: string;
  /** True when you are the receiver and your answer is what it's waiting for. */
  needsYou: boolean;
};

export type SettlementResponse = 'confirm' | 'decline';

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
          const pendingAmount = db.settlements
            .filter((s) => s.groupId === group.id && s.status === 'pending' && s.fromUserId === t.fromUserId && s.toUserId === t.toUserId)
            .reduce((sum, s) => sum + s.amount, 0);
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
            pendingAmount,
            payTo: t.fromUserId === me.userId ? payoutFor(db, t.toUserId, group.id) : undefined,
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

  /** Unconfirmed payments you're part of, the ones waiting on you first. */
  async listPending(): Promise<PendingPayment[]> {
    const me = requireSession();
    return read((db) => {
      const groups = new Map(groupsForUser(db, me.userId).map((g) => [g.id, g]));
      return db.settlements
        .filter((s) => s.status === 'pending' && groups.has(s.groupId) && (s.fromUserId === me.userId || s.toUserId === me.userId))
        .map((s) => {
          const group = groups.get(s.groupId)!;
          return { settlement: s, groupName: group.name, fromName: memberName(group, s.fromUserId), toName: memberName(group, s.toUserId), needsYou: s.toUserId === me.userId };
        })
        .sort((a, b) => Number(b.needsYou) - Number(a.needsYou) || b.settlement.createdAt.localeCompare(a.settlement.createdAt));
    });
  },

  /**
   * The payer's record waits for the receiver, who is the only one who knows
   * the money arrived. The receiver's own record counts straight away.
   */
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
      if (!isWithinAmountLimit(input.amount, group.currency)) throw new ServiceError('validation');

      const now = new Date().toISOString();
      const byReceiver = input.toUserId === me.userId;
      const settlement: Settlement = {
        id: createId('s'),
        groupId: group.id,
        fromUserId: input.fromUserId,
        toUserId: input.toUserId,
        amount: input.amount,
        currency: group.currency,
        method: input.method,
        note: input.note?.trim() || undefined,
        status: byReceiver ? 'confirmed' : 'pending',
        respondedAt: byReceiver ? now : undefined,
        createdBy: me.userId,
        createdAt: now,
      };
      db.settlements.push(settlement);
      touchGroup(group, now);
      const fromName = memberName(group, input.fromUserId);
      const toName = memberName(group, input.toUserId);
      const money = formatMoney(input.amount, group.currency);
      if (byReceiver) {
        logActivity(db, {
          type: 'payment_confirmed', groupId: group.id, groupName: group.name,
          actorId: me.userId, actorName: toName, targetUserId: input.fromUserId, targetName: fromName,
          settlementId: settlement.id, amount: input.amount, currency: group.currency,
        }, { title: 'Payment received', body: `${toName} marked ${money} from you as received · ${group.name}` });
      } else {
        logActivity(db, {
          type: 'payment_recorded', groupId: group.id, groupName: group.name,
          actorId: me.userId, actorName: fromName, targetUserId: input.toUserId, targetName: toName,
          settlementId: settlement.id, amount: input.amount, currency: group.currency,
        }, { title: 'Did you get this payment?', body: `${fromName} says they paid you ${money} · ${group.name}. Confirm it so balances update.` });
      }
      return settlement;
    });
  },

  /** The receiver says whether the money arrived. Only a pending payment can be answered, once. */
  async respondToSettlement(settlementId: string, response: SettlementResponse): Promise<Settlement> {
    const me = requireSession();
    return write((db) => {
      const settlement = db.settlements.find((s) => s.id === settlementId);
      if (!settlement) throw new ServiceError('not_found');
      const group = requireGroup(db, settlement.groupId, me.userId);
      if (settlement.toUserId !== me.userId) throw new ServiceError('forbidden');
      if (settlement.status !== 'pending') throw new ServiceError('validation');
      // Confirming moves balances, so the payer must still be in the taab.
      if (response === 'confirm' && !group.members.some((m) => m.userId === settlement.fromUserId)) throw new ServiceError('history_locked');

      const now = new Date().toISOString();
      settlement.status = response === 'confirm' ? 'confirmed' : 'declined';
      settlement.respondedAt = now;
      touchGroup(group, now);
      const toName = memberName(group, settlement.toUserId);
      const money = formatMoney(settlement.amount, settlement.currency);
      logActivity(db, {
        type: response === 'confirm' ? 'payment_confirmed' : 'payment_declined',
        groupId: group.id, groupName: group.name,
        actorId: me.userId, actorName: toName, targetUserId: settlement.fromUserId, targetName: memberName(group, settlement.fromUserId),
        settlementId: settlement.id, amount: settlement.amount, currency: settlement.currency,
      }, response === 'confirm'
        ? { title: 'Payment confirmed', body: `${toName} confirmed your ${money} payment · ${group.name}` }
        : { title: 'Payment not received', body: `${toName} says your ${money} payment hasn’t arrived · ${group.name}. Check the transfer, then record it again.` });
      return settlement;
    });
  },
};

/** How long a payment waits before its receiver gets a reminder to answer. */
export const PAYMENT_REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;

/** Pending payments whose receiver should be reminded now. */
export function paymentsDueForReminder(db: MockDatabase, now = Date.now()): Settlement[] {
  return db.settlements.filter((s) => s.status === 'pending' && !s.remindedAt && now - Date.parse(s.createdAt) >= PAYMENT_REMINDER_AFTER_MS);
}

/**
 * Reminds each receiver once about a payment that has waited more than a
 * day. Runs on the server's worker, not from the app.
 */
export function remindPendingPayments(db: MockDatabase, now = new Date()): number {
  let sent = 0;
  for (const settlement of paymentsDueForReminder(db, now.getTime())) {
    settlement.remindedAt = now.toISOString();
    const group = db.groups.find((g) => g.id === settlement.groupId);
    const receiver = group?.members.find((m) => m.userId === settlement.toUserId);
    // Someone who hasn't joined (or has left) can't answer yet.
    if (!group || receiver?.status !== 'active') continue;
    notifyUser(db, settlement.toUserId, 'payment_received', {
      title: 'Still waiting: did you get this payment?',
      body: `${memberName(group, settlement.fromUserId)} says they paid you ${formatMoney(settlement.amount, settlement.currency)} · ${group.name}. Confirm it so balances update.`,
      groupId: group.id,
    }, now.toISOString());
    sent++;
  }
  return sent;
}

export const settlementsService = connectService('settlements', localSettlementsService);
