import type { ActivityEvent } from '@/types/models';

import { describeActivity, isMoneyEvent } from './describe';

const base: ActivityEvent = {
  id: 'a1',
  type: 'expense_created',
  groupId: 'g1',
  groupName: 'Flat 12',
  actorId: 'u_gbayin',
  actorName: 'Gbayin',
  title: 'Fuel',
  amount: 1_800_000,
  currency: 'NGN',
  createdAt: '2026-09-26T10:00:00.000Z',
};

describe('describeActivity', () => {
  it('describes expenses from the actor', () => {
    expect(describeActivity(base, 'me').title).toBe('Gbayin added Fuel');
    expect(describeActivity({ ...base, actorId: 'me' }, 'me').title).toBe('You added Fuel');
  });

  it('describes payments from your perspective', () => {
    const payment: ActivityEvent = { ...base, type: 'payment_recorded', actorId: 'u_macky', actorName: 'Macky P', targetUserId: 'me', targetName: 'Ranmi', amount: 600_000 };
    expect(describeActivity(payment, 'me')).toMatchObject({ title: 'Macky P paid you ₦6,000', tone: 'positive' });

    const mine: ActivityEvent = { ...payment, actorId: 'me', actorName: 'Ranmi', targetUserId: 'u_macky', targetName: 'Macky P', amount: 450_000 };
    expect(describeActivity(mine, 'me')).toMatchObject({ title: 'You settled ₦4,500 with Macky P', tone: 'negative' });
  });

  it('describes membership and reminders', () => {
    expect(describeActivity({ ...base, type: 'member_joined', actorName: 'Dami', groupName: 'Weekend Trip' }, 'me').title).toBe('Dami joined Weekend Trip');
    expect(
      describeActivity({ ...base, type: 'reminder_sent', actorId: 'me', targetUserId: 'u_dami', targetName: 'Dami' }, 'me').title,
    ).toBe('You reminded Dami');
  });

  it('keeps only expenses and payments in the Expenses tab', () => {
    const kinds = ['expense_created', 'expense_edited', 'expense_deleted', 'payment_recorded', 'member_joined', 'group_created', 'reminder_sent'] as const;
    expect(kinds.filter((type) => isMoneyEvent({ ...base, type }))).toEqual(['expense_created', 'expense_edited', 'expense_deleted', 'payment_recorded']);
  });
});
