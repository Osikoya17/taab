import { resolve } from 'node:path';

import { createApi, processDeletions, processRecurring } from './api';
import { clerkServices } from './clerk';
import { openDatabase } from './storage';
import { deliverPush } from './push';

const secretKey = process.env.CLERK_SECRET_KEY;
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:8081').split(',').map((s) => s.trim()).filter(Boolean);
const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ?? allowedOrigins.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
if (!secretKey) throw new Error('Set CLERK_SECRET_KEY in .env.server.local before starting the API.');
if (authorizedParties.length === 0) throw new Error('Configure CLERK_AUTHORIZED_PARTIES.');
const database = openDatabase(resolve(process.env.DATABASE_PATH ?? '.data/taab.sqlite'));
const services = clerkServices(secretKey, authorizedParties);
const server = createApi({ ...services, allowedOrigins });
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1', () => {
  console.log(`Taab API listening on port ${process.env.PORT ?? 3001}`);
});

let processing = false;
const timer = setInterval(async () => {
  if (processing) return;
  processing = true;
  try {
    if (services.deleteIdentity) await processDeletions(services.deleteIdentity);
    await processRecurring(services.getSubscription);
    await deliverPush();
  }
  catch { console.error('Recurring processing failed; it will retry on the next run.'); }
  finally { processing = false; }
}, 60_000);
timer.unref();
function close() {
  clearInterval(timer);
  server.close(() => { database.close(); process.exit(0); });
}
process.once('SIGINT', close);
process.once('SIGTERM', close);
