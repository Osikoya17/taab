import { connectService } from './api/service';
import { computeExpenseStatuses, type ExpenseSettlementStatus } from '@/features/settlements/balances';
import { isWithinAmountLimit } from '@/constants/currencies';
import { diffExpense } from '@/features/expenses/changes';
import { computeSplit } from '@/features/expenses/split';
import { nextOccurrence } from '@/features/recurring/schedule';
import type { ActivityEvent, Expense, ExpenseCategory, ExpensePayer, ExpenseSplit, ForeignAmount, Group, MinorUnits, SplitMethod } from '@/types/models';
import { formatMoney } from '@/utils/money';

import { ServiceError } from './api/errors';
import { createId, read, write, type MockDatabase } from './mock/db';
import { groupBalances, logActivity, memberName, requireGroup, touchGroup } from './mock/ledger';
import { requireSession } from './session';
import { expenseInputSchema, repeatSchema } from './validation';

export type ExpenseInput = {
  groupId: string;
  title: string;
  amount: MinorUnits;
  paidBy: ExpensePayer[];
  splitBetween: ExpenseSplit[];
  splitMethod: SplitMethod;
  date: string;
  category?: ExpenseCategory;
  notes?: string;
  receiptUrl?: string;
  original?: ForeignAmount;
  /** Set when the details came from a receipt scan the person reviewed. */
  scanId?: string;
};

export type ExpenseListItem = {
  expense: Expense;
  status: ExpenseSettlementStatus;
  myShare: MinorUnits;
  myPaid: MinorUnits;
};

export type ExpenseDetail = ExpenseListItem & { group: Group };

function sum(values: { amount: MinorUnits }[]) {
  return values.reduce((acc, v) => acc + v.amount, 0);
}

/** Server-side validation mirrors the client so a bad client can't corrupt the ledger. */
export function validateExpense(db: MockDatabase, group: Group, userId: string, input: ExpenseInput) {
  if (!expenseInputSchema.safeParse(input).success) throw new ServiceError('validation');
  if (!input.title.trim()) throw new ServiceError('validation');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new ServiceError('validation');
  if (!isWithinAmountLimit(input.amount, group.currency)) throw new ServiceError('validation');
  if (input.original && !isWithinAmountLimit(input.original.amount, input.original.currency)) throw new ServiceError('validation');
  if (sum(input.paidBy) !== input.amount || sum(input.splitBetween) !== input.amount) throw new ServiceError('validation');
  const memberIds = new Set(group.members.map((m) => m.userId));
  for (const entries of [input.paidBy, input.splitBetween]) {
    if (new Set(entries.map((p) => p.userId)).size !== entries.length) throw new ServiceError('validation');
  }
  for (const p of [...input.paidBy, ...input.splitBetween]) {
    if (!memberIds.has(p.userId) || !Number.isInteger(p.amount) || p.amount < 0) throw new ServiceError('validation');
  }
  const resolved = computeSplit(input.amount, input.splitMethod, input.splitBetween.map((s) => ({ userId: s.userId, value: input.splitMethod === 'exact' ? s.amount : s.value })));
  if (!resolved.ok || resolved.splits.some((s, i) => s.amount !== input.splitBetween[i].amount)) throw new ServiceError('validation');
}

/**
 * A scan can fill in an expense only for the person who scanned it, only once
 * it produced a draft, and only with its own photo. The scan is never proof
 * that the bill happened; a person still checks and saves it.
 */
function linkScan(db: MockDatabase, userId: string, input: ExpenseInput) {
  if (!input.scanId) return;
  const job = db.scanJobs[input.scanId];
  if (!job || job.userId !== userId || job.status !== 'drafted' || (input.receiptUrl && input.receiptUrl !== job.receiptUrl)) throw new ServiceError('validation');
}

function toListItem(expense: Expense, statuses: Map<string, ExpenseSettlementStatus>, userId: string): ExpenseListItem {
  return {
    expense,
    status: statuses.get(expense.id) ?? 'unsettled',
    myShare: expense.splitBetween.find((s) => s.userId === userId)?.amount ?? 0,
    myPaid: expense.paidBy.find((p) => p.userId === userId)?.amount ?? 0,
  };
}

function statusesFor(db: MockDatabase, group: Group) {
  const expenses = db.expenses.filter((e) => e.groupId === group.id);
  return computeExpenseStatuses(expenses, groupBalances(db, group));
}

function protectFormerMembers(db: MockDatabase, group: Group) {
  const members = new Set(group.members.map((m) => m.userId));
  for (const [userId, balance] of groupBalances(db, group)) {
    if (!members.has(userId) && balance !== 0) throw new ServiceError('history_locked');
  }
}

