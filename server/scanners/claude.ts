import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';

import { SUPPORTED_CURRENCIES } from '../../src/constants/currencies';
import { ScanFailure, type ReceiptScanner } from '../../src/services/packs/runtime';

const ReceiptSchema = z.object({
  is_receipt: z.boolean().describe('False if the image is not a receipt, bill, POS slip or transfer screenshot.'),
  merchant: z.string().nullable(),
  date: z.string().nullable().describe('YYYY-MM-DD, or null if not shown.'),
  currency: z.enum(['NGN', 'USD', 'GBP', 'EUR']).nullable(),
  total: z.number().nullable().describe('The amount actually paid, in major units (e.g. 12900.50), or null.'),
  items: z.array(z.object({ description: z.string(), amount: z.number() })),
  charges: z.array(z.object({ label: z.string(), amount: z.number() })).describe('Tax, VAT, service charge, delivery, tips.'),
  total_confidence: z.enum(['high', 'low']),
  date_confidence: z.enum(['high', 'low']),
});

const INSTRUCTIONS = `Read this receipt photo for a bill-splitting app. Report only what is printed; never guess a missing number.
Use major currency units (naira, dollars) with at most 2 decimals. Put line items in "items" and taxes, service charges and delivery in "charges".
Mark total_confidence "low" if the total is smudged, cut off, handwritten, or you had to choose between several totals.
If the image is not a receipt, set is_receipt to false and leave the rest empty.`;

const toMinor = (major: number) => Math.round(major * 100);

/**
 * Reads receipts with Claude. The API key stays on the server and receipt
 * contents are never logged. The result is only ever a draft for a person
 * to check.
 */
export function claudeScanner(options: { apiKey: string }): ReceiptScanner {
  const client = new Anthropic({ apiKey: options.apiKey, timeout: 60_000, maxRetries: 1 });
  return {
    name: 'claude',
    async extract({ dataUri }, hint) {
      const match = dataUri.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
      if (!match) throw new ScanFailure('unreadable');
      let response;
      try {
        response = await client.beta.messages.parse({
          model: 'claude-opus-5-5',
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: 'medium', format: betaZodOutputFormat(ReceiptSchema) },
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/webp', data: match[2] } },
              { type: 'text', text: `${INSTRUCTIONS}\nThe group usually spends in ${hint.currency}.` },
            ],
          }],
        });
      } catch (error) {
        // Log the kind of failure only: never the receipt or the response.
        console.error('Receipt scan request failed', error instanceof Anthropic.APIError ? `status ${error.status}` : 'network');
        throw new ScanFailure('scanner_error');
      }
      if (response.stop_reason === 'refusal') throw new ScanFailure('unreadable');
      const parsed = response.parsed_output;
      if (!parsed || !parsed.is_receipt) throw new ScanFailure('unreadable');
      const currency = parsed.currency && SUPPORTED_CURRENCIES.includes(parsed.currency) ? parsed.currency : undefined;
      return {
        merchant: parsed.merchant?.trim().slice(0, 80) || undefined,
        date: parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : undefined,
        currency,
        total: parsed.total !== null && parsed.total > 0 ? toMinor(parsed.total) : undefined,
        items: parsed.items.slice(0, 60).map((i) => ({ description: i.description.slice(0, 80), amount: toMinor(i.amount) })),
        charges: parsed.charges.slice(0, 20).map((c) => ({ label: c.label.slice(0, 60), amount: toMinor(c.amount) })),
        confidence: { total: parsed.total_confidence, date: parsed.date_confidence },
        source: 'claude',
      };
    },
  };
}
