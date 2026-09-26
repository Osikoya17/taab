/**
 * Client-safe configuration. Everything here is inlined into the JS bundle, so
 * only publishable values belong in EXPO_PUBLIC_* variables. Secret keys
 * (Clerk secret key, billing/webhook secrets) live on the backend only.
 *
 * Note: Expo only inlines `process.env.EXPO_PUBLIC_*` when accessed directly,
 * so do not destructure process.env.
 */
export const env = {
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  inviteBaseUrl: process.env.EXPO_PUBLIC_INVITE_BASE_URL ?? 'taab://join',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'hello@taab.app',
};

/**
 * Without a Clerk key the app runs against a local demo account so the
 * product can be explored end to end. Production builds must set the key.
 */
export const isDemoAuth = env.clerkPublishableKey.length === 0;
