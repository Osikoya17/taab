import { AsyncLocalStorage } from 'node:async_hooks';
import { createServer, type IncomingMessage } from 'node:http';
import { z } from 'zod';

import { localActivityService } from '../src/services/activity.service';
import { ServiceError, type ServiceErrorCode } from '../src/services/api/errors';
import { localExpensesService } from '../src/services/expenses.service';
import { localGroupsService } from '../src/services/groups.service';
import { localNotificationsService } from '../src/services/notifications.service';
import { expireStalePurchases, localPacksService, reconcileByReference } from '../src/services/packs.service';
import { localPayoutsService } from '../src/services/payouts.service';
import { localReportsService } from '../src/services/reports.service';
import { INTERRUPTED_AFTER_MS, localScansService, recoverInterruptedScans, scanInputSchema } from '../src/services/scans.service';
import { localRecurringService } from '../src/services/recurring.service';
import { localRemindersService } from '../src/services/reminders.service';
import { localSettlementsService, paymentsDueForReminder, remindPendingPayments } from '../src/services/settlements.service';
import { setSessionProvider, type SessionIdentity } from '../src/services/session';
import { localUsersService } from '../src/services/users.service';
import { read, write } from '../src/services/mock/db';
import { expenseInputSchema, groupInputSchema, idSchema, inviteSchema, payoutAccountSchema, profilePatchSchema, recurringInputSchema, repeatSchema, settlementSchema, setupSchema } from '../src/services/validation';
import { validPaystackSignature, webhookReference } from './payments/paystack';
import type { ReceiptStore } from './storage';

const session = new AsyncLocalStorage<SessionIdentity>();
setSessionProvider(() => session.getStore() ?? null);
type Operation = (args: unknown[]) => Promise<unknown>;
function operation<S extends z.ZodType<unknown[]>>(schema: S, handler: (...args: z.output<S>) => Promise<unknown>): Operation {
  return async (args) => handler(...schema.parse(args));
}
const none = z.tuple([]);
const id = z.tuple([idSchema]);
const preferences = z.object({ new_expense: z.boolean().optional(), payment_received: z.boolean().optional(), settlement: z.boolean().optional(), reminder: z.boolean().optional(), member_joined: z.boolean().optional(), recurring_expense: z.boolean().optional(), group_activity: z.boolean().optional() }).strict();

