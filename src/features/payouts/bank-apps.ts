import list from './bank-apps.json';

/**
 * A banking or wallet app taab can open so the payer can transfer. Android
 * package names are checked against Google Play; iOS App Store IDs against
 * Apple's lookup. `ios.link` is a universal link from the bank's own
 * apple-app-site-association file, so it opens the app directly.
 */
export type BankApp = { id: string; name: string; bank: string; android: string[]; ios: { appStoreId: string; link?: string } };

/**
 * An app the payer can pick. `target` is the Android package name or the iOS
 * link to open. `via: 'store'` means iOS opens its App Store page, where an
 * installed app shows “Open”.
 */
export type InstalledBankApp = BankApp & { target: string; icon?: string; via?: 'app' | 'store' };

export type RankedBankApp = InstalledBankApp & { tag?: 'yours' | 'theirs' };

export const BANK_APPS: BankApp[] = list;

/** Opens the App Store app on the bank app's page, without a Safari hop. */
export function appStoreUrl(appStoreId: string) {
  return `itms-apps://apps.apple.com/app/id${appStoreId}`;
}

/** iOS choices: the bank's universal link when it has one, otherwise its App Store page. */
export function iosBankChoices(apps: BankApp[], icons: Record<string, string>): InstalledBankApp[] {
  return apps.map((app) => ({
    ...app,
    target: app.ios.link ?? appStoreUrl(app.ios.appStoreId),
    via: app.ios.link ? 'app' : 'store',
    icon: icons[app.ios.appStoreId],
  }));
}

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
