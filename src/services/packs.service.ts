import { z } from 'zod';

import { connectService } from './api/service';
import { PRODUCTS, PRODUCT_IDS, type Product, type ProductId } from '@/features/billing/products';
import type { CreditAccount, Purchase, PurchaseStatus } from '@/features/billing/types';

import { ServiceError } from './api/errors';
import { createId, read, write, type MockDatabase } from './mock/db';
import { groupsForUser, requireGroup } from './mock/ledger';
import { accountOf, grantCredits, groupAccount, personalAccount, revokeUnused } from './packs/credits';
import { packRuntime, type VerifiedPayment } from './packs/runtime';
import { requireSession } from './session';
import { idSchema } from './validation';

export type CatalogItem = Product & {
  /** Scans the pack adds, or null while the allowance isn't configured. */
  credits: number | null;
  purchasable: boolean;
  /** Why it can't be bought right now. */
  reason?: 'allowance_not_set' | 'checkout_off';
};

export type Catalog = {
  products: CatalogItem[];
  /** `demo` completes without money; `web` opens a hosted checkout; `off` sells nothing. */
  checkout: 'demo' | 'web' | 'off';
  scanning: 'demo' | 'live' | 'off';
};

export type GroupPackStatus = {
  groupId: string;
  owned: boolean;
  ownedAt?: string;
  credits: CreditAccount;
  /** You started checkout for this taab and it isn't finished. */
  myPendingPurchaseId?: string;
  /** Someone else in the taab is part-way through buying it. */
  someoneElseBuying: boolean;
};

export type Balances = {
  personal: CreditAccount;
  /** Taabs you're in that own a trip & event pack. */
  groups: { groupId: string; groupName: string; credits: CreditAccount }[];
};

/** What the app sees of a purchase: no provider internals. */
export type PurchaseView = Pick<Purchase, 'id' | 'productId' | 'groupId' | 'amount' | 'currency' | 'credits' | 'status' | 'createdAt' | 'paidAt' | 'refundedAt'> & {
  demo: boolean;
};

export type StartPurchaseResult = { purchase: PurchaseView; checkoutUrl: string | null; demo: boolean };

const startSchema = z.object({ productId: z.enum(PRODUCT_IDS as [ProductId, ...ProductId[]]), groupId: idSchema.optional() }).strict();

/** A trip pack checkout someone started recently still blocks a second one for the same taab. */
const PENDING_HOLD_MS = 30 * 60 * 1000;
/** Unfinished checkouts are marked expired after a day. A late confirmed payment still counts. */
const PENDING_EXPIRY_MS = 24 * 60 * 60 * 1000;

function view(p: Purchase): PurchaseView {
  return {
    id: p.id, productId: p.productId, groupId: p.groupId, amount: p.amount, currency: p.currency, credits: p.credits,
    status: p.status, createdAt: p.createdAt, paidAt: p.paidAt, refundedAt: p.refundedAt, demo: p.provider === 'demo',
  };
}

function checkoutKind(): Catalog['checkout'] {
  const { checkout } = packRuntime();
  return checkout.mode === 'demo' ? 'demo' : checkout.mode === 'provider' ? 'web' : 'off';
}

function recentGroupPending(db: MockDatabase, groupId: string, now = Date.now()) {
  return Object.values(db.purchases).find((p) => p.productId === 'trip_pack' && p.groupId === groupId && p.status === 'pending' && now - Date.parse(p.createdAt) < PENDING_HOLD_MS);
}

/**
 * Applies what the payment provider said. Safe to call any number of times
 * with the same answer: credits are granted once, when a purchase first
 * becomes `paid`, and removed once, when it first becomes `refunded`.
 */
