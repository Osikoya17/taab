import type { AuthResult } from './types';

type ClerkLikeError = {
  code?: string;
  longMessage?: string;
  errors?: { code?: string; meta?: { paramName?: string } }[];
};

/**
 * Maps Clerk error codes to short, human copy. Technical messages are never
 * shown directly — unknown codes fall back to a friendly default.
 */
const MESSAGES: Record<string, { message: string; field?: 'email' | 'password' | 'code' | 'name' }> = {
  form_identifier_not_found: { message: 'We couldn’t find an account with that email.', field: 'email' },
  form_password_incorrect: { message: 'That password doesn’t look right.', field: 'password' },
  form_identifier_exists: { message: 'That email already has a taab account. Try signing in.', field: 'email' },
  form_password_pwned: { message: 'That password has appeared in a data breach. Choose another.', field: 'password' },
  form_password_length_too_short: { message: 'Use at least 8 characters.', field: 'password' },
  form_password_validation_failed: { message: 'That password doesn’t look right.', field: 'password' },
  form_param_format_invalid: { message: 'Check that email address.', field: 'email' },
  form_code_incorrect: { message: 'That code isn’t right. Check your email and try again.', field: 'code' },
  verification_expired: { message: 'That code has expired. Send a new one.', field: 'code' },
  verification_failed: { message: 'Too many attempts. Send a new code.', field: 'code' },
  too_many_requests: { message: 'Too many attempts. Wait a moment and try again.' },
  session_exists: { message: 'You’re already signed in.' },
  network_error: { message: 'You seem to be offline. Check your connection.' },
};

export function toAuthError(error: unknown, fallback = 'Something went wrong. Please try again.'): AuthResult {
  const e = (error ?? {}) as ClerkLikeError;
  const code = e.errors?.[0]?.code ?? e.code;
  const known = code ? MESSAGES[code] : undefined;
  if (known) return { status: 'error', ...known };
  return { status: 'error', message: fallback };
}
