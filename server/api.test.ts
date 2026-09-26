import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';

import { createApi } from './api';
import { openDatabase } from './storage';
import { ServiceError } from '../src/services/api/errors';
import { read, write } from '../src/services/mock/db';
import type { Group } from '../src/types/models';
import { deliverPush } from './push';

test('shared-data API validates, isolates accounts, and persists the ledger', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'taab-test-'));
  const filename = join(directory, 'taab.sqlite');
  let database = openDatabase(filename);
  const server = createApi({
    allowedOrigins: ['http://localhost:8081'],
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
      assert.equal((await rpc('alice', 'expenses/createExpense', [{ ...input, splitBetween: [{ userId: 'alice', amount: 500 }, { userId: 'alice', amount: 500 }] }, null])).status, 422);
      assert.equal((await rpc('alice', 'expenses/createExpense', [input, { frequency: 'monthly', autoCreate: true }])).status, 403);
      assert.equal((await rpc('alice', 'expenses/listGroupExpenses', [group.id])).data.length, 0, 'failed recurring creation does not save a partial expense');
      assert.equal((await rpc('alice', 'expenses/createExpense', [input, null])).status, 200);
      assert.equal((await rpc('alice', 'settlements/recordSettlement', [{ groupId: group.id, fromUserId: group.members[1].userId, toUserId: 'alice', amount: 500, method: 'in_app' }])).status, 422);
    });
    await t.test('join tokens preserve the invited person’s existing expense shares', async () => {
      await rpc('bob', 'users/completeSetup', [{ name: 'Bob', useCase: 'friends', currency: 'NGN', includeSampleTaabs: false }]);
      const invite = await rpc('alice', 'groups/getInviteLink', [group.id]);
      const token = String(invite.data).split('/').at(-1)!;
      assert.equal((await rpc('bob', 'groups/joinGroup', ['invalid'])).status, 404);
      const joined = await rpc('bob', 'groups/joinGroup', [token]);
      assert.equal(joined.status, 200);
      assert.equal(joined.data.members.length, 2);
      assert.equal((await rpc('bob', 'groups/getGroup', [group.id])).data.myBalance, -500);
      assert.equal((await rpc('bob', 'groups/joinGroup', [token])).data.members.length, 2);
      await write((db) => { db.inviteLinks[token].expiresAt = new Date(0).toISOString(); });
      assert.equal((await rpc('eve', 'groups/joinGroup', [token])).status, 404);
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
      await write((db) => { db.subscriptions.alice = { plan: 'plus_monthly', status: 'active', currentPeriodEnd: '2099-01-01T00:00:00.000Z', updatedAt: new Date().toISOString() }; });
      const rule = { groupId: group.id, title: 'Rent', amount: 1000, paidBy: [{ userId: 'alice', amount: 1000 }], splitBetween: [{ userId: 'alice', amount: 500 }, { userId: 'bob', amount: 500 }], splitMethod: 'equal', frequency: 'monthly', autoCreate: false, nextDate: new Date().toISOString() };
      const result = await rpc('alice', 'recurring/create', [rule]);
      assert.equal(result.status, 200);
      assert.equal((await rpc('bob', 'recurring/confirmDue', [result.data.id])).status, 403);
      assert.equal((await rpc('alice', 'recurring/confirmDue', [result.data.id])).status, 200);
      assert.equal((await rpc('alice', 'recurring/confirmDue', [result.data.id])).status, 422);
    });
    await t.test('push outbox checks delivery receipts and removes invalid tokens', async () => {
      await write((db) => {
        db.pushTokens.bob = 'ExpoPushToken[test]';
        db.notifications.bob = [{ id: 'push_test', title: 'Payment', body: 'Recorded', category: 'payment_received', read: false, createdAt: new Date().toISOString() }];
        db.pushOutbox.push_test = { userId: 'bob', notificationId: 'push_test', attempts: 0, nextAttemptAt: new Date(0).toISOString() };
      });
      await deliverPush(async (url) => {
        assert.equal(url, 'https://exp.host/--/api/v2/push/send');
        return Response.json({ data: { status: 'ok', id: 'ticket_1' } });
      });
      assert.equal(await read((db) => db.pushOutbox.push_test.ticketId), 'ticket_1');
      await write((db) => { db.pushOutbox.push_test.nextAttemptAt = new Date(0).toISOString(); });
      await deliverPush(async (url) => {
        assert.equal(url, 'https://exp.host/--/api/v2/push/getReceipts');
        return Response.json({ data: { ticket_1: { status: 'error', details: { error: 'DeviceNotRegistered' } } } });
      });
      assert.equal(await read((db) => db.pushTokens.bob), undefined);
      assert.equal(await read((db) => db.pushOutbox.push_test), undefined);
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