export function applyVerifiedPayment(db: MockDatabase, purchaseId: string, verified: VerifiedPayment): Purchase {
  const purchase = db.purchases[purchaseId];
  if (!purchase) throw new ServiceError('not_found');
  const now = new Date().toISOString();
  const account = purchase.groupId ? groupAccount(purchase.groupId) : personalAccount(purchase.userId);

  if (verified.status === 'success') {
    // Already granted (a duplicate webhook or a second confirm), or refunded since.
    if (purchase.status === 'paid' || purchase.status === 'refunded') return purchase;
    if (purchase.flag === 'amount_mismatch') return purchase;
    if (verified.amount !== purchase.amount || verified.currency.toUpperCase() !== purchase.currency) {
      purchase.status = 'failed';
      purchase.flag = 'amount_mismatch';
      purchase.updatedAt = now;
      return purchase;
    }
    purchase.status = 'paid';
    purchase.paidAt = now;
    purchase.updatedAt = now;
    grantCredits(db, account, purchase.credits, purchase.id);
    if (purchase.groupId) {
      // Two members can race through checkout; the second payment still adds its scans, flagged for a refund decision.
      if (db.groupPacks[purchase.groupId]) purchase.flag = 'duplicate_group_pack';
      else db.groupPacks[purchase.groupId] = { groupId: purchase.groupId, purchaseId: purchase.id, buyerId: purchase.userId, ownedAt: now };
    }
    return purchase;
  }

  if (verified.status === 'reversed') {
    if (purchase.status !== 'paid') return purchase;
    purchase.status = 'refunded';
    purchase.refundedAt = now;
    purchase.updatedAt = now;
    revokeUnused(db, account, purchase.credits, purchase.id);
    // The taab's records stay; only the pack's extras go with the refund.
    if (purchase.groupId && db.groupPacks[purchase.groupId]?.purchaseId === purchase.id) delete db.groupPacks[purchase.groupId];
    return purchase;
  }

  if ((verified.status === 'failed' || verified.status === 'abandoned') && (purchase.status === 'pending' || purchase.status === 'expired')) {
    purchase.status = verified.status === 'failed' ? 'failed' : 'cancelled';
    purchase.updatedAt = now;
  }
  return purchase;
}

/** Asks the provider about a payment. Demo purchases answer from what the tester chose. */
async function verifyPayment(purchase: Purchase): Promise<VerifiedPayment> {
  if (purchase.provider === 'demo') {
    const status: VerifiedPayment['status'] = purchase.demoOutcome === 'success' ? 'success' : purchase.demoOutcome === 'cancelled' ? 'abandoned' : 'pending';
    return { status, amount: purchase.amount, currency: purchase.currency };
  }
  const { checkout } = packRuntime();
  if (checkout.mode !== 'provider' || checkout.provider.name !== purchase.provider) throw new ServiceError('unavailable');
  return checkout.provider.verify(purchase.reference);
}

/** Server-only: a provider webhook named this reference. The payload itself is never trusted. */
export async function reconcileByReference(reference: string): Promise<Purchase | null> {
  const purchase = await read((db) => Object.values(db.purchases).find((p) => p.reference === reference) ?? null);
  if (!purchase || purchase.provider === 'demo') return null;
  const verified = await verifyPayment(purchase);
  return write((db) => applyVerifiedPayment(db, purchase.id, verified));
}

/** Server-only: marks day-old unfinished checkouts as expired. */
export async function expireStalePurchases(now = Date.now()) {
  const due = await read((db) => Object.values(db.purchases).some((p) => p.status === 'pending' && now - Date.parse(p.createdAt) >= PENDING_EXPIRY_MS));
  if (!due) return 0;
  return write((db) => {
    let expired = 0;
    for (const p of Object.values(db.purchases)) {
      if (p.status !== 'pending' || now - Date.parse(p.createdAt) < PENDING_EXPIRY_MS) continue;
      p.status = 'expired';
      p.updatedAt = new Date(now).toISOString();
      expired++;
    }
    return expired;
  });
}

