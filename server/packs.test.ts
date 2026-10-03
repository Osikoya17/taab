import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';

import { createApi, processPackMaintenance } from './api';
import { validPaystackSignature, webhookReference } from './payments/paystack';
import { packsFromEnv } from './packs-config';
import { createReceiptStore, openDatabase } from './storage';
import { ServiceError } from '../src/services/api/errors';
import { read, write } from '../src/services/mock/db';
import { reconcileByReference } from '../src/services/packs.service';
import { configurePacks, ScanFailure, type PaymentProvider, type ReceiptScanner, type VerifiedPayment } from '../src/services/packs/runtime';
import { DEMO_RECEIPT_PHOTOS } from '../src/features/scans/demo-photos';

const PHOTO = DEMO_RECEIPT_PHOTOS[0];
const WEBHOOK_SECRET = 'test_webhook_secret';

/** A scanner the tests steer: it can succeed, fail, or wait on a gate to prove concurrency rules. */
const scannerControl = { mode: 'ok' as 'ok' | 'fail' | 'unreadable', gate: null as Promise<void> | null, calls: 0 };
const scanner: ReceiptScanner = {
  name: 'demo',
  async extract(_image, hint) {
    scannerControl.calls++;
    if (scannerControl.gate) await scannerControl.gate;
    if (scannerControl.mode === 'fail') throw new Error('provider down');
    if (scannerControl.mode === 'unreadable') throw new ScanFailure('unreadable');
    return {
      merchant: 'Test Kitchen', total: 125_000, currency: hint.currency, date: '2026-09-01',
      items: [{ description: 'Rice', amount: 100_000 }], charges: [{ label: 'Service', amount: 20_000 }],
      confidence: { total: 'high', date: 'high' }, source: 'demo',
    };
  },
};

/** A payment provider whose answers the tests choose, standing in for Paystack. */
const providerAnswers = new Map<string, VerifiedPayment>();
const provider: PaymentProvider = {
  name: 'paystack',
  async createCheckout({ reference }) { return { checkoutUrl: `https://checkout.example/${reference}` }; },
  async verify(reference) { return providerAnswers.get(reference) ?? { status: 'pending', amount: 0, currency: 'NGN' }; },
};

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => { open = resolve; });
  return { promise, open };
}

