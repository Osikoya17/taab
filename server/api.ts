import { AsyncLocalStorage } from 'node:async_hooks';
import { createServer, type IncomingMessage } from 'node:http';
import { z } from 'zod';

import { localActivityService } from '../src/services/activity.service';
import { ServiceError, type ServiceErrorCode } from '../src/services/api/errors';
import { localExpensesService } from '../src/services/expenses.service';
import { localGroupsService } from '../src/services/groups.service';
import { localNotificationsService } from '../src/services/notifications.service';
import { localRecurringService } from '../src/services/recurring.service';
import { localRemindersService } from '../src/services/reminders.service';
import { localSettlementsService } from '../src/services/settlements.service';
import { setSessionProvider, type SessionIdentity } from '../src/services/session';
import { localUsersService } from '../src/services/users.service';
import { read, write } from '../src/services/mock/db';
import { FREE_SUBSCRIPTION, type SubscriptionState } from '../src/features/billing/types';
import { expenseInputSchema, groupInputSchema, idSchema, inviteSchema, profilePatchSchema, recurringInputSchema, repeatSchema, settlementSchema, setupSchema } from '../src/services/validation';
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
  'settlements/getSuggestions': operation(z.tuple([idSchema.nullish()]), (groupId) => localSettlementsService.getSuggestions(groupId ?? undefined)),
  'settlements/listGroupSettlements': operation(id, localSettlementsService.listGroupSettlements),
  'settlements/recordSettlement': operation(z.tuple([settlementSchema]), localSettlementsService.recordSettlement),
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
  'notifications/registerPushToken': operation(z.tuple([z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)]), localNotificationsService.registerPushToken),
  'reminders/getStatus': operation(z.tuple([idSchema, idSchema]), localRemindersService.getStatus),
  'reminders/sendReminder': operation(z.tuple([z.object({ groupId: idSchema, toUserId: idSchema, message: z.string().trim().min(1).max(500) })]), localRemindersService.sendReminder),
};
const statuses: Record<ServiceErrorCode, number> = { forbidden: 403, validation: 422, history_locked: 409, not_found: 404, limit_reached: 409, rate_limited: 429, network: 503, unavailable: 503, unknown: 500 };

export type ApiOptions = {
  authenticate: (request: IncomingMessage) => Promise<SessionIdentity>;
  allowedOrigins: string[];
  getSubscription?: (userId: string) => Promise<SubscriptionState>;
  deleteIdentity?: (userId: string) => Promise<void>;
  /** Stores receipt photos outside the ledger. Without it they stay inline. */
  receipts?: ReceiptStore;
  /** Behind exactly one reverse proxy: rate-limit by the address it reports. */
  trustProxy?: boolean;
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
      // Bound memory and request work before contacting the identity provider.
      const now = Date.now();
      for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
      const ip = clientAddress(request, options.trustProxy ?? false);
      const rate = limits.get(ip) ?? { count: 0, until: now + 60_000 };
      if (++rate.count > 300) throw new ServiceError('rate_limited');
      limits.set(ip, rate);
      const identity = await options.authenticate(request);
      await session.run(identity, async () => {
        if (path.startsWith('/billing/')) {
          if ((path === '/billing/subscription' && request.method === 'GET') || (path === '/billing/restore' && request.method === 'POST')) {
            const subscription = await options.getSubscription?.(identity.userId) ?? FREE_SUBSCRIPTION;
            await write((db) => { db.subscriptions[identity.userId] = subscription; });
            send(200, subscription); return;
          }
          throw new ServiceError('unavailable');
        }
        const receiptMatch = path.match(RECEIPT_PATH);
        if (receiptMatch) {
          if (request.method !== 'GET' || !options.receipts) throw new ServiceError('not_found');
          // Only members of the group whose expense references the receipt may read it.
          const allowed = await read((db) => db.expenses.some((e) => e.receiptUrl === path &&
            db.groups.some((g) => g.id === e.groupId && g.members.some((m) => m.userId === identity.userId))));
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
            // Only an edit may keep the stored receipt that expense already has.
            const current = key === 'expenses/updateExpense' ? await read((db) => db.expenses.find((e) => e.id === body.args[0])?.receiptUrl) : undefined;
            if (receipt !== current) throw new ServiceError('validation');
          }
        }
        if (key === 'users/deleteAccountData' && options.deleteIdentity) {
          none.parse(body.args);
          // A durable job lets the worker finish cleanup if the process stops after identity deletion.
          await write((db) => { db.pendingDeletions[identity.userId] = identity; });
          await options.deleteIdentity(identity.userId);
        }
        if (options.getSubscription && ['groups/createGroup', 'groups/joinGroup', 'expenses/createExpense', 'expenses/updateExpense', 'recurring/create', 'recurring/processDue', 'recurring/confirmDue', 'recurring/skipDue', 'activity/listActivity'].includes(key)) {
          const subscription = await options.getSubscription(identity.userId);
          await write((db) => { db.subscriptions[identity.userId] = subscription; });
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

/** Deletes stored receipts whose expense was deleted or edited, after a day's grace. */
export async function pruneReceipts(receipts: ReceiptStore) {
  const referenced = await read((db) => db.expenses.flatMap((e) => e.receiptUrl?.startsWith(RECEIPT_PREFIX) ? [e.receiptUrl.slice(RECEIPT_PREFIX.length)] : []));
  receipts.prune(new Set(referenced), 24 * 60 * 60 * 1000);
}

/** Scheduled by the single server process, independent of whether the app is open. */
export async function processRecurring(getSubscription?: ApiOptions['getSubscription']) {
  const profiles = await read((db) => {
    const owners = new Set(db.recurring.filter((r) => Date.parse(r.nextDate) <= Date.now()).map((r) => r.createdBy));
    return Object.values(db.profiles).filter((p) => owners.has(p.id) && !db.pendingDeletions[p.id]);
  });
  let failed = 0;
  for (const profile of profiles) {
    try { await session.run({ userId: profile.id, name: profile.name, email: profile.email, createdAt: profile.createdAt }, async () => {
      if (getSubscription) {
        const subscription = await getSubscription(profile.id);
        await write((db) => { db.subscriptions[profile.id] = subscription; });
      }
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
