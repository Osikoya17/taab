/**
 * Auth contract used by screens. Screens never import Clerk directly — they
 * talk to this interface, so the provider can change without UI rewrites.
 */
export type AuthUser = {
  id: string;
  email: string;
  firstName: string | null;
  fullName: string | null;
  imageUrl?: string;
  createdAt: string;
};

export type AuthResult =
  | { status: 'complete' }
  | { status: 'needs_verification'; email: string }
  | { status: 'error'; message: string; field?: 'email' | 'password' | 'code' | 'name' };

export type OAuthProvider = 'google' | 'apple';

export type AuthActions = {
  signInWithPassword(email: string, password: string): Promise<AuthResult>;
  /** Completes a sign-in that needed an emailed code (new device / second factor). */
  verifySignInCode(code: string): Promise<AuthResult>;
  signUp(input: { name: string; email: string; password: string }): Promise<AuthResult>;
  verifySignUpCode(code: string): Promise<AuthResult>;
  resendCode(flow: 'sign-in' | 'sign-up'): Promise<AuthResult>;
  startPasswordReset(email: string): Promise<AuthResult>;
  completePasswordReset(code: string, password: string): Promise<AuthResult>;
  signInWithOAuth(provider: OAuthProvider): Promise<AuthResult>;
  changePassword(currentPassword: string, newPassword: string): Promise<AuthResult>;
  updateAvatar(input: { uri: string; base64?: string | null; mimeType?: string | null }): Promise<string | undefined>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<AuthResult>;
  /** Session token for the backend. Never log it. */
  getToken(): Promise<string | null>;
  /** Clerk entitlement check: `has({ plan })` / `has({ feature })`. */
  hasEntitlement(check: { plan?: string; feature?: string }): boolean;
  /** Refresh session claims after a purchase so entitlement checks update. */
  refreshSession(): Promise<void>;
};

export type AuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  mode: 'clerk' | 'demo';
};
