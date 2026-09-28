import { resolve } from 'node:path';

import { createApi, migrateInlineReceipts, processDeletions, processRecurring, pruneReceipts } from './api';
import { clerkServices } from './clerk';
import { createReceiptStore, openDatabase } from './storage';
import { deliverPush } from './push';
import { startWorker } from './worker';

const secretKey = process.env.CLERK_SECRET_KEY;
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081').split(',').map((s) => s.trim()).filter(Boolean);
const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ?? allowedOrigins.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
if (!secretKey) throw new Error('Set CLERK_SECRET_KEY in .env.server.local before starting the API.');
if (authorizedParties.length === 0) throw new Error('Configure CLERK_AUTHORIZED_PARTIES.');
const database = openDatabase(resolve(process.env.DATABASE_PATH ?? '.data/taab.sqlite'));
const receipts = createReceiptStore(database);
// Ledger writes are serialised, so this is safe alongside the first requests.
migrateInlineReceipts(receipts)
  .then((moved) => { if (moved) console.log(`Moved ${moved} receipt photo(s) out of the ledger.`); })
  .catch(() => console.error('Moving receipt photos out of the ledger failed; it will retry on the next start.'));
const services = clerkServices(secretKey, authorizedParties);
const server = createApi({ ...services, allowedOrigins, receipts, trustProxy: process.env.TRUST_PROXY === '1' });
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1', () => {
  console.log(`Taab API listening on port ${process.env.PORT ?? 3001}`);
});

const worker = startWorker([
  { name: 'Account deletion', run: () => processDeletions(services.deleteIdentity) },
  { name: 'Recurring expenses', run: () => processRecurring(services.getSubscription) },
  { name: 'Push delivery', run: () => deliverPush() },
  { name: 'Receipt cleanup', run: () => pruneReceipts(receipts) },
]);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await Promise.all([
    worker.stop(),
    new Promise<void>((resolve) => server.close(() => resolve())),
  ]);
  database.close();
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
