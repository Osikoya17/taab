import { z } from 'zod';

import { connectService } from './api/service';
import { DEFAULT_CURRENCY } from '@/constants/currencies';
import { OPERATIONAL_LIMITS } from '@/features/billing/products';
import type { CreditAccountKey, ScanJob } from '@/features/billing/types';
import { isAcceptedImage, toDraft } from '@/features/scans/draft';
import type { CurrencyCode } from '@/types/models';

import { ServiceError } from './api/errors';
import { createId, read, write, type MockDatabase } from './mock/db';
import { requireGroup } from './mock/ledger';
import { consumeScan, groupAccount, personalAccount, releaseScan, reserveScan } from './packs/credits';
import { packRuntime, ScanFailure } from './packs/runtime';
import { requireSession } from './session';
import { idSchema } from './validation';

export type ScanInput = {
  /** Made by the app for each photo. Sending it again never charges twice. */
  key: string;
  /** A JPEG, PNG or WebP data URI. */
  image: string;
  /** Whose credits pay: yours, or a taab's trip & event pack. */
  account: 'personal' | 'group';
  /** The taab the expense is for. Required when the taab's pack pays. */
  groupId?: string;
  /** Groups the photos of one bulk upload (trip & event pack only). */
  batchId?: string;
};

/** What the app sees of a scan. */
export type ScanView = Omit<ScanJob, 'key' | 'userId'> & { payer: 'personal' | 'group' };

export const scanInputSchema = z.object({
  key: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
  image: z.string().max(1_500_000),
  account: z.enum(['personal', 'group']),
  groupId: idSchema.optional(),
  batchId: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/).optional(),
}).strict();

/** A reservation older than this belongs to a scan that was cut off (a restart, a crash). */
export const INTERRUPTED_AFTER_MS = 10 * 60 * 1000;

function toView(job: ScanJob): ScanView {
  const { key: _key, userId: _userId, ...rest } = job;
  return { ...rest, payer: job.account.startsWith('group:') ? 'group' : 'personal' };
}

/** Checks who may spend which credits. Only current members spend a taab's shared scans. */
function payingAccount(db: MockDatabase, userId: string, input: ScanInput): CreditAccountKey {
  if (input.groupId) requireGroup(db, input.groupId, userId);
  if (input.account === 'personal') {
    if (input.batchId) throw new ServiceError('forbidden'); // Bulk scanning comes with the trip & event pack.
    return personalAccount(userId);
  }
  if (!input.groupId) throw new ServiceError('validation');
  if (!db.groupPacks[input.groupId]) throw new ServiceError('forbidden');
  return groupAccount(input.groupId);
}

function hintCurrency(db: MockDatabase, userId: string, groupId?: string): CurrencyCode {
  return (groupId && db.groups.find((g) => g.id === groupId)?.currency) || db.profiles[userId]?.defaultCurrency || DEFAULT_CURRENCY;
}

/** Server-only: returns credits held by scans that never finished. */
export function recoverInterruptedScans(db: MockDatabase, now = Date.now()): number {
  let recovered = 0;
  for (const job of Object.values(db.scanJobs)) {
    if (job.status !== 'reserved' || now - Date.parse(job.updatedAt) < INTERRUPTED_AFTER_MS) continue;
    job.status = 'failed';
    job.error = 'interrupted';
    job.updatedAt = new Date(now).toISOString();
    releaseScan(db, job.account);
    recovered++;
  }
  return recovered;
}

export const localScansService = {
  /**
   * Reads a receipt into a draft for a person to check. Credits are held
   * first, spent only once the draft is saved, and returned on failure.
   */
  async startScan(input: ScanInput): Promise<ScanView> {
    const parsed = scanInputSchema.safeParse(input);
    if (!parsed.success || !isAcceptedImage(parsed.data.image)) throw new ServiceError('validation');
    const me = requireSession();
    const { scanner, storeReceipt } = packRuntime();
    if (!scanner) throw new ServiceError('unavailable');
    const data = parsed.data;

    const started = await write((db) => {
      const existing = Object.values(db.scanJobs).find((j) => j.userId === me.userId && j.key === data.key);
      // Finished, or still running: return it as it is. Nothing is charged again.
      if (existing && existing.status !== 'failed') return { job: existing, run: false };
      if (data.batchId) {
        const inBatch = Object.values(db.scanJobs).filter((j) => j.userId === me.userId && j.batchId === data.batchId && j.key !== data.key).length;
        if (inBatch >= OPERATIONAL_LIMITS.bulkScanBatch) throw new ServiceError('limit_reached');
      }
      const account = payingAccount(db, me.userId, data);
      reserveScan(db, account);
      const now = new Date().toISOString();
      const job: ScanJob = existing
        ? { ...existing, account, groupId: data.groupId, status: 'reserved', error: undefined, attempts: existing.attempts + 1, updatedAt: now }
        : {
          id: createId('scan'), userId: me.userId, key: data.key, account, groupId: data.groupId, batchId: data.batchId,
          status: 'reserved', receiptUrl: storeReceipt(data.image), attempts: 1, createdAt: now, updatedAt: now,
        };
      db.scanJobs[job.id] = job;
      return { job, run: true, currency: hintCurrency(db, me.userId, data.groupId) };
    });
    if (!started.run) return toView(started.job);

    const attempt = started.job.attempts;
    let outcome: { ok: true; result: Awaited<ReturnType<typeof scanner.extract>> } | { ok: false; reason: 'unreadable' | 'scanner_error' };
    try {
      outcome = { ok: true, result: await scanner.extract({ dataUri: data.image }, { currency: started.currency ?? DEFAULT_CURRENCY }) };
    } catch (error) {
      outcome = { ok: false, reason: error instanceof ScanFailure ? error.reason : 'scanner_error' };
    }

    return toView(await write((db) => {
      const job = db.scanJobs[started.job.id];
      // Recovery already returned the credits for this attempt; don't touch them again.
      if (job.status !== 'reserved' || job.attempts !== attempt) return job;
      job.updatedAt = new Date().toISOString();
      if (outcome.ok) {
        job.status = 'drafted';
        job.draft = toDraft(outcome.result);
        consumeScan(db, job.account, job.id);
      } else {
        job.status = 'failed';
        job.error = outcome.reason;
        releaseScan(db, job.account);
      }
      return job;
    }));
  },

  async getScan(scanId: string): Promise<ScanView> {
    const me = requireSession();
    return read((db) => {
      const job = db.scanJobs[scanId];
      if (!job || job.userId !== me.userId) throw new ServiceError('not_found');
      return toView(job);
    });
  },

  /** Your recent scans, or one bulk upload's, newest first. */
  async listScans(filter: { batchId?: string } = {}): Promise<ScanView[]> {
    const me = requireSession();
    return read((db) => Object.values(db.scanJobs)
      .filter((j) => j.userId === me.userId && (!filter.batchId || j.batchId === filter.batchId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map(toView));
  },
};

export const scansService = connectService('scans', localScansService);
