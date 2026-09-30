import { create } from 'zustand';

import { usePreferences } from '@/store/preferences.store';

import { getPushPermission } from './push';
import { shouldAskForNotifications, type NotificationPromptReason } from './prompt-rules';

type PromptState = {
  reason: NotificationPromptReason | null;
  show: (reason: NotificationPromptReason) => void;
  hide: () => void;
};

/** Which explanation sheet is open, if any. Not persisted. */
export const useNotificationPrompt = create<PromptState>((set) => ({
  reason: null,
  show: (reason) => set({ reason }),
  hide: () => set({ reason: null }),
}));

/**
 * Explains notifications before the phone's own permission prompt appears.
 * Only asks when the phone hasn't been asked yet, and not again for a week
 * after “Not now”. A phone where push can't work (web, Expo Go) is never asked.
 */
export async function askForNotifications(reason: NotificationPromptReason) {
  if (useNotificationPrompt.getState().reason) return;
  if (!shouldAskForNotifications(usePreferences.getState().notificationPromptedAt)) return;
  const permission = await getPushPermission().catch(() => 'unsupported');
  if (permission !== 'undetermined') return;
  useNotificationPrompt.getState().show(reason);
}