// Explicit allowlist: clients cannot access prototypes, database helpers, or demo billing.
const operations: Record<string, Operation> = {
  'users/getProfile': operation(none, localUsersService.getProfile),
  'users/updateProfile': operation(z.tuple([profilePatchSchema]), localUsersService.updateProfile),
  'users/completeSetup': operation(z.tuple([setupSchema]), localUsersService.completeSetup),
  'users/deleteAccountData': operation(none, localUsersService.deleteAccountData),
  'groups/listGroups': operation(none, localGroupsService.listGroups),
  'groups/getGroup': operation(id, localGroupsService.getGroup),
  'groups/createGroup': operation(z.tuple([groupInputSchema]), localGroupsService.createGroup),
  'groups/inviteMembers': operation(z.tuple([idSchema, z.array(inviteSchema).max(99)]), localGroupsService.inviteMembers),
  'groups/getInviteLink': operation(id, localGroupsService.getInviteLink),
  'groups/joinGroup': operation(id, localGroupsService.joinGroup),
  'groups/leaveGroup': operation(id, localGroupsService.leaveGroup),
  'groups/searchPeople': operation(z.tuple([z.string().max(100)]), localGroupsService.searchPeople),
  'expenses/listGroupExpenses': operation(id, localExpensesService.listGroupExpenses),
  'expenses/getExpense': operation(id, localExpensesService.getExpense),
  'expenses/createExpense': operation(z.tuple([expenseInputSchema, repeatSchema.nullish()]), (input, repeat) => localExpensesService.createExpense(input, repeat ?? undefined)),
  'expenses/updateExpense': operation(z.tuple([idSchema, expenseInputSchema]), localExpensesService.updateExpense),
  'expenses/deleteExpense': operation(id, localExpensesService.deleteExpense),
  'expenses/getHistory': operation(id, localExpensesService.getHistory),
  'settlements/getSuggestions': operation(z.tuple([idSchema.nullish()]), (groupId) => localSettlementsService.getSuggestions(groupId ?? undefined)),
  'settlements/listGroupSettlements': operation(id, localSettlementsService.listGroupSettlements),
  'settlements/recordSettlement': operation(z.tuple([settlementSchema]), localSettlementsService.recordSettlement),
  'settlements/listPending': operation(none, localSettlementsService.listPending),
  'settlements/respondToSettlement': operation(z.tuple([idSchema, z.enum(['confirm', 'decline'])]), localSettlementsService.respondToSettlement),
  'activity/listActivity': operation(z.tuple([z.object({ before: z.string().max(300).optional(), groupId: idSchema.optional() }).nullish()]), (filter) => localActivityService.listActivity(filter ?? undefined)),
  'recurring/list': operation(id, localRecurringService.list),
  'recurring/create': operation(z.tuple([recurringInputSchema]), localRecurringService.create),
  'recurring/remove': operation(id, localRecurringService.remove),
  'recurring/processDue': operation(none, localRecurringService.processDue),
  'recurring/confirmDue': operation(id, localRecurringService.confirmDue),
  'recurring/skipDue': operation(id, localRecurringService.skipDue),
  'notifications/list': operation(none, localNotificationsService.list),
  'notifications/markAllRead': operation(none, localNotificationsService.markAllRead),
  'notifications/getPreferences': operation(none, localNotificationsService.getPreferences),
  'notifications/updatePreferences': operation(z.tuple([preferences]), localNotificationsService.updatePreferences),
  'notifications/sendTest': operation(none, localNotificationsService.sendTest),
  'notifications/registerPushToken': operation(z.tuple([z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)]), localNotificationsService.registerPushToken),
  'reminders/getStatus': operation(z.tuple([idSchema, idSchema]), localRemindersService.getStatus),
  'reminders/sendReminder': operation(z.tuple([z.object({ groupId: idSchema, toUserId: idSchema, message: z.string().trim().min(1).max(500) })]), localRemindersService.sendReminder),
  'packs/getCatalog': operation(none, localPacksService.getCatalog),
  'packs/getBalances': operation(none, localPacksService.getBalances),
  'packs/getGroupPack': operation(id, localPacksService.getGroupPack),
  'packs/listPurchases': operation(none, localPacksService.listPurchases),
  'packs/startPurchase': operation(z.tuple([z.object({ productId: z.enum(['receipt_scan_pack', 'trip_pack']), groupId: idSchema.optional() }).strict()]), localPacksService.startPurchase),
  'packs/confirmPurchase': operation(id, localPacksService.confirmPurchase),
  // Refused by the service unless this server runs demo checkout (never in production).
  'packs/completeDemoPurchase': operation(z.tuple([idSchema, z.enum(['success', 'cancelled'])]), localPacksService.completeDemoPurchase),
  'scans/startScan': operation(z.tuple([scanInputSchema]), localScansService.startScan),
  'scans/getScan': operation(id, localScansService.getScan),
  'scans/listScans': operation(z.tuple([z.object({ batchId: z.string().max(100).optional() }).strict().nullish()]), (filter) => localScansService.listScans(filter ?? undefined)),
  'reports/getGroupReport': operation(id, localReportsService.getGroupReport),
  'payouts/getMine': operation(none, localPayoutsService.getMine),
  'payouts/setDefault': operation(z.tuple([payoutAccountSchema.nullable()]), localPayoutsService.setDefault),
  'payouts/setForGroup': operation(z.tuple([idSchema, payoutAccountSchema.nullable()]), localPayoutsService.setForGroup),
  'payouts/getGroupAccounts': operation(id, localPayoutsService.getGroupAccounts),
};
const statuses: Record<ServiceErrorCode, number> = { forbidden: 403, validation: 422, history_locked: 409, not_found: 404, limit_reached: 409, rate_limited: 429, network: 503, unavailable: 503, insufficient_credits: 402, already_owned: 409, unknown: 500 };

export type ApiOptions = {
  authenticate: (request: IncomingMessage) => Promise<SessionIdentity>;
  allowedOrigins: string[];
  deleteIdentity?: (userId: string) => Promise<void>;
  /** Stores receipt photos outside the ledger. Without it they stay inline. */
  receipts?: ReceiptStore;
  /** Behind exactly one reverse proxy: rate-limit by the address it reports. */
  trustProxy?: boolean;
  /** Paystack's secret key, used to check webhook signatures. */
  paystackSecret?: string;
};

const RECEIPT_PREFIX = '/receipts/';
const RECEIPT_PATH = /^\/receipts\/([0-9a-f-]{36})$/;

