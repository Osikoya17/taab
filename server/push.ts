import { read, write, type MockDatabase, type PushJob } from '../src/services/mock/db';

type Transport = typeof fetch;
const SEND = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';
type Ticket = { status?: string; id?: string; details?: { error?: string } };
type SentTicket = { id: string; token: string };

async function post(transport: Transport, url: string, payload: unknown): Promise<{ data?: unknown }> {
  const response = await transport(url, {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { 'Content-Type': 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Push service unavailable');
  return await response.json() as { data?: unknown };
}

/** Forgets a device only while it still belongs to that account; it may have been re-registered since. */
function forgetToken(db: MockDatabase, userId: string, token: string) {
  const tokens = db.pushTokens[userId];
  if (!token || !tokens?.includes(token)) return;
  const remaining = tokens.filter((t) => t !== token);
  if (remaining.length) db.pushTokens[userId] = remaining;
  else delete db.pushTokens[userId];
}

function retryLater(job: PushJob): PushJob | null {
  if (job.attempts >= 7) return null;
  return { ...job, attempts: job.attempts + 1, nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 60_000 * 2 ** job.attempts)).toISOString() };
}

/** Sends one notification to every device on the account, then waits for receipts. */
async function send(id: string, job: PushJob, transport: Transport) {
  const target = await read((db) => ({ tokens: db.pushTokens[job.userId] ?? [], notification: db.notifications[job.userId]?.find((n) => n.id === job.notificationId), preferences: db.notificationPreferences[job.userId] }));
  const notification = target.notification;
  if (!target.tokens.length || !notification || target.preferences?.[notification.category] === false) {
    await write((db) => { delete db.pushOutbox[id]; });
    return;
  }
  const message = {
    title: notification.title, body: notification.body, channelId: notification.category,
    data: { url: notification.expenseId ? `/expense/${notification.expenseId}` : notification.groupId ? `/group/${notification.groupId}` : '/notifications' },
  };
  // An array of messages gets an array of tickets back, in the same order.
  const response = await post(transport, SEND, target.tokens.map((to) => ({ to, ...message })));
  const tickets = Array.isArray(response.data) ? response.data as Ticket[] : [];
  if (tickets.length !== target.tokens.length) throw new Error('Unexpected push response');
  const sent: SentTicket[] = [];
  const unregistered: string[] = [];
  tickets.forEach((ticket, i) => {
    if (ticket.status === 'ok' && ticket.id) sent.push({ id: ticket.id, token: target.tokens[i] });
    else if (ticket.details?.error === 'DeviceNotRegistered') unregistered.push(target.tokens[i]);
  });
  if (!sent.length && !unregistered.length) throw new Error('Push delivery failed');
  await write((db) => {
    for (const token of unregistered) forgetToken(db, job.userId, token);
    if (!db.pushOutbox[id]) return;
    if (!sent.length) { delete db.pushOutbox[id]; return; }
    db.pushOutbox[id] = { userId: job.userId, notificationId: job.notificationId, attempts: 0, nextAttemptAt: new Date(Date.now() + 15 * 60_000).toISOString(), tickets: sent };
  });
}

/** Receipts reveal devices that were uninstalled; keeps waiting on ones not ready yet. */
async function checkReceipts(id: string, job: PushJob, pending: SentTicket[], transport: Transport) {
  const response = await post(transport, RECEIPTS, { ids: pending.map((t) => t.id) });
  const receipts = (response.data ?? {}) as Record<string, Ticket | undefined>;
  const waiting = pending.filter((t) => !receipts[t.id]);
  const unregistered = pending.filter((t) => receipts[t.id]?.details?.error === 'DeviceNotRegistered').map((t) => t.token);
  await write((db) => {
    for (const token of unregistered) forgetToken(db, job.userId, token);
    if (!db.pushOutbox[id]) return;
    const next = waiting.length ? retryLater({ ...job, tickets: waiting, ticketId: undefined, sentToken: undefined }) : null;
    if (next) db.pushOutbox[id] = next;
    else delete db.pushOutbox[id];
  });
}

/** Durable outbox: retry transient failures and remove invalid device tokens. */
export async function deliverPush(transport: Transport = fetch) {
  const jobs = await read((db) => Object.entries(db.pushOutbox).filter(([, job]) => Date.parse(job.nextAttemptAt) <= Date.now()).slice(0, 100));
  for (const [id, job] of jobs) {
    // Jobs written before multi-device support carry a single ticket.
    const pending = job.tickets ?? (job.ticketId ? [{ id: job.ticketId, token: job.sentToken ?? '' }] : null);
    try {
      if (pending) await checkReceipts(id, job, pending, transport);
      else await send(id, job, transport);
    } catch {
      await write((db) => {
        if (!db.pushOutbox[id]) return;
        const next = retryLater(job);
        if (next) db.pushOutbox[id] = next;
        else delete db.pushOutbox[id];
      });
    }
  }
}
