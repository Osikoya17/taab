/** Coming back within this long (answering a text, copying an account number) doesn't re-lock. */
export const LOCK_AFTER_MS = 30_000;

/** Whether returning to the app should ask for a fingerprint again. */
export function shouldLockOnReturn(backgroundedAt: number | null, now: number): boolean {
  return backgroundedAt !== null && now - backgroundedAt >= LOCK_AFTER_MS;
}
