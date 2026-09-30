import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';

import { createApi, processDeletions, processPaymentReminders, processRecurring } from './api';
import { createReceiptStore, openDatabase } from './storage';
import { ServiceError } from '../src/services/api/errors';
import { read, write } from '../src/services/mock/db';
import type { Group } from '../src/types/models';
import { deliverPush } from './push';
import { runWorkerCycle, startWorker } from './worker';

test('shared-data API validates, isolates accounts, and persists the ledger', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'taab-test-'));
  const filename = join(directory, 'taab.sqlite');
  let database = openDatabase(filename);
  const server = createApi({
    allowedOrigins: ['http://localhost:8081'],
    receipts: createReceiptStore(database),
    authenticate: async (request) => {
      const userId = request.headers.authorization?.replace('Bearer ', '');
      if (!userId || !['alice', 'bob', 'eve'].includes(userId)) throw new ServiceError('forbidden');
      return { userId, name: userId, email: `${userId}@example.com`, createdAt: new Date().toISOString() };
    },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function rpc(user: string, method: string, args: unknown[] = []) {
    const response = await fetch(`${base}/rpc/${method}`, { method: 'POST', headers: { Authorization: `Bearer ${user}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ args }) });
    return { status: response.status, data: await response.json() };
  }
  let group: Group;
  try {
    await t.test('health, authentication, and method allowlist', async () => {
      assert.equal((await fetch(`${base}/health`)).status, 200);
      assert.equal((await rpc('', 'groups/listGroups')).status, 403);
      assert.equal((await rpc('alice', 'groups/toString')).status, 404);
      assert.equal((await rpc('alice', '__proto__/constructor')).status, 404);
      assert.equal((await fetch(`${base}/health`, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    });
    await t.test('create profiles and group with a deduplicated email invitation', async () => {
      assert.equal((await rpc('alice', 'users/completeSetup', [{ name: 'Alice', useCase: 'friends', currency: 'NGN', includeSampleTaabs: true }])).status, 200);
      const created = await rpc('alice', 'groups/createGroup', [{ name: 'Shared trip', type: 'trip', currency: 'NGN', invites: [{ kind: 'email', email: 'BOB@example.com' }, { kind: 'email', email: 'bob@example.com' }] }]);
      assert.equal(created.status, 200);
      group = created.data;
      assert.equal(group.members.length, 2);
      assert.equal((await rpc('alice', 'groups/listGroups')).data.length, 1, 'production never seeds fictional groups');
      assert.equal((await rpc('eve', 'groups/getGroup', [group.id])).status, 403);
    });
    await t.test('validate split totals, dates, duplicates, and settlement methods', async () => {
      const input = { groupId: group.id, title: 'Dinner', amount: 1000, paidBy: [{ userId: 'alice', amount: 1000 }], splitBetween: [{ userId: 'alice', amount: 500 }, { userId: group.members[1].userId, amount: 500 }], splitMethod: 'equal', date: new Date().toISOString() };
      assert.equal((await rpc('alice', 'expenses/createExpense', [{ ...input, date: 'invalid' }, null])).status, 422);
      const huge = 100_000_000 * 100 + 2;
      const hugeInput = { ...input, amount: huge, paidBy: [{ userId: 'alice', amount: huge }], splitBetween: [{ userId: 'alice', amount: huge / 2 }, { userId: group.members[1].userId, amount: huge / 2 }] };
      assert.equal((await rpc('alice', 'expenses/createExpense', [hugeInput, null])).status, 422, 'more than ₦100m in one expense is refused');
      assert.equal((await rpc('alice', 'settlements/recordSettlement', [{ groupId: group.id, fromUserId: 'alice', toUserId: group.members[1].userId, amount: huge, method: 'cash' }])).status, 422);
      assert.equal((await rpc('alice', 'expenses/createExpense', [{ ...input, splitBetween: [{ userId: 'alice', amount: 500 }, { userId: 'alice', amount: 500 }] }, null])).status, 422);
      assert.equal((await rpc('alice', 'expenses/createExpense', [input, { frequency: 'yearly', autoCreate: true }])).status, 422);
      assert.equal((await rpc('alice', 'expenses/listGroupExpenses', [group.id])).data.length, 0, 'failed recurring creation does not save a partial expense');
      assert.equal((await rpc('alice', 'expenses/createExpense', [input, null])).status, 200);
      assert.equal((await rpc('alice', 'settlements/recordSettlement', [{ groupId: group.id, fromUserId: group.members[1].userId, toUserId: 'alice', amount: 500, method: 'in_app' }])).status, 422);
    });
    await t.test('receipt photos are kept out of the ledger and shown only to members', async () => {
      const png = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]).toString('base64')}`;
      const input = { groupId: group.id, title: 'Receipt test', amount: 1000, paidBy: [{ userId: 'alice', amount: 1000 }], splitBetween: [{ userId: 'alice', amount: 1000 }], splitMethod: 'equal', date: new Date().toISOString(), receiptUrl: png };
      assert.equal((await rpc('eve', 'expenses/createExpense', [input, null])).status, 403, 'non-members cannot store photos');
      const created = await rpc('alice', 'expenses/createExpense', [input, null]);
      assert.equal(created.status, 200);
      const ref: string = created.data.receiptUrl;
      assert.match(ref, /^\/receipts\/[0-9a-f-]{36}$/);
      assert.equal(await read((db) => JSON.stringify(db).includes('base64')), false, 'the photo is not in the ledger');
      const fetchReceipt = (user: string) => fetch(`${base}${ref}`, { headers: { Authorization: `Bearer ${user}` } });
      const own = await fetchReceipt('alice');
      assert.equal(own.status, 200);
      assert.equal((await own.json()).uri, png);
      assert.equal((await fetchReceipt('eve')).status, 404);
      assert.equal((await rpc('alice', 'expenses/updateExpense', [created.data.id, { ...input, title: 'Receipt kept', receiptUrl: ref }])).status, 200, 'edits keep the stored photo');
      assert.equal((await rpc('alice', 'expenses/createExpense', [{ ...input, receiptUrl: ref }, null])).status, 422, 'another expense cannot borrow it');
    });
    await t.test('expenses entered in another currency keep what was typed until the amount changes', async () => {
      const naira = (amount: number) => ({ groupId: group.id, title: 'Airport taxi', amount, paidBy: [{ userId: 'alice', amount }], splitBetween: [{ userId: 'alice', amount }], splitMethod: 'equal', date: new Date().toISOString() });
      const original = { amount: 1000, currency: 'USD', rate: 1327.301923 };
      const created = await rpc('alice', 'expenses/createExpense', [{ ...naira(1_327_302), original }, null]);
      assert.equal(created.status, 200);
      assert.deepEqual((await rpc('alice', 'expenses/getExpense', [created.data.id])).data.expense.original, original);
      assert.equal((await rpc('alice', 'expenses/createExpense', [{ ...naira(1000), original: { ...original, rate: -1 } }, null])).status, 422);
      assert.equal((await rpc('alice', 'expenses/updateExpense', [created.data.id, naira(1_000_000)])).status, 200);
      assert.equal((await rpc('alice', 'expenses/getExpense', [created.data.id])).data.expense.original, undefined, 'a changed amount drops the stale original');
    });
    await t.test('join tokens preserve the invited person’s existing expense shares', async () => {
      await rpc('bob', 'users/completeSetup', [{ name: 'Bob', useCase: 'friends', currency: 'NGN', includeSampleTaabs: false }]);
      const placeholderId = group.members[1].userId;
      await write((db) => {
        db.activity.push({ id: 'placeholder_event', type: 'payment_recorded', groupId: group.id, groupName: group.name, actorId: 'alice', actorName: 'Alice', targetUserId: placeholderId, targetName: 'bob', amount: 100, currency: 'NGN', createdAt: new Date().toISOString() });
      });
      const invite = await rpc('alice', 'groups/getInviteLink', [group.id]);
      const token = String(invite.data).split('/').at(-1)!;
      assert.equal((await rpc('bob', 'groups/joinGroup', ['invalid'])).status, 404);
      const joined = await rpc('bob', 'groups/joinGroup', [token]);
      assert.equal(joined.status, 200);
      assert.equal(joined.data.members.length, 2);
      assert.equal((await rpc('bob', 'groups/getGroup', [group.id])).data.myBalance, -500);
      assert.equal(await read((db) => db.activity.find((e) => e.id === 'placeholder_event')?.targetUserId), 'bob', 'past activity moves to the joined account');
      assert.equal((await rpc('bob', 'groups/joinGroup', [token])).data.members.length, 2);
      await write((db) => { db.inviteLinks[token].expiresAt = new Date(0).toISOString(); });
      assert.equal((await rpc('eve', 'groups/joinGroup', [token])).status, 404);
    });
    await t.test('search and direct adds only reach people you share a taab with', async () => {
      await rpc('eve', 'users/completeSetup', [{ name: 'Eve', useCase: 'friends', currency: 'NGN', includeSampleTaabs: false }]);
      assert.deepEqual((await rpc('alice', 'groups/searchPeople', ['eve'])).data, [], 'strangers are not searchable');
      assert.deepEqual((await rpc('alice', 'groups/searchPeople', ['bob'])).data.map((p: { userId: string }) => p.userId), ['bob']);
      assert.equal((await rpc('alice', 'groups/inviteMembers', [group.id, [{ kind: 'user', userId: 'eve' }]])).status, 404);
      const invited = await rpc('alice', 'groups/inviteMembers', [group.id, [{ kind: 'email', email: 'eve@example.com' }]]);
      assert.equal(invited.status, 200);
      const pending = invited.data.members.find((m: { email?: string }) => m.email === 'eve@example.com');
      assert.equal(pending.status, 'invited', 'an existing account is only invited, not added');
      assert.notEqual(pending.userId, 'eve');
      assert.equal((await rpc('eve', 'groups/getGroup', [group.id])).status, 403);
    });
    await t.test('concurrent requests keep identities separate', async () => {
      const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => rpc(i % 2 ? 'alice' : 'bob', 'users/getProfile')));
      responses.forEach((response, i) => assert.equal(response.data.id, i % 2 ? 'alice' : 'bob'));
    });
    await t.test('reminders reach the recipient and respect cooldown', async () => {
      const input = { groupId: group.id, toUserId: 'bob', message: 'Dinner repayment' };
      assert.equal((await rpc('alice', 'reminders/sendReminder', [input])).status, 200);
      assert.equal((await rpc('alice', 'reminders/sendReminder', [input])).status, 429);
      assert.ok((await rpc('bob', 'notifications/list')).data.some((n: { category: string }) => n.category === 'reminder'));
      assert.equal((await rpc('bob', 'notifications/markAllRead')).status, 200);
    });
    await t.test('payments count only once the person who received them confirms', async () => {
      const balance = async (user: string) => (await rpc(user, 'groups/getGroup', [group.id])).data.myBalance as number;
      const bobBefore = await balance('bob');
      const record = (user: string, fromUserId: string, toUserId: string, amount: number) =>
        rpc(user, 'settlements/recordSettlement', [{ groupId: group.id, fromUserId, toUserId, amount, method: 'bank_transfer' }]);

      const claimed = await record('bob', 'bob', 'alice', 200);
      assert.equal(claimed.data.status, 'pending');
      assert.equal(await balance('bob'), bobBefore, 'a claim alone moves nothing');
      const alicePending = (await rpc('alice', 'settlements/listPending')).data;
      assert.deepEqual(alicePending.map((p: { settlement: { id: string }; needsYou: boolean }) => [p.settlement.id, p.needsYou]), [[claimed.data.id, true]]);
      assert.equal((await rpc('bob', 'settlements/listPending')).data[0].needsYou, false);
      assert.ok((await rpc('alice', 'notifications/list')).data.some((n: { title: string }) => n.title === 'Did you get this payment?'));
      const suggestion = (await rpc('bob', 'settlements/getSuggestions', [group.id])).data.find((s: { toUserId: string }) => s.toUserId === 'alice');
      assert.equal(suggestion?.pendingAmount, 200);

      assert.equal((await rpc('bob', 'settlements/respondToSettlement', [claimed.data.id, 'confirm'])).status, 403, 'the payer cannot confirm their own claim');
      assert.equal((await rpc('eve', 'settlements/respondToSettlement', [claimed.data.id, 'confirm'])).status, 403);
      assert.equal((await rpc('alice', 'settlements/respondToSettlement', [claimed.data.id, 'maybe'])).status, 422);
      assert.equal((await rpc('alice', 'settlements/respondToSettlement', [claimed.data.id, 'decline'])).data.status, 'declined');
      assert.equal(await balance('bob'), bobBefore, 'a declined payment moves nothing');
      assert.equal((await rpc('alice', 'settlements/respondToSettlement', [claimed.data.id, 'confirm'])).status, 422, 'an answer is final');
      assert.ok((await rpc('bob', 'notifications/list')).data.some((n: { title: string }) => n.title === 'Payment not received'));

      const retried = await record('bob', 'bob', 'alice', 200);
      assert.equal((await rpc('alice', 'settlements/respondToSettlement', [retried.data.id, 'confirm'])).data.status, 'confirmed');
      assert.equal(await balance('bob'), bobBefore + 200);

      // The receiver's own record needs no second step.
      assert.equal((await record('alice', 'bob', 'alice', 100)).data.status, 'confirmed');
      assert.equal(await balance('bob'), bobBefore + 300);

      // Put balances back for the tests that follow: Alice pays the same back through both routes.
      const back = await record('alice', 'alice', 'bob', 200);
      assert.equal((await rpc('bob', 'settlements/respondToSettlement', [back.data.id, 'confirm'])).status, 200);
      assert.equal((await record('bob', 'alice', 'bob', 100)).data.status, 'confirmed');
      assert.equal(await balance('bob'), bobBefore);
      const events = (await rpc('alice', 'activity/listActivity', [{ groupId: group.id }])).data.items.map((e: { type: string }) => e.type);
      assert.ok(events.includes('payment_confirmed') && events.includes('payment_declined'));
    });
    await t.test('waiting payments show beside balances and get one reminder after a day', async () => {
      const claim = await rpc('bob', 'settlements/recordSettlement', [{ groupId: group.id, fromUserId: 'bob', toUserId: 'alice', amount: 250, method: 'cash' }]);
      assert.equal((await rpc('bob', 'groups/getGroup', [group.id])).data.myPendingPaid, 250);
      const aliceView = (await rpc('alice', 'groups/getGroup', [group.id])).data;
      assert.equal(aliceView.myPendingReceived, 250);
      assert.equal(aliceView.balances.find((b: { userId: string }) => b.userId === 'bob').pendingPaid, 250);
      assert.equal((await rpc('alice', 'groups/listGroups')).data[0].myPendingReceived, 250);

      const reminders = async () => (await rpc('alice', 'notifications/list')).data.filter((n: { title: string }) => n.title.startsWith('Still waiting')).length;
      assert.equal(await processPaymentReminders(), 0, 'nothing is due in the first day');
      await write((db) => { db.settlements.find((s) => s.id === claim.data.id)!.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); });
      assert.equal(await processPaymentReminders(), 1);
      assert.equal(await processPaymentReminders(), 0, 'each payment is reminded once');
      assert.equal(await reminders(), 1);

      assert.equal((await rpc('alice', 'settlements/respondToSettlement', [claim.data.id, 'decline'])).status, 200);
      assert.equal((await rpc('bob', 'groups/getGroup', [group.id])).data.myPendingPaid, 0);
    });
    await t.test('edits record what changed, visible to the whole taab', async () => {
      const expense = await read((db) => db.expenses.find((e) => e.groupId === group.id)!);
      const input = { groupId: group.id, title: expense.title, amount: expense.amount, paidBy: expense.paidBy, splitBetween: expense.splitBetween, splitMethod: expense.splitMethod, date: expense.date };
      const historyLength = async () => (await rpc('bob', 'expenses/getHistory', [expense.id])).data.length as number;
      const before = await historyLength();
      assert.equal((await rpc('alice', 'expenses/updateExpense', [expense.id, input])).status, 200);
      assert.equal(await historyLength(), before, 'saving without changes adds nothing');

      assert.equal((await rpc('alice', 'expenses/updateExpense', [expense.id, { ...input, title: 'Dinner at Nok', notes: 'Birthday' }])).status, 200);
      const history = (await rpc('bob', 'expenses/getHistory', [expense.id])).data;
      assert.equal(history.length, before + 1);
      assert.deepEqual(history.at(-1).changes, [{ field: 'title', from: expense.title, to: 'Dinner at Nok' }, { field: 'notes', to: 'Birthday' }]);
      assert.ok((await rpc('bob', 'notifications/list')).data.some((n: { title: string; body: string }) => n.title === 'Expense changed' && n.body.includes('Dinner at Nok')));
      assert.equal((await rpc('eve', 'expenses/getHistory', [expense.id])).status, 403);
      assert.equal((await rpc('alice', 'expenses/updateExpense', [expense.id, input])).status, 200);
    });
    await t.test('leaving stops related recurring bills and protects settled history', async () => {
      await write((db) => {
        const expense = db.expenses[0];
        db.recurring.push({ ...expense, id: 'leaver_rule', frequency: 'monthly', autoCreate: true, nextDate: '2099-01-01T00:00:00.000Z' });
      });
      const payment = await rpc('bob', 'settlements/recordSettlement', [{ groupId: group.id, fromUserId: 'bob', toUserId: 'alice', amount: 500, method: 'cash' }]);
      assert.equal(payment.status, 200);
      assert.equal((await rpc('bob', 'groups/leaveGroup', [group.id])).status, 422, 'an unconfirmed payment keeps you in the taab');
      assert.equal((await rpc('alice', 'settlements/respondToSettlement', [payment.data.id, 'confirm'])).status, 200);
      assert.equal((await rpc('bob', 'groups/leaveGroup', [group.id])).status, 200);
      assert.equal(await read((db) => db.recurring.some((r) => r.id === 'leaver_rule')), false);
      const original = await read((db) => db.expenses[0]);
      const deletion = await rpc('alice', 'expenses/deleteExpense', [original.id]);
      assert.equal(deletion.status, 409);
      assert.equal(deletion.data.code, 'history_locked');
      const revised = { groupId: group.id, title: 'Revised', amount: 1000, date: original.date, splitMethod: 'equal', paidBy: [{ userId: 'alice', amount: 1000 }], splitBetween: [{ userId: 'alice', amount: 1000 }] };
      assert.equal((await rpc('alice', 'expenses/updateExpense', [original.id, revised])).status, 409);
      assert.deepEqual(await read((db) => db.expenses[0]), original, 'failed edits roll back');
      assert.equal((await rpc('alice', 'groups/getGroup', [group.id])).data.myBalance, 0);
      const invite = await rpc('alice', 'groups/getInviteLink', [group.id]);
      assert.equal((await rpc('bob', 'groups/joinGroup', [String(invite.data).split('/').at(-1)!])).status, 200);
    });
    await t.test('same-timestamp activity pages do not skip records', async () => {
      await write((db) => {
        db.activity = Array.from({ length: 60 }, (_, i) => ({ id: `event_${String(i).padStart(3, '0')}`, type: 'group_created', groupId: group.id, groupName: group.name, actorId: 'alice', actorName: 'Alice', createdAt: new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z' }));
      });
      const ids = new Set<string>();
      let before: string | undefined;
      do {
        const page = await rpc('alice', 'activity/listActivity', [{ before }]);
        assert.equal(page.status, 200);
        for (const event of page.data.items) ids.add(event.id);
        before = page.data.nextCursor;
      } while (before);
      assert.equal(ids.size, 60);
    });
    await t.test('recurring confirmations require ownership and a due date', async () => {
      const rule = { groupId: group.id, title: 'Rent', amount: 1000, paidBy: [{ userId: 'alice', amount: 1000 }], splitBetween: [{ userId: 'alice', amount: 500 }, { userId: 'bob', amount: 500 }], splitMethod: 'equal', frequency: 'monthly', autoCreate: false, nextDate: new Date().toISOString() };
      const result = await rpc('alice', 'recurring/create', [rule]);
      assert.equal(result.status, 200);
      assert.equal((await rpc('bob', 'recurring/confirmDue', [result.data.id])).status, 403);
      assert.equal((await rpc('alice', 'recurring/confirmDue', [result.data.id])).status, 200);
      assert.equal((await rpc('alice', 'recurring/confirmDue', [result.data.id])).status, 422);
    });
    await t.test('registering a shared device detaches its previous account', async () => {
      const token = 'ExpoPushToken[shared_device]';
      assert.equal((await rpc('alice', 'notifications/registerPushToken', [token])).status, 200);
      assert.equal((await rpc('bob', 'notifications/registerPushToken', [token])).status, 200);
      assert.equal(await read((db) => db.pushTokens.alice), undefined);
      assert.deepEqual(await read((db) => db.pushTokens.bob), [token]);
      assert.equal((await rpc('bob', 'notifications/registerPushToken', ['ExpoPushToken[bob_tablet]'])).status, 200);
      assert.deepEqual(await read((db) => db.pushTokens.bob), [token, 'ExpoPushToken[bob_tablet]'], 'a second device keeps the first');
    });
    await t.test('push reaches every device and forgets only rejected ones', async () => {
      const phone = 'ExpoPushToken[test]';
      const tablet = 'ExpoPushToken[tablet]';
      await write((db) => {
        db.pushTokens.bob = [phone, tablet];
        db.notifications.bob = [{ id: 'push_test', title: 'Payment', body: 'Recorded', category: 'payment_received', read: false, createdAt: new Date().toISOString() }];
        db.pushOutbox.push_test = { userId: 'bob', notificationId: 'push_test', attempts: 0, nextAttemptAt: new Date(0).toISOString() };
      });
      await deliverPush(async (url, init) => {
        assert.equal(url, 'https://exp.host/--/api/v2/push/send');
        assert.deepEqual(JSON.parse(String(init?.body)).map((m: { to: string }) => m.to), [phone, tablet]);
        return Response.json({ data: [{ status: 'ok', id: 'ticket_1' }, { status: 'ok', id: 'ticket_2' }] });
      });
      assert.deepEqual(await read((db) => db.pushOutbox.push_test.tickets), [{ id: 'ticket_1', token: phone }, { id: 'ticket_2', token: tablet }]);
      await write((db) => { db.pushOutbox.push_test.nextAttemptAt = new Date(0).toISOString(); });
      await deliverPush(async (url) => {
        assert.equal(url, 'https://exp.host/--/api/v2/push/getReceipts');
        return Response.json({ data: { ticket_1: { status: 'error', details: { error: 'DeviceNotRegistered' } }, ticket_2: { status: 'ok' } } });
      });
      assert.deepEqual(await read((db) => db.pushTokens.bob), [tablet]);
      assert.equal(await read((db) => db.pushOutbox.push_test), undefined);
    });
    await t.test('an old push receipt cannot unregister a replacement device token', async () => {
      await write((db) => {
        db.pushTokens.bob = ['ExpoPushToken[replacement]'];
        db.pushOutbox.rotated = { userId: 'bob', notificationId: 'push_test', attempts: 0, nextAttemptAt: new Date(0).toISOString(), ticketId: 'old_ticket', sentToken: 'ExpoPushToken[old]' };
        db.pushOutbox.legacy = { userId: 'bob', notificationId: 'push_test', attempts: 0, nextAttemptAt: new Date(0).toISOString(), ticketId: 'legacy_ticket' };
      });
      await deliverPush(async () => Response.json({ data: {
        old_ticket: { status: 'error', details: { error: 'DeviceNotRegistered' } },
        legacy_ticket: { status: 'error', details: { error: 'DeviceNotRegistered' } },
      } }));
      assert.deepEqual(await read((db) => db.pushTokens.bob), ['ExpoPushToken[replacement]']);
      assert.equal(await read((db) => db.pushOutbox.rotated), undefined);
      assert.equal(await read((db) => db.pushOutbox.legacy), undefined);
    });
    await t.test('recurring jobs continue after another account fails', async () => {
      await write((db) => {
        const template = db.recurring[0];
        db.recurring.push({ ...template, id: 'alice_due', autoCreate: true, nextDate: new Date().toISOString() });
        db.recurring.push({ ...template, id: 'bob_due', createdBy: 'bob', autoCreate: true, nextDate: new Date().toISOString() });
      });
      // Alice's rule no longer adds up, so the server refuses her run; Bob's must still run.
      await write((db) => { const rule = db.recurring.find((r) => r.id === 'alice_due')!; rule.splitBetween = rule.splitBetween.map((s) => ({ ...s, amount: s.amount + 1 })); });
      await assert.rejects(processRecurring());
      assert.equal(await read((db) => db.expenses.filter((e) => e.recurringId === 'bob_due').length), 1);
      assert.equal(await read((db) => db.expenses.filter((e) => e.recurringId === 'alice_due').length), 0);
    });
    await t.test('deletion jobs retry failed accounts while completing healthy accounts', async () => {
      await write((db) => {
        for (const userId of ['failed_cleanup', 'healthy_cleanup']) db.pendingDeletions[userId] = { userId, name: 'Test', email: `${userId}@example.com`, createdAt: new Date().toISOString() };
      });
      const called: string[] = [];
      await assert.rejects(processDeletions(async (id) => {
        called.push(id);
        if (id === 'failed_cleanup') throw new Error('temporary deletion outage');
      }));
      assert.deepEqual(called, ['failed_cleanup', 'healthy_cleanup']);
      assert.ok(await read((db) => db.pendingDeletions.failed_cleanup));
      assert.equal(await read((db) => db.pendingDeletions.healthy_cleanup), undefined);
      await write((db) => { delete db.pendingDeletions.failed_cleanup; });
    });
    await t.test('worker isolates stages and waits for a running cycle on shutdown', async () => {
      const calls: string[] = [];
      await runWorkerCycle([
        { name: 'deletion', run: async () => { throw new Error('failure'); } },
        { name: 'push', run: async () => { calls.push('push'); } },
      ], (name) => calls.push(`failed:${name}`));
      assert.deepEqual(calls, ['failed:deletion', 'push']);
      let release!: () => void;
      let started!: () => void;
      const running = new Promise<void>((resolve) => { started = resolve; });
      const blocked = new Promise<void>((resolve) => { release = resolve; });
      let finished = false;
      const worker = startWorker([{ name: 'test', run: async () => { started(); await blocked; finished = true; } }], 5);
      await running;
      const stopping = worker.stop();
      assert.equal(finished, false);
      release();
      await stopping;
      assert.equal(finished, true);
    });
    await t.test('account deletion preserves other members’ financial history', async () => {
      const balance = (await rpc('bob', 'groups/getGroup', [group.id])).data.myBalance;
      assert.equal((await rpc('alice', 'users/deleteAccountData')).status, 200);
      const detail = await rpc('bob', 'groups/getGroup', [group.id]);
      assert.equal(detail.status, 200);
      assert.equal(detail.data.myBalance, balance);
      assert.ok(detail.data.group.members.some((m: { name: string }) => m.name === 'Deleted member'));
      assert.ok(!detail.data.group.members.some((m: { userId: string }) => m.userId === 'alice'));
    });
    await t.test('SQLite survives closing and reopening the server store', async () => {
      database.close();
      database = openDatabase(filename);
      assert.equal(await read((db) => db.groups.length), 1);
      assert.ok(await read((db) => db.expenses.length) >= 2);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    database.close();
    for (const suffix of ['', '-wal', '-shm']) rmSync(filename + suffix, { force: true });
    rmdirSync(directory);
  }
});