/** The client address used for rate limiting. */
function clientAddress(request: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    // The last entry is the one our own proxy appended; earlier ones are client-supplied.
    const forwarded = String(request.headers['x-forwarded-for'] ?? '').split(',').at(-1)?.trim();
    if (forwarded) return forwarded;
  }
  return request.socket.remoteAddress ?? 'unknown';
}

async function isGroupMember(groupId: string, userId: string) {
  return read((db) => db.groups.some((g) => g.id === groupId && g.members.some((m) => m.userId === userId)));
}

export function createApi(options: ApiOptions) {
  const limits = new Map<string, { count: number; until: number }>();
  return createServer(async (request, response) => {
    const send = (status: number, value: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(value ?? null));
    };
    try {
      const origin = request.headers.origin;
      if (origin && !options.allowedOrigins.includes(origin)) {
        console.warn(`Request rejected: origin ${origin} is not in ALLOWED_ORIGINS`);
        throw new ServiceError('forbidden');
      }
      if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
      if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.writeHead(204); response.end(); return;
      }
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (path === '/health' && request.method === 'GET') { send(200, { ok: true }); return; }
      if (path === '/webhooks/paystack' && request.method === 'POST') {
        // Paystack calls this, not a signed-in person, so it is checked by signature instead.
        if (!options.paystackSecret) throw new ServiceError('not_found');
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 100_000) throw new ServiceError('validation');
          chunks.push(Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks);
        if (!validPaystackSignature(raw, request.headers['x-paystack-signature'] as string | undefined, options.paystackSecret)) throw new ServiceError('forbidden');
        const reference = webhookReference(JSON.parse(raw.toString('utf8')));
        // The event only says which payment to look at; Paystack's verify API decides what happened.
        if (reference) await reconcileByReference(reference);
        send(200, { ok: true }); return;
      }
      // Bound memory and request work before contacting the identity provider.
      const now = Date.now();
      for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
      const ip = clientAddress(request, options.trustProxy ?? false);
      const rate = limits.get(ip) ?? { count: 0, until: now + 60_000 };
      if (++rate.count > 300) throw new ServiceError('rate_limited');
      limits.set(ip, rate);
      const identity = await options.authenticate(request);
      await session.run(identity, async () => {
        const receiptMatch = path.match(RECEIPT_PATH);
        if (receiptMatch) {
          if (request.method !== 'GET' || !options.receipts) throw new ServiceError('not_found');
          // Members of the group whose expense references the receipt may read it, and
          // the person who scanned it may read it while reviewing the draft.
          const allowed = await read((db) => db.expenses.some((e) => e.receiptUrl === path &&
            db.groups.some((g) => g.id === e.groupId && g.members.some((m) => m.userId === identity.userId))) ||
            Object.values(db.scanJobs).some((j) => j.receiptUrl === path && j.userId === identity.userId));
          const uri = allowed ? options.receipts.get(receiptMatch[1]) : null;
          if (!uri) throw new ServiceError('not_found');
          send(200, { uri }); return;
        }
        const key = path.replace(/^\/rpc\//, '');
        if (request.method !== 'POST' || !path.startsWith('/rpc/') || !Object.hasOwn(operations, key)) throw new ServiceError('not_found');
        if (!request.headers['content-type']?.startsWith('application/json')) throw new ServiceError('validation');
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 1_500_000) throw new ServiceError('validation');
          chunks.push(Buffer.from(chunk));
        }
        const body = z.object({ args: z.array(z.unknown()).max(3) }).strict().parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        if (key === 'expenses/createExpense' || key === 'expenses/updateExpense') {
          const index = key === 'expenses/createExpense' ? 0 : 1;
          const input = expenseInputSchema.parse(body.args[index]);
          const receipt = input.receiptUrl;
          if (receipt?.startsWith('data:')) {
            if (!validReceipt(receipt)) throw new ServiceError('validation');
            if (options.receipts) {
              // Check membership first so non-members can't fill the receipt store.
              if (!(await isGroupMember(input.groupId, identity.userId))) throw new ServiceError('forbidden');
              const stored = `${RECEIPT_PREFIX}${options.receipts.put(receipt)}`;
              body.args[index] = { ...(body.args[index] as Record<string, unknown>), receiptUrl: stored };
            }
          } else if (receipt) {
            // An edit may keep the stored receipt that expense already has; a new
            // expense may use the photo from your own finished scan.
            const allowed = key === 'expenses/updateExpense'
              ? await read((db) => db.expenses.find((e) => e.id === body.args[0])?.receiptUrl === receipt)
              : await read((db) => Object.values(db.scanJobs).some((j) => j.userId === identity.userId && j.status === 'drafted' && j.receiptUrl === receipt));
            if (!allowed) throw new ServiceError('validation');
          }
        }
        if (key === 'users/deleteAccountData' && options.deleteIdentity) {
          none.parse(body.args);
          // A durable job lets the worker finish cleanup if the process stops after identity deletion.
          await write((db) => { db.pendingDeletions[identity.userId] = identity; });
          await options.deleteIdentity(identity.userId);
        }
        send(200, await operations[key](body.args));
      });
    } catch (error) {
      const code = error instanceof ServiceError ? error.code : error instanceof z.ZodError || error instanceof SyntaxError ? 'validation' : 'unknown';
      if (code === 'unknown') console.error('API request failed', error instanceof Error ? error.name : 'UnknownError');
      if (!response.headersSent) send(statuses[code], { code });
      else response.end();
    }
  });
}

