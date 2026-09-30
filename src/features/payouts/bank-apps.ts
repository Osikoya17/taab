import list from './bank-apps.json';

/** A banking or wallet app taab can open so the payer can transfer. Package names are checked against Google Play. */
export type BankApp = { id: string; name: string; bank: string; android: string[] };

export type InstalledBankApp = BankApp & { packageName: string; icon?: string };

export type RankedBankApp = InstalledBankApp & { tag?: 'yours' | 'theirs' };

export const BANK_APPS: BankApp[] = list;

/** "Zenith Bank", "zenith" and "ZENITH BANK PLC" all match. */
function bankKey(name: string) {
  return name.toLowerCase().replace(/\b(bank|plc|mfb|microfinance)\b/g, '').replace(/[^a-z0-9]/g, '');
}

export function sameBank(a: string | undefined, b: string | undefined) {
  return !!a && !!b && bankKey(a) === bankKey(b);
}

/**
 * The payer's own bank first (they most likely pay from it), then the
 * receiver's bank (same-bank transfers are often instant), then the rest.
 */
export function rankBankApps(installed: InstalledBankApp[], banks: { payer?: string; payee?: string }): RankedBankApp[] {
  const tagged: RankedBankApp[] = installed.map((app) => ({
    ...app,
    tag: sameBank(app.bank, banks.payer) ? 'yours' : sameBank(app.bank, banks.payee) ? 'theirs' : undefined,
  }));
  const order = { yours: 0, theirs: 1 } as const;
  return tagged
    .map((app, index) => ({ app, index }))
    .sort((a, b) => (a.app.tag ? order[a.app.tag] : 2) - (b.app.tag ? order[b.app.tag] : 2) || a.index - b.index)
    .map(({ app }) => app);
}
