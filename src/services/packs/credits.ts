import { SCAN_COST } from '@/features/billing/products';
import type { CreditAccount, CreditAccountKey, CreditEntry } from '@/features/billing/types';

import { ServiceError } from '../api/errors';
import { createId, type MockDatabase } from '../mock/db';

/**
 * Credit accounting. Every function runs inside a single `write`, and writes
 * are serialised, so a reservation and its balance check happen atomically:
 * concurrent scans can't spend the same credit twice.
 */

export const personalAccount = (userId: string): CreditAccountKey => `user:${userId}`;
export const groupAccount = (groupId: string): CreditAccountKey => `group:${groupId}`;

export function accountOf(db: MockDatabase, key: CreditAccountKey): CreditAccount {
  return (db.creditAccounts[key] ??= { available: 0, reserved: 0 });
}

function record(db: MockDatabase, entry: Omit<CreditEntry, 'id' | 'createdAt'>) {
  db.creditLedger.push({ id: createId('cr'), createdAt: new Date().toISOString(), ...entry });
}

export function grantCredits(db: MockDatabase, key: CreditAccountKey, amount: number, purchaseId: string) {
  accountOf(db, key).available += amount;
  record(db, { account: key, delta: amount, reason: 'purchase', purchaseId });
}

/** Holds one scan's credits. Throws `insufficient_credits` rather than going negative. */
export function reserveScan(db: MockDatabase, key: CreditAccountKey) {
  const account = accountOf(db, key);
  if (account.available < SCAN_COST) throw new ServiceError('insufficient_credits');
  account.available -= SCAN_COST;
  account.reserved += SCAN_COST;
}

/** The scan produced a usable draft: the held credits are spent. */
export function consumeScan(db: MockDatabase, key: CreditAccountKey, scanId: string) {
  const account = accountOf(db, key);
  account.reserved = Math.max(0, account.reserved - SCAN_COST);
  record(db, { account: key, delta: -SCAN_COST, reason: 'scan', scanId });
}

/** The scan failed or was interrupted: the held credits go back. */
export function releaseScan(db: MockDatabase, key: CreditAccountKey) {
  const account = accountOf(db, key);
  const held = Math.min(SCAN_COST, account.reserved);
  account.reserved -= held;
  account.available += held;
}

/** After a refund, removes whatever is still unused of what the purchase granted. */
export function revokeUnused(db: MockDatabase, key: CreditAccountKey, amount: number, purchaseId: string): number {
  const account = accountOf(db, key);
  const removed = Math.min(amount, account.available);
  if (removed > 0) {
    account.available -= removed;
    record(db, { account: key, delta: -removed, reason: 'refund', purchaseId });
  }
  return removed;
}