function validReceipt(uri: string): boolean {
  const match = uri.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[2].length > 1_400_000) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (match[1] === 'jpeg') return bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (match[1] === 'png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

/** Moves receipts saved before the receipt table existed out of the ledger. */
export async function migrateInlineReceipts(receipts: ReceiptStore): Promise<number> {
  return write((db) => {
    let moved = 0;
    for (const expense of db.expenses) {
      if (!expense.receiptUrl?.startsWith('data:')) continue;
      expense.receiptUrl = `${RECEIPT_PREFIX}${receipts.put(expense.receiptUrl)}`;
      moved++;
    }
    return moved;
  });
}

/** Scanned photos nobody turned into an expense are kept this long for review, then deleted. */
const UNUSED_SCAN_PHOTO_MS = 30 * 24 * 60 * 60 * 1000;

/** Deletes stored receipts no expense or recent scan uses, after a day's grace. */
export async function pruneReceipts(receipts: ReceiptStore, now = Date.now()) {
  const referenced = await read((db) => [
    ...db.expenses.map((e) => e.receiptUrl),
    ...Object.values(db.scanJobs).filter((j) => now - Date.parse(j.updatedAt) < UNUSED_SCAN_PHOTO_MS).map((j) => j.receiptUrl),
  ].flatMap((url) => url?.startsWith(RECEIPT_PREFIX) ? [url.slice(RECEIPT_PREFIX.length)] : []));
  receipts.prune(new Set(referenced), 24 * 60 * 60 * 1000);
}

/**
 * Returns credits held by scans that were cut off (a restart mid-scan) and
 * marks day-old unfinished checkouts as expired. Runs on startup and every minute.
 */
export async function processPackMaintenance(now = Date.now()) {
  const stuck = await read((db) => Object.values(db.scanJobs).some((j) => j.status === 'reserved' && now - Date.parse(j.updatedAt) >= INTERRUPTED_AFTER_MS));
  const recovered = stuck ? await write((db) => recoverInterruptedScans(db, now)) : 0;
  const expired = await expireStalePurchases(now);
  return { recovered, expired };
}

/** Reminds receivers about payments waiting more than a day. Only writes when one is due. */
export async function processPaymentReminders() {
  if (!(await read((db) => paymentsDueForReminder(db).length))) return 0;
  return write((db) => remindPendingPayments(db));
}

/** Scheduled by the single server process, independent of whether the app is open. */
export async function processRecurring() {
  const profiles = await read((db) => {
    const owners = new Set(db.recurring.filter((r) => Date.parse(r.nextDate) <= Date.now()).map((r) => r.createdBy));
    return Object.values(db.profiles).filter((p) => owners.has(p.id) && !db.pendingDeletions[p.id]);
  });
  let failed = 0;
  for (const profile of profiles) {
    try { await session.run({ userId: profile.id, name: profile.name, email: profile.email, createdAt: profile.createdAt }, async () => {
      await localRecurringService.processDue();
    }); } catch { failed++; }
  }
  if (failed) throw new Error(`Recurring processing failed for ${failed} account(s)`);
}

export async function processDeletions(deleteIdentity: NonNullable<ApiOptions['deleteIdentity']>) {
  const jobs = await read((db) => Object.values(db.pendingDeletions));
  let failed = 0;
  for (const identity of jobs) {
    try { await session.run(identity, async () => {
      await deleteIdentity(identity.userId);
      await localUsersService.deleteAccountData();
    }); } catch { failed++; }
  }
  if (failed) throw new Error(`Deletion processing failed for ${failed} account(s)`);
}
