import { read, write } from '../src/services/mock/db';

type Transport = typeof fetch;
const SEND = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';
type Ticket = { status?: string; id?: string; details?: { error?: string } };

/** Durable outbox: retry transient failures and remove invalid device tokens. */
export async function deliverPush(transport: Transport = fetch) {
  const jobs = await read((db) => Object.entries(db.pushOutbox).filter(([, job]) => Date.parse(job.nextAttemptAt) <= Date.now()).slice(0, 100));
  for (const [id, job] of jobs) {
    const target = await read((db) => ({ token: db.pushTokens[job.userId], notification: db.notifications[job.userId]?.find((n) => n.id === job.notificationId), preferences: db.notificationPreferences[job.userId] }));
    if (!target.token || !target.notification || target.preferences?.[target.notification.category] === false) {
      await write((db) => { delete db.pushOutbox[id]; }); continue;
    }
    try {
      const notification = target.notification;
      const response = await transport(job.ticketId ? RECEIPTS : SEND, {
        method: 'POST', signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
        body: JSON.stringify(job.ticketId ? { ids: [job.ticketId] } : {
          to: target.token, title: notification.title, body: notification.body, channelId: notification.category,
          data: { url: notification.expenseId ? `/expense/${notification.expenseId}` : notification.groupId ? `/group/${notification.groupId}` : '/notifications' },
        }),
      });
      if (!response.ok) throw new Error('Push service unavailable');
      const body = await response.json() as { data?: Ticket | Record<string, Ticket> };
      const ticket = job.ticketId ? (body.data as Record<string, Ticket> | undefined)?.[job.ticketId] : body.data as Ticket | undefined;
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        await write((db) => { if (db.pushTokens[job.userId] === target.token) delete db.pushTokens[job.userId]; delete db.pushOutbox[id]; });
      } else if (ticket?.status === 'ok' && job.ticketId) {
        await write((db) => { delete db.pushOutbox[id]; });
      } else if (ticket?.status === 'ok' && ticket.id) {
        await write((db) => { if (db.pushOutbox[id]) db.pushOutbox[id] = { ...job, ticketId: ticket.id, attempts: 0, nextAttemptAt: new Date(Date.now() + 15 * 60_000).toISOString() }; });
      } else throw new Error('Push receipt pending or delivery failed');
    } catch {
      await write((db) => {
        if (!db.pushOutbox[id]) return;
        if (job.attempts >= 7) { delete db.pushOutbox[id]; return; }
        db.pushOutbox[id] = { ...job, attempts: job.attempts + 1, nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 60_000 * 2 ** job.attempts)).toISOString() };
      });
    }
  }
}
