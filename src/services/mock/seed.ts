import { computeSplit } from '@/features/expenses/split';
import type {
  ActivityEvent,
  AppNotification,
  CurrencyCode,
  Expense,
  ExpenseCategory,
  Group,
  GroupMember,
  GroupType,
  RecurringExpense,
  Reminder,
  Settlement,
} from '@/types/models';
import { formatMoney } from '@/utils/money';

import type { MockDatabase } from './db';

/** Other taab users in the demo world. The signed-in user takes Ranmi's place. */
export const DIRECTORY = {
  gbayin: { userId: 'u_gbayin', name: 'Gbayin', email: 'gbayin@taab.app' },
  macky: { userId: 'u_macky', name: 'Macky P', email: 'mackyp@taab.app' },
  dami: { userId: 'u_dami', name: 'Dami', email: 'dami@taab.app' },
  femi: { userId: 'u_femi', name: 'Femi', email: 'femi@taab.app' },
  zainab: { userId: 'u_zainab', name: 'Zainab', email: 'zainab@taab.app' },
} as const;

export const DIRECTORY_USERS = Object.values(DIRECTORY);

type Person = { userId: string; name: string; email?: string };

function ago({ days = 0, hours = 0, minutes = 0 }: { days?: number; hours?: number; minutes?: number }) {
  return new Date(Date.now() - ((days * 24 + hours) * 60 + minutes) * 60_000).toISOString();
}

function inDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
}

function member(person: Person, joinedAt: string): GroupMember {
  return { userId: person.userId, name: person.name, email: person.email, status: 'active', joinedAt };
}

/**
 * Seeds the demo world for a signed-in user: Flat 12, Detty December and
 * Weekend Trip, with expenses, settlements, activity and notifications.
 * Group ids are namespaced by user so several demo accounts can coexist.
 */