test('packs: free core, credits, purchases, scans and reports', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'taab-packs-'));
  const filename = join(directory, 'taab.sqlite');
  const database = openDatabase(filename);
  const receipts = createReceiptStore(database);
  const demoRuntime = { allowances: { receipt_scan_pack: 3, trip_pack: 5 }, checkout: { mode: 'demo' as const }, scanner, storeReceipt: (uri: string) => `/receipts/${receipts.put(uri)}` };
  configurePacks(demoRuntime);
  const server = createApi({
    allowedOrigins: ['http://localhost:8081'],
    receipts,
    paystackSecret: WEBHOOK_SECRET,
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
  const balance = async (user: string) => (await rpc(user, 'packs/getBalances')).data.personal as { available: number; reserved: number };
  const buyDemo = async (user: string, productId: string, groupId?: string) => {
    const started = await rpc(user, 'packs/startPurchase', [{ productId, ...(groupId ? { groupId } : {}) }]);
    assert.equal(started.status, 200, JSON.stringify(started.data));
    return (await rpc(user, 'packs/completeDemoPurchase', [started.data.purchase.id, 'success'])).data;
  };
  let key = 0;
  const scanInput = (extra: Record<string, unknown> = {}) => ({ key: `scan_key_${++key}_padding`, image: PHOTO, account: 'personal', ...extra });

  try {
    for (const user of ['alice', 'bob', 'eve']) {
      assert.equal((await rpc(user, 'users/completeSetup', [{ name: user, useCase: 'trips', currency: 'NGN', includeSampleTaabs: false }])).status, 200);
    }
    const created = await rpc('alice', 'groups/createGroup', [{ name: 'Lagos trip', type: 'trip', currency: 'NGN', invites: [{ kind: 'email', email: 'bob@example.com' }] }]);
    const trip = created.data;
    const token = String((await rpc('alice', 'groups/getInviteLink', [trip.id])).data).split('/').at(-1)!;
    assert.equal((await rpc('bob', 'groups/joinGroup', [token])).status, 200);

    await t.test('former taab+ features work on the free app', async () => {
      // More taabs than the old free limit of 5.
      for (let i = 0; i < 6; i++) assert.equal((await rpc('alice', 'groups/createGroup', [{ name: `Extra ${i}`, type: 'friends', currency: 'NGN', invites: [] }])).status, 200);
      const expense = { groupId: trip.id, title: 'Villa', amount: 1000, date: new Date().toISOString(), paidBy: [{ userId: 'alice', amount: 1000 }] };
      const bobId = 'bob';
      assert.equal((await rpc('alice', 'expenses/createExpense', [{ ...expense, splitMethod: 'percentage', splitBetween: [{ userId: 'alice', amount: 600, value: 6000 }, { userId: bobId, amount: 400, value: 4000 }] }, null])).status, 200, 'percentage split');
      assert.equal((await rpc('alice', 'expenses/createExpense', [{ ...expense, splitMethod: 'shares', splitBetween: [{ userId: 'alice', amount: 500, value: 1 }, { userId: bobId, amount: 500, value: 1 }] }, { frequency: 'monthly', autoCreate: false }])).status, 200, 'shares split with repeat');
      assert.equal((await rpc('alice', 'recurring/create', [{ ...expense, splitMethod: 'equal', splitBetween: [{ userId: 'alice', amount: 500 }, { userId: bobId, amount: 500 }], frequency: 'weekly', autoCreate: false, nextDate: new Date(Date.now() + 86400_000).toISOString() }])).status, 200, 'recurring');
      await write((db) => { db.activity.push({ id: 'ancient_event', type: 'group_created', groupId: trip.id, groupName: trip.name, actorId: 'alice', actorName: 'alice', createdAt: '2020-01-01T00:00:00.000Z' }); });
      let before: string | undefined;
      const seen = new Set<string>();
      do {
        const page = (await rpc('alice', 'activity/listActivity', [{ groupId: trip.id, before }])).data;
        assert.equal(page.historyLimited, false);
        for (const item of page.items) seen.add(item.id);
        before = page.nextCursor ?? undefined;
      } while (before);
      assert.ok(seen.has('ancient_event'), 'old history stays visible');
    });

    await t.test('catalog follows configuration and nothing is sold without an allowance', async () => {
      assert.ok((await rpc('alice', 'packs/getCatalog')).data.products.every((p: { purchasable: boolean }) => p.purchasable));
      configurePacks({ allowances: { receipt_scan_pack: null, trip_pack: null } });
      const catalog = (await rpc('alice', 'packs/getCatalog')).data;
      assert.deepEqual(catalog.products.map((p: { reason: string }) => p.reason), ['allowance_not_set', 'allowance_not_set']);
      assert.equal((await rpc('alice', 'packs/startPurchase', [{ productId: 'receipt_scan_pack' }])).status, 503);
      configurePacks(demoRuntime);
    });

    await t.test('personal credits arrive only after a verified payment, once', async () => {
      const started = await rpc('alice', 'packs/startPurchase', [{ productId: 'receipt_scan_pack' }]);
      assert.equal(started.data.purchase.status, 'pending');
      assert.equal((await rpc('alice', 'packs/confirmPurchase', [started.data.purchase.id])).data.status, 'pending', 'returning from checkout proves nothing');
      assert.equal((await balance('alice')).available, 0);
      assert.equal((await rpc('bob', 'packs/confirmPurchase', [started.data.purchase.id])).status, 403, 'only the buyer confirms');
      assert.equal((await rpc('alice', 'packs/completeDemoPurchase', [started.data.purchase.id, 'success'])).data.status, 'paid');
      assert.equal((await balance('alice')).available, 3);
      // Repeated confirmations and demo callbacks never grant twice.
      await rpc('alice', 'packs/confirmPurchase', [started.data.purchase.id]);
      await rpc('alice', 'packs/completeDemoPurchase', [started.data.purchase.id, 'success']);
      assert.equal((await balance('alice')).available, 3);
      const cancelled = await rpc('alice', 'packs/startPurchase', [{ productId: 'receipt_scan_pack' }]);
      assert.equal((await rpc('alice', 'packs/completeDemoPurchase', [cancelled.data.purchase.id, 'cancelled'])).data.status, 'cancelled');
      assert.equal((await balance('alice')).available, 3);
    });

    await t.test('real checkout: verification, duplicates, mismatches, refunds and webhooks', async () => {
      configurePacks({ checkout: { mode: 'provider', provider } });
      const started = await rpc('eve', 'packs/startPurchase', [{ productId: 'receipt_scan_pack' }]);
      assert.equal(started.data.checkoutUrl, `https://checkout.example/${started.data.purchase.id}`);
      assert.equal((await rpc('eve', 'packs/completeDemoPurchase', [started.data.purchase.id, 'success'])).status, 403, 'no demo completion outside demo mode');
      assert.equal((await rpc('eve', 'packs/confirmPurchase', [started.data.purchase.id])).data.status, 'pending');
      assert.equal((await balance('eve')).available, 0);

      const wrong = await rpc('eve', 'packs/startPurchase', [{ productId: 'receipt_scan_pack' }]);
      providerAnswers.set(wrong.data.purchase.id, { status: 'success', amount: 100, currency: 'NGN' });
      assert.equal((await rpc('eve', 'packs/confirmPurchase', [wrong.data.purchase.id])).data.status, 'failed', 'an underpayment grants nothing');
      assert.equal((await balance('eve')).available, 0);

      providerAnswers.set(started.data.purchase.id, { status: 'success', amount: 100_000, currency: 'NGN' });
      await Promise.all([reconcileByReference(started.data.purchase.id), reconcileByReference(started.data.purchase.id), rpc('eve', 'packs/confirmPurchase', [started.data.purchase.id])]);
      assert.equal((await balance('eve')).available, 3, 'duplicate notifications grant once');

      // Webhooks: a forged signature is refused; a signed one triggers verification with the provider.
      const body = Buffer.from(JSON.stringify({ event: 'refund.processed', data: { transaction_reference: started.data.purchase.id } }));
      const post = (signature: string) => fetch(`${base}/webhooks/paystack`, { method: 'POST', headers: { 'x-paystack-signature': signature, 'Content-Type': 'application/json' }, body });
      assert.equal((await post('0'.repeat(128))).status, 403);
      providerAnswers.set(started.data.purchase.id, { status: 'reversed', amount: 100_000, currency: 'NGN' });
      assert.equal((await post(createHmac('sha512', WEBHOOK_SECRET).update(body).digest('hex'))).status, 200);
      assert.equal((await balance('eve')).available, 0, 'a refund removes unused credits');
      assert.equal((await rpc('eve', 'packs/listPurchases')).data.find((p: { id: string }) => p.id === started.data.purchase.id).status, 'refunded');
      configurePacks(demoRuntime);
    });

    await t.test('trip packs: members only, one per taab, shared credits', async () => {
      assert.equal((await rpc('eve', 'packs/startPurchase', [{ productId: 'trip_pack', groupId: trip.id }])).status, 403, 'non-members cannot buy for a taab');
      const first = await rpc('alice', 'packs/startPurchase', [{ productId: 'trip_pack', groupId: trip.id }]);
      assert.equal((await rpc('bob', 'packs/startPurchase', [{ productId: 'trip_pack', groupId: trip.id }])).status, 409, 'a second checkout for the same taab is blocked');
      assert.equal((await rpc('alice', 'packs/startPurchase', [{ productId: 'trip_pack', groupId: trip.id }])).data.purchase.id, first.data.purchase.id, 'your own unfinished checkout is reused');
      assert.equal((await rpc('alice', 'packs/completeDemoPurchase', [first.data.purchase.id, 'success'])).data.status, 'paid');
      assert.equal((await rpc('bob', 'packs/startPurchase', [{ productId: 'trip_pack', groupId: trip.id }])).status, 409, 'an owned pack cannot be bought again');

      const pack = (await rpc('bob', 'packs/getGroupPack', [trip.id])).data;
      assert.equal(pack.owned, true);
      assert.equal(pack.credits.available, 5);
      const bobBefore = await balance('bob');
      const scan = await rpc('bob', 'scans/startScan', [scanInput({ account: 'group', groupId: trip.id })]);
      assert.equal(scan.data.status, 'drafted');
      assert.equal(scan.data.payer, 'group');
      assert.equal((await rpc('bob', 'packs/getGroupPack', [trip.id])).data.credits.available, 4, 'the taab paid');
      assert.deepEqual(await balance('bob'), bobBefore, 'not the member personally');
      assert.equal((await rpc('eve', 'scans/startScan', [scanInput({ account: 'group', groupId: trip.id })])).status, 403, 'non-members cannot spend shared scans');
      const other = (await rpc('alice', 'groups/listGroups')).data.find((g: { group: { id: string } }) => g.group.id !== trip.id).group.id;
      assert.equal((await rpc('alice', 'scans/startScan', [scanInput({ account: 'group', groupId: other })])).status, 403, 'a taab without the pack has no shared scans');
      assert.equal((await rpc('alice', 'scans/startScan', [scanInput({ batchId: 'batch_personal_1' })])).status, 403, 'bulk scanning comes with the pack');
    });

    await t.test('concurrent scans never overspend, and one key is charged once', async () => {
      await write((db) => { db.creditAccounts['user:alice'] = { available: 3, reserved: 0 }; });
      const hold = gate();
      scannerControl.gate = hold.promise;
      const racing = [1, 2, 3, 4].map(() => rpc('alice', 'scans/startScan', [scanInput()]));
      const sameKey = scanInput();
      await new Promise((resolve) => setTimeout(resolve, 150));
      hold.open();
      scannerControl.gate = null;
      const results = await Promise.all(racing);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 200, 402]);
      assert.deepEqual(await balance('alice'), { available: 0, reserved: 0 });
      assert.equal((await rpc('alice', 'scans/startScan', [sameKey])).status, 402, 'insufficient credits');

      await write((db) => { db.creditAccounts['user:alice'] = { available: 2, reserved: 0 }; });
      const hold2 = gate();
      scannerControl.gate = hold2.promise;
      const a = rpc('alice', 'scans/startScan', [sameKey]);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const b = await rpc('alice', 'scans/startScan', [sameKey]);
      assert.equal(b.data.status, 'reserved', 'the repeat sees the scan in progress');
      hold2.open();
      scannerControl.gate = null;
      assert.equal((await a).data.status, 'drafted');
      assert.equal((await rpc('alice', 'scans/startScan', [sameKey])).data.status, 'drafted');
      assert.deepEqual(await balance('alice'), { available: 1, reserved: 0 }, 'charged once');
    });

    await t.test('failed scans cost nothing, and a retry is charged once', async () => {
      await write((db) => { db.creditAccounts['user:alice'] = { available: 2, reserved: 0 }; });
      const input = scanInput();
      scannerControl.mode = 'fail';
      const failed = await rpc('alice', 'scans/startScan', [input]);
      assert.equal(failed.data.status, 'failed');
      assert.equal(failed.data.error, 'scanner_error');
      scannerControl.mode = 'unreadable';
      assert.equal((await rpc('alice', 'scans/startScan', [input])).data.error, 'unreadable');
      assert.deepEqual(await balance('alice'), { available: 2, reserved: 0 });
      scannerControl.mode = 'ok';
      const retried = await rpc('alice', 'scans/startScan', [input]);
      assert.equal(retried.data.status, 'drafted');
      assert.equal(retried.data.id, failed.data.id, 'the same scan, retried');
      assert.equal(retried.data.attempts, 3);
      await rpc('alice', 'scans/startScan', [input]);
      assert.deepEqual(await balance('alice'), { available: 1, reserved: 0 });
      assert.equal((await rpc('alice', 'scans/startScan', [{ ...scanInput(), image: 'data:image/png;base64,bm90IGFuIGltYWdl' }])).status, 422, 'not really an image');
    });

    await t.test('interrupted scans give their credits back, and a late result changes nothing', async () => {
      await write((db) => { db.creditAccounts['user:alice'] = { available: 1, reserved: 0 }; });
      const hold = gate();
      scannerControl.gate = hold.promise;
      const pending = rpc('alice', 'scans/startScan', [scanInput()]);
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.deepEqual(await balance('alice'), { available: 0, reserved: 1 });
      const { recovered } = await processPackMaintenance(Date.now() + 11 * 60 * 1000);
      assert.equal(recovered, 1);
      assert.deepEqual(await balance('alice'), { available: 1, reserved: 0 });
      hold.open();
      scannerControl.gate = null;
      const late = await pending;
      assert.equal(late.data.status, 'failed');
      assert.equal(late.data.error, 'interrupted');
      assert.deepEqual(await balance('alice'), { available: 1, reserved: 0 }, 'not charged by the late result');
    });

    await t.test('a reviewed scan fills an expense; nobody else can use it', async () => {
      await write((db) => { db.creditAccounts['user:alice'] = { available: 1, reserved: 0 }; });
      const scan = (await rpc('alice', 'scans/startScan', [scanInput({ groupId: trip.id })])).data;
      assert.equal(scan.draft.source, 'demo');
      assert.deepEqual(scan.draft.warnings, ['items_dont_match_total'], 'mismatched totals are flagged');
      const receipt = await fetch(`${base}${scan.receiptUrl}`, { headers: { Authorization: 'Bearer alice' } });
      assert.equal(receipt.status, 200, 'the scanner can see their photo');
      assert.equal((await fetch(`${base}${scan.receiptUrl}`, { headers: { Authorization: 'Bearer eve' } })).status, 404, 'others cannot');
      const expense = { groupId: trip.id, title: 'Test Kitchen', amount: 125_000, date: new Date().toISOString(), paidBy: [{ userId: 'alice', amount: 125_000 }], splitMethod: 'equal', splitBetween: [{ userId: 'alice', amount: 62_500 }, { userId: 'bob', amount: 62_500 }], receiptUrl: scan.receiptUrl, scanId: scan.id };
      assert.equal((await rpc('bob', 'expenses/createExpense', [expense, null])).status, 422, 'someone else’s scan');
      const saved = await rpc('alice', 'expenses/createExpense', [expense, null]);
      assert.equal(saved.status, 200);
      assert.equal(saved.data.scanId, scan.id);
      assert.equal(await read((db) => db.scanJobs[scan.id].expenseId), saved.data.id);
      assert.equal((await fetch(`${base}${scan.receiptUrl}`, { headers: { Authorization: 'Bearer bob' } })).status, 200, 'the taab can see it once it’s an expense');
    });

    await t.test('members can see how payments were simplified; others cannot', async () => {
      const explained = await rpc('bob', 'settlements/explainGroup', [trip.id]);
      assert.equal(explained.status, 200);
      assert.ok(explained.data.simplified.length <= explained.data.direct.length, 'never more payments than paying back directly');
      const settled = new Map(explained.data.positions.map((p: { userId: string; net: number }) => [p.userId, p.net]));
      for (const t of explained.data.simplified) {
        settled.set(t.fromUserId, (settled.get(t.fromUserId) ?? 0) + t.amount);
        settled.set(t.toUserId, (settled.get(t.toUserId) ?? 0) - t.amount);
      }
      assert.ok([...settled.values()].every((v) => v === 0), 'the plan settles everyone');
      assert.equal((await rpc('eve', 'settlements/explainGroup', [trip.id])).status, 403);
    });

    await t.test('the trip report is free for members and separates unconfirmed payments', async () => {
      const other = (await rpc('alice', 'groups/listGroups')).data.find((g: { group: { id: string } }) => g.group.id !== trip.id).group.id;
      assert.equal((await rpc('alice', 'reports/getGroupReport', [other])).status, 200, 'no pack needed');
      assert.equal((await rpc('eve', 'reports/getGroupReport', [trip.id])).status, 403);
      assert.equal((await rpc('bob', 'settlements/recordSettlement', [{ groupId: trip.id, fromUserId: 'bob', toUserId: 'alice', amount: 500, method: 'cash' }])).status, 200);
      const report = (await rpc('bob', 'reports/getGroupReport', [trip.id])).data;
      assert.equal(report.payments.waiting.length, 1);
      assert.equal(report.payments.confirmed.length, 0);
      assert.ok(report.expenses.some((e: { scanned: boolean }) => e.scanned));
      assert.equal(report.members.reduce((sum: number, m: { balance: number }) => sum + m.balance, 0), 0, 'balances net to zero');
    });
    await t.test('bank accounts: members see them, a taab can have its own, others cannot', async () => {
      const usual = { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Alice A' };
      const tripOnly = { bankName: 'Kuda', accountNumber: '2000000001', accountName: 'Alice A' };
      assert.equal((await rpc('alice', 'payouts/setDefault', [{ ...usual, accountNumber: '0123 456 789' }])).status, 422, 'the app sends digits only');
      assert.equal((await rpc('alice', 'payouts/setDefault', [{ ...usual, accountNumber: '12ab' }])).status, 422);
      assert.equal((await rpc('alice', 'payouts/setDefault', [usual])).status, 200);
      const seen = (await rpc('bob', 'payouts/getGroupAccounts', [trip.id])).data;
      assert.deepEqual(seen.alice, { ...usual, source: 'default' });
      assert.equal((await rpc('eve', 'payouts/getGroupAccounts', [trip.id])).status, 403, 'not in the taab, no bank details');
      assert.equal((await rpc('eve', 'payouts/setForGroup', [trip.id, tripOnly])).status, 403);

      assert.equal((await rpc('alice', 'payouts/setForGroup', [trip.id, tripOnly])).status, 200);
      assert.deepEqual((await rpc('bob', 'payouts/getGroupAccounts', [trip.id])).data.alice, { ...tripOnly, source: 'taab' });
      const other = (await rpc('alice', 'groups/listGroups')).data.find((g: { group: { id: string } }) => g.group.id !== trip.id).group.id;
      assert.deepEqual((await rpc('alice', 'payouts/getGroupAccounts', [other])).data.alice, { ...usual, source: 'default' }, 'other taabs keep the usual account');
      const suggestion = (await rpc('bob', 'settlements/getSuggestions', [trip.id])).data.find((s: { toUserId: string }) => s.toUserId === 'alice');
      assert.equal(suggestion?.payTo?.accountNumber, tripOnly.accountNumber, 'Settle up shows where to pay');
      const mine = (await rpc('alice', 'payouts/getMine')).data;
      assert.deepEqual(mine.default, usual);
      assert.deepEqual(mine.groups.find((g: { groupId: string }) => g.groupId === trip.id).account, tripOnly);

      assert.equal((await rpc('alice', 'payouts/setForGroup', [trip.id, null])).status, 200);
      assert.equal((await rpc('bob', 'payouts/getGroupAccounts', [trip.id])).data.alice.source, 'default', 'back to the usual account');
      assert.equal((await rpc('alice', 'payouts/setDefault', [null])).status, 200);
      assert.equal((await rpc('bob', 'payouts/getGroupAccounts', [trip.id])).data.alice, undefined);
    });

    await t.test('a test notification reaches registered devices only', async () => {
      assert.equal((await rpc('bob', 'notifications/sendTest')).data.devices, 0);
      assert.equal((await rpc('bob', 'notifications/sendTest')).status, 429, 'one test at a time');
      assert.equal((await rpc('alice', 'notifications/registerPushToken', ['ExpoPushToken[test_device]'])).status, 200);
      assert.equal((await rpc('alice', 'notifications/sendTest')).data.devices, 1);
      assert.ok(await read((db) => Object.values(db.pushOutbox).some((job) => job.userId === 'alice')), 'queued for push');
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    database.close();
    for (const suffix of ['', '-wal', '-shm']) rmSync(filename + suffix, { force: true });
    rmdirSync(directory);
  }
});

test('paystack helpers check signatures and find references', () => {
  const body = Buffer.from('{"event":"charge.success","data":{"reference":"pur_abc"}}');
  const signature = createHmac('sha512', 'sk_test').update(body).digest('hex');
  assert.equal(validPaystackSignature(body, signature, 'sk_test'), true);
  assert.equal(validPaystackSignature(body, signature, 'other_key'), false);
  assert.equal(validPaystackSignature(body, undefined, 'sk_test'), false);
  assert.equal(webhookReference(JSON.parse(body.toString())), 'pur_abc');
  assert.equal(webhookReference({ data: { transaction: { reference: 'pur_def' } } }), 'pur_def');
  assert.equal(webhookReference({ data: { reference: 'bad reference with spaces' } }), null);
});

test('pack settings: demo is refused in production and missing settings switch features off', () => {
  const store = { put: () => 'id', get: () => null, prune: () => undefined } as unknown as ReturnType<typeof createReceiptStore>;
  assert.throws(() => packsFromEnv({ NODE_ENV: 'production', DEMO_PACKS: '1' }, store), /not allowed/);
  const off = packsFromEnv({ NODE_ENV: 'production' }, store);
  assert.equal(off.runtime.checkout.mode, 'off');
  assert.equal(off.runtime.scanner, null);
  assert.deepEqual(off.runtime.allowances, { receipt_scan_pack: null, trip_pack: null });
  const partial = packsFromEnv({ NODE_ENV: 'production', RECEIPT_PACK_SCANS: '25', TRIP_PACK_SCANS: 'lots', PAYSTACK_SECRET_KEY: 'sk_live_x' }, store);
  assert.deepEqual(partial.runtime.allowances, { receipt_scan_pack: 25, trip_pack: null });
  assert.equal(partial.runtime.checkout.mode, 'off', 'no callback URL, no checkout');
  const live = packsFromEnv({ NODE_ENV: 'production', PAYSTACK_SECRET_KEY: 'sk_live_x', PAYSTACK_CALLBACK_URL: 'https://taab.expo.app/extras' }, store);
  assert.equal(live.runtime.checkout.mode, 'provider');
  assert.equal(live.paystackSecret, 'sk_live_x');
});
