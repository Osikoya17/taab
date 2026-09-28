import { posthog } from '@/lib/posthog';

export const posthogLog = {
  info(message: string) {
    try { posthog?.logger.info(message); } catch { /* Logging cannot block the app. */ }
  },
};