export function seedDemoData(db: MockDatabase, me: Person) {
  const { gbayin, macky, dami, femi, zainab } = DIRECTORY;
  const suffix = me.userId.slice(-6);
  const currency: CurrencyCode = 'NGN';

  const groups: Group[] = [];
  const expenses: Expense[] = [];
  const settlements: Settlement[] = [];
  const activity: ActivityEvent[] = [];

  function addGroup(key: string, name: string, type: GroupType, people: Person[], createdAt: string, description?: string) {
    const group: Group = {
      id: `g_${key}_${suffix}`,
      name,
      description,
      type,
      currency,
      members: people.map((p) => member(p, createdAt)),
      createdBy: me.userId,
      createdAt,
      updatedAt: createdAt,
    };
    groups.push(group);
    activity.push({
      id: `a_${group.id}_created`,
      type: 'group_created',
      groupId: group.id,
      groupName: name,
      actorId: me.userId,
      actorName: me.name,
      createdAt,
    });
    return group;
  }

  function addExpense(
    group: Group,
    title: string,
    amountNaira: number,
    payer: Person,
    at: string,
    options: { between?: Person[]; category?: ExpenseCategory; notes?: string } = {},
  ) {
    const amount = amountNaira * 100;
    const between = options.between ?? group.members.map((m) => ({ userId: m.userId, name: m.name }));
    const split = computeSplit(
      amount,
      'equal',
      between.map((p) => ({ userId: p.userId })),
    );
    if (!split.ok) throw new Error(`Invalid seed split for ${title}`);
    const expense: Expense = {
      id: `e_${group.id}_${expenses.length + 1}`,
      groupId: group.id,
      title,
      amount,
      currency,
      paidBy: [{ userId: payer.userId, amount }],
      splitBetween: split.splits,
      splitMethod: 'equal',
      category: options.category,
      notes: options.notes,
      date: at,
      createdBy: payer.userId,
      createdAt: at,
      updatedAt: at,
    };
    expenses.push(expense);
    activity.push({
      id: `a_${expense.id}`,
      type: 'expense_created',
      groupId: group.id,
      groupName: group.name,
      actorId: payer.userId,
      actorName: payer.name,
      expenseId: expense.id,
      title,
      amount,
      currency,
      createdAt: at,
    });
    group.updatedAt = at > group.updatedAt ? at : group.updatedAt;
    return expense;
  }

  function addSettlement(group: Group, from: Person, to: Person, amountNaira: number, at: string, status: Settlement['status'] = 'confirmed') {
    const settlement: Settlement = {
      id: `s_${group.id}_${settlements.length + 1}`,
      groupId: group.id,
      fromUserId: from.userId,
      toUserId: to.userId,
      amount: amountNaira * 100,
      currency,
      method: 'bank_transfer',
      status,
      respondedAt: status === 'pending' ? undefined : at,
      createdBy: from.userId,
      createdAt: at,
    };
    settlements.push(settlement);
    // A waiting payment reads as the payer's claim; a confirmed one as the receiver's word.
    const pending = status === 'pending';
    activity.push({
      id: `a_${settlement.id}`,
      type: pending ? 'payment_recorded' : 'payment_confirmed',
      groupId: group.id,
      groupName: group.name,
      actorId: pending ? from.userId : to.userId,
      actorName: pending ? from.name : to.name,
      targetUserId: pending ? to.userId : from.userId,
      targetName: pending ? to.name : from.name,
      settlementId: settlement.id,
      amount: settlement.amount,
      currency,
      createdAt: at,
    });
    group.updatedAt = at > group.updatedAt ? at : group.updatedAt;
  }

  // Flat 12 — you're owed overall.
  const flat = addGroup('flat12', 'Flat 12', 'home', [me, gbayin, macky, dami], ago({ days: 40 }), 'Bills for the flat');
  addExpense(flat, 'Electricity', 32_500, me, ago({ days: 12 }), { category: 'utilities', notes: 'September prepaid units' });
  addSettlement(flat, dami, me, 10_000, ago({ days: 9 }));
  addExpense(flat, 'Netflix', 7_000, macky, ago({ days: 6 }), { category: 'subscriptions' });
  addExpense(flat, 'Uber home', 9_500, gbayin, ago({ days: 3 }), { category: 'transport' });
  addExpense(flat, 'Dinner at Nok', 48_000, me, ago({ days: 1, hours: 2 }), { category: 'food' });
  addSettlement(flat, macky, me, 6_000, ago({ hours: 2 }));
  addExpense(flat, 'Fuel', 18_000, gbayin, ago({ minutes: 10 }), { category: 'transport' });
  // Waiting for you: balances don't move until you confirm it on Home.
  addSettlement(flat, dami, me, 5_000, ago({ minutes: 4 }), 'pending');
  const netflix = expenses.find((e) => e.groupId === flat.id && e.title === 'Netflix');
  if (netflix) {
    activity.push({
      id: `a_${netflix.id}_edited`,
      type: 'expense_edited',
      groupId: flat.id,
      groupName: flat.name,
      actorId: macky.userId,
      actorName: macky.name,
      expenseId: netflix.id,
      title: netflix.title,
      amount: netflix.amount,
      currency,
      changes: [{ field: 'amount', from: 650_000, to: netflix.amount }],
      createdAt: ago({ days: 5 }),
    });
  }

  // Detty December — you owe a little.
  const detty = addGroup('detty', 'Detty December', 'event', [me, gbayin, macky, femi, dami, zainab], ago({ days: 30 }));
  addExpense(detty, 'Beach house deposit', 120_000, femi, ago({ days: 21 }), { category: 'travel' });
  addExpense(detty, 'Owambe drinks', 24_000, me, ago({ days: 14 }), { category: 'entertainment' });
  addExpense(detty, 'Bolt to Landmark', 13_500, zainab, ago({ days: 5 }), { between: [me, zainab, dami], category: 'transport' });
  addExpense(detty, 'Suya run', 9_000, macky, ago({ days: 2 }), { between: [me, macky], category: 'food' });
  addSettlement(detty, me, macky, 4_500, ago({ days: 1, hours: 1 }));

  // Weekend Trip — all settled.
  const trip = addGroup('weekend', 'Weekend Trip', 'trip', [me, femi, gbayin, zainab], ago({ days: 26 }));
  addExpense(trip, 'Cabin in Ilashe', 80_000, femi, ago({ days: 24 }), { category: 'travel' });
  addSettlement(trip, me, femi, 20_000, ago({ days: 20 }));
  addSettlement(trip, gbayin, femi, 20_000, ago({ days: 19 }));
  addSettlement(trip, zainab, femi, 20_000, ago({ days: 18 }));
  activity.push({
    id: `a_${trip.id}_zainab_joined`,
    type: 'member_joined',
    groupId: trip.id,
    groupName: trip.name,
    actorId: zainab.userId,
    actorName: zainab.name,
    createdAt: ago({ days: 25 }),
  });

  const reminder: Reminder = {
    id: `r_${flat.id}_1`,
    groupId: flat.id,
    fromUserId: me.userId,
    toUserId: dami.userId,
    amount: 1_875_000,
    currency,
    message: `Hey, just a reminder that ${formatMoney(1_875_000, currency)} is still outstanding on Flat 12.`,
    createdAt: ago({ days: 4 }),
  };
  activity.push({
    id: `a_${reminder.id}`,
    type: 'reminder_sent',
    groupId: flat.id,
    groupName: flat.name,
    actorId: me.userId,
    actorName: me.name,
    targetUserId: dami.userId,
    targetName: dami.name,
    amount: reminder.amount,
    currency,
    createdAt: reminder.createdAt,
  });

  const recurring: RecurringExpense = {
    id: `rc_${flat.id}_netflix`,
    groupId: flat.id,
    title: 'Netflix',
    amount: 700_000,
    currency,
    paidBy: [{ userId: macky.userId, amount: 700_000 }],
    splitBetween: computeSplitOrThrow(700_000, flat.members.map((m) => m.userId)),
    splitMethod: 'equal',
    frequency: 'monthly',
    nextDate: inDays(24),
    autoCreate: false,
    createdBy: macky.userId,
    createdAt: ago({ days: 6 }),
  };

  const notifications: AppNotification[] = [
    {
      id: `n_${suffix}_pending`,
      category: 'payment_received',
      title: 'Did you get this payment?',
      body: `${dami.name} says they paid you ${formatMoney(500_000, currency)} · Flat 12. Confirm it so balances update.`,
      groupId: flat.id,
      read: false,
      createdAt: ago({ minutes: 4 }),
    },
    {
      id: `n_${suffix}_1`,
      category: 'new_expense',
      title: 'Gbayin added an expense',
      body: 'Fuel • ₦18,000. Your share is ₦4,500.',
      groupId: flat.id,
      expenseId: expenses.find((e) => e.title === 'Fuel')?.id,
      read: false,
      createdAt: ago({ minutes: 10 }),
    },
    {
      id: `n_${suffix}_2`,
      category: 'payment_received',
      title: 'Macky P paid you ₦6,000',
      body: 'Flat 12 • Recorded as a bank transfer.',
      groupId: flat.id,
      read: false,
      createdAt: ago({ hours: 2 }),
    },
    {
      id: `n_${suffix}_3`,
      category: 'new_expense',
      title: 'Macky P added an expense',
      body: 'Suya run • ₦9,000. Your share is ₦4,500.',
      groupId: detty.id,
      read: true,
      createdAt: ago({ days: 2 }),
    },
    {
      id: `n_${suffix}_4`,
      category: 'member_joined',
      title: 'Zainab joined Weekend Trip',
      body: 'Say hi and add your first expense.',
      groupId: trip.id,
      read: true,
      createdAt: ago({ days: 25 }),
    },
  ];

  db.groups.push(...groups);
  db.expenses.push(...expenses);
  db.settlements.push(...settlements);
  db.activity.push(...activity);
  db.reminders.push(reminder);
  db.recurring.push(recurring);
  db.notifications[me.userId] = [...notifications, ...(db.notifications[me.userId] ?? [])];
}

function computeSplitOrThrow(amount: number, userIds: string[]) {
  const result = computeSplit(
    amount,
    'equal',
    userIds.map((userId) => ({ userId })),
  );
  if (!result.ok) throw new Error('Invalid seed split');
  return result.splits;
}
