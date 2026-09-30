import { connectService } from './api/service';
import type { Expense, RecurringExpense } from '@/types/models';
import { nextOccurrence } from '@/features/recurring/schedule';

import { ServiceError } from './api/errors';
import { createId, read, write, type MockDatabase } from './mock/db';
import { logActivity, memberName, requireGroup, touchGroup } from './mock/ledger';
import { requireSession } from './session';
import { validateExpense } from './expenses.service';
import { recurringInputSchema } from './validation';

export type RecurringInput = Omit<RecurringExpense, 'id' | 'createdBy' | 'createdAt' | 'currency'>;

export { nextOccurrence } from '@/features/recurring/schedule';

function materialize(db: MockDatabase, rule: RecurringExpense, actorId: string): Expense {
  const group = requireGroup(db, rule.groupId, actorId);
  validateExpense(db, group, actorId, { ...rule, date: rule.nextDate });
  const now = new Date().toISOString();
  const expense: Expense = {
    id: createId('e'),
    groupId: rule.groupId,
    title: rule.title,
    amount: rule.amount,
    currency: rule.currency,
    paidBy: rule.paidBy,
    splitBetween: rule.splitBetween,
    splitMethod: rule.splitMethod,
    date: rule.nextDate,
    recurringId: rule.id,
    createdBy: actorId,
    createdAt: now,
    updatedAt: now,
  };
  db.expenses.push(expense);
  touchGroup(group, now);
  logActivity(db, {
    type: 'expense_created',
    groupId: group.id,
    groupName: group.name,
    actorId,
    actorName: memberName(group, actorId),
    expenseId: expense.id,
    title: expense.title,
    amount: expense.amount,
    currency: expense.currency,
  });
  rule.anchorDay ??= new Date(rule.nextDate).getUTCDate();
  rule.nextDate = nextOccurrence(rule.nextDate, rule.frequency, rule.intervalDays, rule.anchorDay);
  return expense;
}

function dueRules(db: MockDatabase, userId: string) {
  const now = new Date().toISOString();
  return db.recurring.filter(
    (r) => r.nextDate <= now && db.groups.some((g) => g.id === r.groupId && g.members.some((m) => m.userId === userId)),
  );
}

export const localRecurringService = {
  async list(groupId: string): Promise<RecurringExpense[]> {
    const me = requireSession();
    return read((db) => {
      requireGroup(db, groupId, me.userId);
      return db.recurring.filter((r) => r.groupId === groupId).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    });
  },

  async create(input: RecurringInput): Promise<RecurringExpense> {
    const me = requireSession();
    return write((db) => {
      const group = requireGroup(db, input.groupId, me.userId);
      if (!recurringInputSchema.safeParse(input).success) throw new ServiceError('validation');
      validateExpense(db, group, me.userId, { ...input, date: input.nextDate });
      const rule: RecurringExpense = {
        ...input,
        id: createId('rc'),
        currency: group.currency,
        anchorDay: input.anchorDay ?? new Date(input.nextDate).getUTCDate(),
        createdBy: me.userId,
        createdAt: new Date().toISOString(),
      };
      db.recurring.push(rule);
      return rule;
    });
  },

  async remove(id: string): Promise<void> {
    const me = requireSession();
    await write((db) => {
      const rule = db.recurring.find((r) => r.id === id);
      if (!rule) throw new ServiceError('not_found');
      requireGroup(db, rule.groupId, me.userId);
      if (rule.createdBy !== me.userId) throw new ServiceError('forbidden');
      db.recurring = db.recurring.filter((r) => r.id !== id);
    });
  },

  /**
   * Runs due rules. Auto-create rules become expenses immediately; the rest are
   * returned so the user can confirm or skip. The server also runs this every
   * minute; local demo processing runs when Home refreshes.
   */
  async processDue(): Promise<{ created: Expense[]; pending: RecurringExpense[] }> {
    const me = requireSession();
    return write((db) => {
      const created: Expense[] = [];
      const pending: RecurringExpense[] = [];
      for (const rule of dueRules(db, me.userId)) {
        if (rule.createdBy !== me.userId) continue;
        if (rule.autoCreate) {
          // Limit catch-up work per request; subsequent runs continue where this one ends.
          let count = 0;
          while (Date.parse(rule.nextDate) <= Date.now() && count++ < 120) created.push(materialize(db, rule, me.userId));
        } else pending.push(rule);
      }
      return { created, pending };
    });
  },

  async confirmDue(id: string): Promise<Expense> {
    const me = requireSession();
    return write((db) => {
      const rule = db.recurring.find((r) => r.id === id);
      if (!rule) throw new ServiceError('not_found');
      requireGroup(db, rule.groupId, me.userId);
      if (rule.createdBy !== me.userId) throw new ServiceError('forbidden');
      if (Date.parse(rule.nextDate) > Date.now()) throw new ServiceError('validation', 'not_due');
      return materialize(db, rule, me.userId);
    });
  },

  async skipDue(id: string): Promise<void> {
    const me = requireSession();
    await write((db) => {
      const rule = db.recurring.find((r) => r.id === id);
      if (!rule) throw new ServiceError('not_found');
      requireGroup(db, rule.groupId, me.userId);
      if (rule.createdBy !== me.userId) throw new ServiceError('forbidden');
      if (Date.parse(rule.nextDate) > Date.now()) throw new ServiceError('validation', 'not_due');
      rule.anchorDay ??= new Date(rule.nextDate).getUTCDate();
      rule.nextDate = nextOccurrence(rule.nextDate, rule.frequency, rule.intervalDays, rule.anchorDay);
    });
  },
};

export const recurringService = connectService('recurring', localRecurringService);
