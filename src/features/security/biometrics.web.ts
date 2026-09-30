import type { BiometricSupport } from './biometrics';

/** Browsers have no fingerprint prompt taab can use, so the app lock is phone-only. */
export async function getBiometricSupport(): Promise<BiometricSupport> {
  return { hardware: false, enrolled: false, label: 'biometrics' };
}

export async function authenticate(): Promise<boolean> {
  return false;
}
