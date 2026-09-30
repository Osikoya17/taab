import type { InstalledBankApp } from './bank-apps';

// iOS and web can't see which apps are installed. The payer copies the number
// and opens their bank app themselves. Android: installed-apps.android.ts.

export async function findInstalledBankApps(): Promise<InstalledBankApp[]> {
  return [];
}

export function openBankApp(_packageName: string): boolean {
  return false;
}
