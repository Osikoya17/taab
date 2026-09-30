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

  it('describes a recorded payment as a claim until it is confirmed', () => {
    const payment: ActivityEvent = { ...base, type: 'payment_recorded', actorId: 'u_macky', actorName: 'Macky P', targetUserId: 'me', targetName: 'Ranmi', amount: 600_000 };
    expect(describeActivity(payment, 'me')).toMatchObject({ title: 'Macky P says they paid you ₦6,000', tone: 'muted' });

    const mine: ActivityEvent = { ...payment, actorId: 'me', actorName: 'Ranmi', targetUserId: 'u_macky', targetName: 'Macky P', amount: 450_000 };
    expect(describeActivity(mine, 'me')).toMatchObject({ title: 'You recorded paying Macky P ₦4,500', tone: 'muted' });
  });

  it('describes confirmations and declines from the receiver', () => {
    const confirmed: ActivityEvent = { ...base, type: 'payment_confirmed', actorId: 'me', actorName: 'Ranmi', targetUserId: 'u_macky', targetName: 'Macky P', amount: 600_000 };
    expect(describeActivity(confirmed, 'me')).toMatchObject({ title: 'You confirmed ₦6,000 from Macky P', tone: 'positive' });
    expect(describeActivity(confirmed, 'u_macky')).toMatchObject({ title: 'Ranmi confirmed your ₦6,000 payment', tone: 'negative' });

    const declined: ActivityEvent = { ...confirmed, type: 'payment_declined' };
    expect(describeActivity(declined, 'u_macky').title).toBe('Ranmi says your ₦6,000 payment didn’t arrive');
    expect(describeActivity(declined, 'u_other').title).toBe('Ranmi didn’t receive ₦6,000 from Macky P');
  });

  it('says what an edit changed', () => {
    const edited: ActivityEvent = {
      ...base,
      type: 'expense_edited',
      amount: 1_200_000,
      changes: [
        { field: 'amount', from: 800_000, to: 1_200_000 },
        { field: 'split', from: [], to: [], fromMethod: 'equal', toMethod: 'equal' },
        { field: 'date', from: '2026-09-26T10:00:00.000Z', to: '2026-09-25T10:00:00.000Z' },
      ],
    };
    expect(describeActivity(edited, 'me')).toMatchObject({ title: 'Gbayin changed Fuel from ₦8,000 to ₦12,000', detail: 'Also changed the date' });

    const renamed: ActivityEvent = { ...edited, changes: [{ field: 'title', from: 'Fuel', to: 'Fuel + snacks' }, { field: 'receipt', change: 'added' }] };
    expect(describeActivity(renamed, 'me')).toMatchObject({ title: 'Gbayin edited Fuel', detail: 'Changed the name and the receipt' });

    // Edits saved before history existed have no changes to show.
    expect(describeActivity({ ...edited, changes: undefined }, 'me')).toMatchObject({ title: 'Gbayin edited Fuel', detail: undefined });
  });

  it('describes membership and reminders', () => {
    expect(describeActivity({ ...base, type: 'member_joined', actorName: 'Dami', groupName: 'Weekend Trip' }, 'me').title).toBe('Dami joined Weekend Trip');
    expect(
      describeActivity({ ...base, type: 'reminder_sent', actorId: 'me', targetUserId: 'u_dami', targetName: 'Dami' }, 'me').title,
    ).toBe('You reminded Dami');
  });

  it('keeps only expenses and payments in the Expenses tab', () => {
    const kinds = ['expense_created', 'expense_edited', 'expense_deleted', 'payment_recorded', 'payment_confirmed', 'payment_declined', 'member_joined', 'group_created', 'reminder_sent'] as const;
    expect(kinds.filter((type) => isMoneyEvent({ ...base, type }))).toEqual(['expense_created', 'expense_edited', 'expense_deleted', 'payment_recorded', 'payment_confirmed', 'payment_declined']);
  });
});
