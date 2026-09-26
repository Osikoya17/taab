import type { ReactNode } from 'react';

import { isDemoAuth } from '@/lib/env';
import { setTokenProvider } from '@/services/api/client';
import { setSessionIdentity } from '@/services/session';

import { useAuthActions, useAuthSession } from './auth-context';
import { ClerkAuthProvider } from './clerk-auth-provider';
import { DemoAuthProvider } from './demo-auth-provider';

/**
 * Publishes the signed-in identity to the service layer. Assignment is
 * idempotent, so doing it during render guarantees services see the session
 * before any child query runs.
 */
function SessionSync({ children }: { children: ReactNode }) {
  const { user } = useAuthSession();
  const actions = useAuthActions();

  setSessionIdentity(
    user
      ? {
          userId: user.id,
          email: user.email,
          name: user.fullName ?? user.firstName ?? user.email.split('@')[0],
          avatarUrl: user.imageUrl,
          createdAt: user.createdAt,
        }
      : null,
  );
  setTokenProvider(actions.getToken);

  return children;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const Provider = isDemoAuth ? DemoAuthProvider : ClerkAuthProvider;
  return (
    <Provider>
      <SessionSync>{children}</SessionSync>
    </Provider>
  );
}
