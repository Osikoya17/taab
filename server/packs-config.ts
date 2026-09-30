import { DEMO_ALLOWANCES, parseAllowance, type ScanAllowances } from '../src/features/billing/products';
import { demoScanner } from '../src/services/packs/demo-scanner';
import type { PackRuntime } from '../src/services/packs/runtime';
import { paystackProvider } from './payments/paystack';
import { claudeScanner } from './scanners/claude';
import type { ReceiptStore } from './storage';

export type PacksConfig = { runtime: PackRuntime; paystackSecret?: string; summary: string };

/**
 * Reads pack settings from the environment. Anything missing leaves that
 * part switched off, never half-on:
 *   RECEIPT_PACK_SCANS, TRIP_PACK_SCANS  scans per pack (whole numbers 1–1000)
 *   PAYSTACK_SECRET_KEY, PAYSTACK_CALLBACK_URL  real web checkout
 *   ANTHROPIC_API_KEY  real receipt scanning
 *   DEMO_PACKS=1  simulated checkout and sample scans, refused when NODE_ENV=production
 */
export function packsFromEnv(env: NodeJS.ProcessEnv, receipts: ReceiptStore): PacksConfig {
  const production = env.NODE_ENV === 'production';
  const demo = env.DEMO_PACKS === '1';
  if (demo && production) throw new Error('DEMO_PACKS=1 is not allowed when NODE_ENV=production: demo purchases grant credits without payment.');

  const configured: ScanAllowances = { receipt_scan_pack: parseAllowance(env.RECEIPT_PACK_SCANS), trip_pack: parseAllowance(env.TRIP_PACK_SCANS) };
  const allowances: ScanAllowances = demo
    ? { receipt_scan_pack: configured.receipt_scan_pack ?? DEMO_ALLOWANCES.receipt_scan_pack, trip_pack: configured.trip_pack ?? DEMO_ALLOWANCES.trip_pack }
    : configured;

  const secret = env.PAYSTACK_SECRET_KEY?.trim();
  const callbackUrl = env.PAYSTACK_CALLBACK_URL?.trim();
  const checkout: PackRuntime['checkout'] = demo
    ? { mode: 'demo' }
    : secret && callbackUrl ? { mode: 'provider', provider: paystackProvider({ secretKey: secret, callbackUrl }) } : { mode: 'off' };

  const anthropicKey = env.ANTHROPIC_API_KEY?.trim();
  const scanner = anthropicKey ? claudeScanner({ apiKey: anthropicKey }) : demo ? demoScanner : null;

  const runtime: PackRuntime = {
    allowances,
    checkout,
    scanner,
    storeReceipt: (dataUri) => `/receipts/${receipts.put(dataUri)}`,
  };
  const summary = `Packs: checkout ${checkout.mode === 'provider' ? 'paystack' : checkout.mode}, scanning ${scanner?.name ?? 'off'}, allowances receipt=${allowances.receipt_scan_pack ?? 'unset'} trip=${allowances.trip_pack ?? 'unset'}`;
  return { runtime, paystackSecret: checkout.mode === 'provider' ? secret : undefined, summary };
}