export const localExpensesService = {
  async listGroupExpenses(groupId: string): Promise<ExpenseListItem[]> {
    const me = requireSession();
    return read((db) => {
      const group = requireGroup(db, groupId, me.userId);
      const statuses = statusesFor(db, group);
      return db.expenses
        .filter((e) => e.groupId === groupId)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((e) => toListItem({ ...e, receiptUrl: undefined }, statuses, me.userId));
    });
  },

  async getExpense(expenseId: string): Promise<ExpenseDetail> {
    const me = requireSession();
    return read((db) => {
      const expense = db.expenses.find((e) => e.id === expenseId);
      if (!expense) throw new ServiceError('not_found');
      const group = requireGroup(db, expense.groupId, me.userId);
      return { ...toListItem(expense, statusesFor(db, group), me.userId), group };
    });
  },

  /** Who created the expense and every edit since, oldest first. */
  async getHistory(expenseId: string): Promise<ActivityEvent[]> {
    const me = requireSession();
    return read((db) => {
      const expense = db.expenses.find((e) => e.id === expenseId);
      if (!expense) throw new ServiceError('not_found');
      requireGroup(db, expense.groupId, me.userId);
      return db.activity
        .filter((a) => a.expenseId === expenseId && (a.type === 'expense_created' || a.type === 'expense_edited'))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    });
  },

  async createExpense(input: ExpenseInput, repeat?: { frequency: 'weekly' | 'monthly'; autoCreate: boolean }): Promise<Expense> {
    const me = requireSession();
    return write((db) => {
      const group = requireGroup(db, input.groupId, me.userId);
      validateExpense(db, group, me.userId, input);
      if (repeat && !repeatSchema.safeParse(repeat).success) throw new ServiceError('validation');
      const now = new Date().toISOString();
      linkScan(db, me.userId, input);
      const expense: Expense = {
        ...input,
        id: createId('e'),
        title: input.title.trim(),
        notes: input.notes?.trim() || undefined,
        currency: group.currency,
        createdBy: me.userId,
        createdAt: now,
        updatedAt: now,
      };
      db.expenses.push(expense);
      if (input.scanId) db.scanJobs[input.scanId].expenseId = expense.id;
      if (repeat) {
        const id = createId('rc');
        expense.recurringId = id;
        db.recurring.push({
          id, groupId: group.id, title: expense.title, amount: expense.amount, currency: group.currency,
          paidBy: input.paidBy, splitBetween: input.splitBetween, splitMethod: input.splitMethod,
          ...repeat, anchorDay: new Date(input.date).getUTCDate(),
          nextDate: nextOccurrence(input.date, repeat.frequency), createdBy: me.userId, createdAt: now,
        });
      }
      touchGroup(group, now);
      logActivity(db, {
        type: 'expense_created',
        groupId: group.id,
        groupName: group.name,
        actorId: me.userId,
        actorName: memberName(group, me.userId),
        expenseId: expense.id,
        title: expense.title,
        amount: expense.amount,
        currency: expense.currency,
      });
      return expense;
    });
  },

  async updateExpense(expenseId: string, input: ExpenseInput): Promise<Expense> {
    const me = requireSession();
    return write((db) => {
      const index = db.expenses.findIndex((e) => e.id === expenseId);
      if (index === -1) throw new ServiceError('not_found');
      const existing = db.expenses[index];
      const group = requireGroup(db, existing.groupId, me.userId);
      if (input.groupId !== existing.groupId) throw new ServiceError('validation');
      const formerMembers = new Set([...existing.paidBy, ...existing.splitBetween]
        .filter((p) => !group.members.some((m) => m.userId === p.userId)).map((p) => p.userId));
      if ([...input.paidBy, ...input.splitBetween].some((p) => formerMembers.has(p.userId))) throw new ServiceError('history_locked');
      validateExpense(db, group, me.userId, input);
      const now = new Date().toISOString();
      const updated: Expense = {
        ...existing,
        ...input,
        groupId: existing.groupId,
        title: input.title.trim(),
        notes: input.notes?.trim() || undefined,
        // Replaced, never inherited: an edited amount must not keep a stale "entered as".
        original: input.original,
        // Which scan an expense came from is fixed when it's created.
        scanId: existing.scanId,
        updatedAt: now,
      };
      db.expenses[index] = updated;
      protectFormerMembers(db, group);
      touchGroup(group, now);
      const changes = diffExpense(existing, updated);
      // Saving without changing anything isn't worth a line in everyone's history.
      if (changes.length) {
        const actorName = memberName(group, me.userId);
        const amountChange = changes.find((c) => c.field === 'amount');
        logActivity(db, {
          type: 'expense_edited',
          groupId: group.id,
          groupName: group.name,
          actorId: me.userId,
          actorName,
          expenseId,
          title: updated.title,
          amount: updated.amount,
          currency: updated.currency,
          changes,
        }, {
          title: 'Expense changed',
          body: amountChange?.field === 'amount'
            ? `${actorName} changed ${updated.title} from ${formatMoney(amountChange.from, updated.currency)} to ${formatMoney(amountChange.to, updated.currency)}`
            : `${actorName} changed ${updated.title}`,
        });
      }
      return updated;
    });
  },

  async deleteExpense(expenseId: string): Promise<void> {
    const me = requireSession();
    await write((db) => {
      const expense = db.expenses.find((e) => e.id === expenseId);
      if (!expense) throw new ServiceError('not_found');
      const group = requireGroup(db, expense.groupId, me.userId);
      db.expenses = db.expenses.filter((e) => e.id !== expenseId);
      protectFormerMembers(db, group);
      touchGroup(group);
      logActivity(db, {
        type: 'expense_deleted',
        groupId: group.id,
        groupName: group.name,
        actorId: me.userId,
        actorName: memberName(group, me.userId),
        title: expense.title,
        amount: expense.amount,
        currency: expense.currency,
      });
    });
  },
};

export const expensesService = connectService('expenses', localExpensesService);
