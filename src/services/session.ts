import { ServiceError } from './api/errors';

/**
 * The signed-in identity as seen by the service layer. A real backend derives
 * this from the verified session token; the mock backend reads it from here.
 * Set by the auth provider whenever the session changes.
 */
export type SessionIdentity = {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
};

let current: SessionIdentity | null = null;
let provider: (() => SessionIdentity | null) | undefined;

/** The backend supplies a request-local identity with AsyncLocalStorage. */
export function setSessionProvider(next: () => SessionIdentity | null) {
  provider = next;
}

export function setSessionIdentity(identity: SessionIdentity | null) {
  current = identity;
}

export function getSessionIdentity(): SessionIdentity | null {
  return provider ? provider() : current;
}

export function requireSession(): SessionIdentity {
  const identity = getSessionIdentity();
  if (!identity) throw new ServiceError('forbidden', 'No active session');
  return identity;
}
