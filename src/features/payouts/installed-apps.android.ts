import * as IntentLauncher from 'expo-intent-launcher';

import { BANK_APPS, type InstalledBankApp } from './bank-apps';

// Android only reveals the apps taab lists in its manifest <queries>
// (plugins/with-bank-app-queries.js), so the list and the manifest stay in step.

let lookup: Promise<InstalledBankApp[]> | null = null;

async function findApp(app: (typeof BANK_APPS)[number]): Promise<InstalledBankApp | null> {
  for (const packageName of app.android) {
    try {
      // Throws when the package isn't installed.
      const icon = await IntentLauncher.getApplicationIconAsync(packageName);
      return { ...app, target: packageName, icon: icon || undefined, via: 'app' };
    } catch {
      // Try the bank's other app, if it has one.
    }
  }
  return null;
}

export function findBankApps(): Promise<InstalledBankApp[]> {
  lookup ??= Promise.all(BANK_APPS.map(findApp))
    .then((apps) => apps.filter((app): app is InstalledBankApp => app !== null))
    .catch(() => {
      lookup = null;
      return [];
    });
  return lookup;
}

export async function openBankApp(packageName: string): Promise<boolean> {
  try {
    IntentLauncher.openApplication(packageName);
    return true;
  } catch {
    // Uninstalled since we looked: look again next time.
    lookup = null;
    return false;
  }
}
