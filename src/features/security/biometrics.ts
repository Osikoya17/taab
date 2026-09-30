import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type BiometricSupport = {
  /** The phone has a fingerprint reader or face unlock. */
  hardware: boolean;
  /** At least one fingerprint or face is set up in the phone's settings. */
  enrolled: boolean;
  /** What to call it on this phone: "fingerprint", "Face ID", "face unlock". */
  label: string;
};

export async function getBiometricSupport(): Promise<BiometricSupport> {
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const label = face && !finger ? (Platform.OS === 'ios' ? 'Face ID' : 'face unlock') : finger ? 'fingerprint' : 'biometrics';
  return { hardware, enrolled, label };
}

/**
 * Shows the phone's own fingerprint or face prompt. After a few failed tries
 * the phone offers its passcode, so nobody gets locked out of their own app.
 */
export async function authenticate(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
    return result.success;
  } catch {
    return false;
  }
}
