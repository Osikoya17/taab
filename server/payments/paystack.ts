import { createHmac, timingSafeEqual } from 'node:crypto';

import type { PaymentProvider, VerifiedPayment } from '../../src/services/packs/runtime';

const API = 'https://api.paystack.co';

type PaystackResponse<T> = { status: boolean; message?: string; data?: T };

/**
 * Hosted Paystack checkout for web purchases. The secret key stays on the
 * server; the app only ever sees the checkout link. A payment counts only
 * when Paystack's own verify endpoint says so.
 */
export function paystackProvider(options: { secretKey: string; callbackUrl: string; fetch?: typeof fetch }): PaymentProvider {
  const call = options.fetch ?? fetch;
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await call(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${options.secretKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => null)) as PaystackResponse<T> | null;
    if (!response.ok || !body?.status || !body.data) throw new Error(`Paystack request failed with status ${response.status}`);
    return body.data;
  }

  return {
    name: 'paystack',
    async createCheckout({ reference, amount, currency, email }) {
      const data = await request<{ authorization_url: string }>('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({ reference, amount, currency, email, callback_url: `${options.callbackUrl}?purchase=${encodeURIComponent(reference)}` }),
      });
      return { checkoutUrl: data.authorization_url };
    },
    async verify(reference) {
      const data = await request<{ status: string; amount: number; currency: string }>(`/transaction/verify/${encodeURIComponent(reference)}`);
      return { status: mapStatus(data.status), amount: data.amount, currency: data.currency };
    },
  };
}

function mapStatus(status: string): VerifiedPayment['status'] {
  switch (status) {
    case 'success': return 'success';
    case 'reversed': return 'reversed';
    case 'failed': return 'failed';
    case 'abandoned': return 'abandoned';
    default: return 'pending'; // ongoing, pending, processing, queued
  }
}

/** Paystack signs each webhook body with HMAC-SHA512 using the secret key. */
export function validPaystackSignature(rawBody: Buffer, signature: string | undefined, secretKey: string): boolean {
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = createHmac('sha512', secretKey).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

/** The payment reference a webhook event is about, wherever the event type puts it. */
export function webhookReference(event: unknown): string | null {
  const data = (event as { data?: Record<string, unknown> } | null)?.data;
  if (!data) return null;
  const candidates = [data.reference, data.transaction_reference, (data.transaction as { reference?: unknown } | undefined)?.reference];
  const found = candidates.find((c): c is string => typeof c === 'string' && /^[A-Za-z0-9_.=-]{1,200}$/.test(c));
  return found ?? null;
}
