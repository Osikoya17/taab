import type { InstalledBankApp } from './bank-apps';

// The web can't open phone apps: the payer copies the number and opens their
// bank app themselves. See installed-apps.android.ts and installed-apps.ios.ts.

export async function findBankApps(): Promise<InstalledBankApp[]> {
  return [];
}

export async function openBankApp(_target: string): Promise<boolean> {
  return false;
}
