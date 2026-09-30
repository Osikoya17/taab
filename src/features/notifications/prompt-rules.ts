/** Where the ask comes from, so the sheet can say why it matters right now. */
export type NotificationPromptReason = 'welcome' | 'expense' | 'payment';

/** After “Not now”, wait this long before asking again. */
export const ASK_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldAskForNotifications(promptedAt: string | null, now = Date.now()): boolean {
  return !promptedAt || now - Date.parse(promptedAt) >= ASK_AGAIN_AFTER_MS;
}