export const localPacksService = {
  async getCatalog(): Promise<Catalog> {
    requireSession();
    const { allowances, checkout, scanner } = packRuntime();
    return {
      products: PRODUCT_IDS.map((id) => {
        const credits = allowances[id];
        const reason = !credits ? 'allowance_not_set' as const : checkout.mode === 'off' ? 'checkout_off' as const : undefined;
        return { ...PRODUCTS[id], credits, purchasable: !reason, reason };
      }),
      checkout: checkoutKind(),
      scanning: !scanner ? 'off' : scanner.name === 'demo' ? 'demo' : 'live',
    };
  },

  async getBalances(): Promise<Balances> {
    const me = requireSession();
    return read((db) => ({
      personal: { ...accountOf(db, personalAccount(me.userId)) },
      groups: groupsForUser(db, me.userId)
        .filter((g) => db.groupPacks[g.id])
        .map((g) => ({ groupId: g.id, groupName: g.name, credits: { ...(db.creditAccounts[groupAccount(g.id)] ?? { available: 0, reserved: 0 }) } })),
    }));
  },

  async getGroupPack(groupId: string): Promise<GroupPackStatus> {
    const me = requireSession();
    return read((db) => {
      requireGroup(db, groupId, me.userId);
      const pack = db.groupPacks[groupId];
      const pending = recentGroupPending(db, groupId);
      return {
        groupId,
        owned: !!pack,
        ownedAt: pack?.ownedAt,
        credits: { ...(db.creditAccounts[groupAccount(groupId)] ?? { available: 0, reserved: 0 }) },
        myPendingPurchaseId: pending?.userId === me.userId ? pending.id : undefined,
        someoneElseBuying: !!pending && pending.userId !== me.userId,
      };
    });
  },

  async listPurchases(): Promise<PurchaseView[]> {
    const me = requireSession();
    return read((db) => Object.values(db.purchases).filter((p) => p.userId === me.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(view));
  },

  /**
   * Starts checkout. Nothing is granted here: credits arrive only after the
   * server verifies the payment with the provider.
   */
  async startPurchase(input: { productId: ProductId; groupId?: string }): Promise<StartPurchaseResult> {
    const parsed = startSchema.safeParse(input);
    if (!parsed.success) throw new ServiceError('validation');
    const { productId, groupId } = parsed.data;
    const me = requireSession();
    const { allowances, checkout } = packRuntime();
    const product = PRODUCTS[productId];
    const credits = allowances[productId];
    if (!credits || checkout.mode === 'off') throw new ServiceError('unavailable');
    if ((product.kind === 'group') !== !!groupId) throw new ServiceError('validation');

    const created = await write((db) => {
      if (groupId) {
        requireGroup(db, groupId, me.userId);
        if (db.groupPacks[groupId]) throw new ServiceError('already_owned');
        const pending = recentGroupPending(db, groupId);
        // Your own unfinished checkout is reused; someone else's blocks a second payment.
        if (pending?.userId === me.userId) return { purchase: pending, reused: true };
        if (pending) throw new ServiceError('already_owned');
      }
      const now = new Date().toISOString();
      const id = createId('pur');
      const purchase: Purchase = {
        id, userId: me.userId, productId, groupId, amount: product.price.amount, currency: product.price.currency, credits,
        provider: checkout.mode === 'demo' ? 'demo' : checkout.provider.name, reference: id,
        status: 'pending', createdAt: now, updatedAt: now,
      };
      db.purchases[id] = purchase;
      return { purchase, reused: false };
    });

    const demo = created.purchase.provider === 'demo';
    if (demo || created.reused) return { purchase: view(created.purchase), checkoutUrl: created.purchase.checkoutUrl ?? null, demo };
    if (checkout.mode !== 'provider') throw new ServiceError('unavailable');
    try {
      const { checkoutUrl } = await checkout.provider.createCheckout({ reference: created.purchase.reference, amount: created.purchase.amount, currency: created.purchase.currency, email: me.email });
      const saved = await write((db) => {
        const p = db.purchases[created.purchase.id];
        p.checkoutUrl = checkoutUrl;
        p.updatedAt = new Date().toISOString();
        return p;
      });
      return { purchase: view(saved), checkoutUrl, demo: false };
    } catch {
      await write((db) => {
        const p = db.purchases[created.purchase.id];
        if (p.status === 'pending') { p.status = 'failed'; p.updatedAt = new Date().toISOString(); }
      });
      throw new ServiceError('unavailable');
    }
  },

  /**
   * Called after checkout returns. The server asks the provider itself; the
   * app coming back from checkout proves nothing on its own.
   */
  async confirmPurchase(purchaseId: string): Promise<PurchaseView> {
    const me = requireSession();
    const purchase = await read((db) => db.purchases[purchaseId]);
    if (!purchase) throw new ServiceError('not_found');
    if (purchase.userId !== me.userId) throw new ServiceError('forbidden');
    const final: PurchaseStatus[] = ['paid', 'refunded'];
    if (final.includes(purchase.status)) return view(purchase);
    const verified = await verifyPayment(purchase);
    return view(await write((db) => applyVerifiedPayment(db, purchaseId, verified)));
  },

  /** Demo checkout only. Refused whenever real checkout (or none) is configured. */
  async completeDemoPurchase(purchaseId: string, outcome: 'success' | 'cancelled'): Promise<PurchaseView> {
    const me = requireSession();
    if (packRuntime().checkout.mode !== 'demo') throw new ServiceError('forbidden');
    await write((db) => {
      const p = db.purchases[purchaseId];
      if (!p) throw new ServiceError('not_found');
      if (p.userId !== me.userId || p.provider !== 'demo') throw new ServiceError('forbidden');
      if (p.status === 'pending') p.demoOutcome = outcome;
    });
    return localPacksService.confirmPurchase(purchaseId);
  },
};

export const packsService = connectService('packs', localPacksService);
