import { Linking } from 'react-native';

import { BANK_APPS, iosBankChoices, type InstalledBankApp } from './bank-apps';

// iOS won't tell an app what else is installed, so every bank is offered. Banks
// that publish a universal link open straight into their app; the rest open
// their App Store page, which shows "Open" when the app is installed.

const LOOKUP_URL = `https://itunes.apple.com/lookup?country=ng&id=${BANK_APPS.map((app) => app.ios.appStoreId).join(',')}`;

let icons: Promise<Record<string, string>> | null = null;

/** Current App Store icons (they change with app updates). Offline: plain icons. */
function fetchIcons(): Promise<Record<string, string>> {
  icons ??= (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(LOOKUP_URL, { signal: controller.signal });
      const body = (await response.json()) as { results?: { trackId: number; artworkUrl100?: string }[] };
      return Object.fromEntries((body.results ?? []).filter((r) => r.artworkUrl100).map((r) => [String(r.trackId), r.artworkUrl100!]));
    } catch {
      icons = null;
      return {};
    } finally {
      clearTimeout(timer);
    }
  })();
  return icons;
}

export async function findBankApps(): Promise<InstalledBankApp[]> {
  return iosBankChoices(BANK_APPS, await fetchIcons());
}

export async function openBankApp(target: string): Promise<boolean> {
  try {
    await Linking.openURL(target);
    return true;
  } catch {
    return false;
  }
}
