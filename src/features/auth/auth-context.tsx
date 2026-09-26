import { createContext, use } from 'react';

import type { AuthActions, AuthState } from './types';

export type AuthContextValue = AuthState & { actions: AuthActions };

export const AuthContext = createContext<AuthContextValue | null>(null);

function useAuthContext(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuthSession must be used inside <AuthProvider>');
  return value;
}

export function useAuthSession(): AuthState {
  const { isLoaded, isSignedIn, user, mode } = useAuthContext();
  return { isLoaded, isSignedIn, user, mode };
}

export function useAuthActions(): AuthActions {
  return useAuthContext().actions;
}
