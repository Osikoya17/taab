import * as SecureStore from 'expo-secure-store';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { AuthContext } from './auth-context';
import type { AuthActions, AuthResult, AuthUser } from './types';

/**
 * Local stand-in for Clerk, used only when no publishable key is configured.
 * It lets the whole product be explored offline. Any 6-digit code verifies.
 * Session data is kept in SecureStore like a real session would be.
 */
const SESSION_KEY = 'taab.demo-session';
const OK: AuthResult = { status: 'complete' };

export const DEMO_ACCOUNT = { name: 'Ranmi', email: 'ranmi@taab.app' };

const storage = {
  async get(): Promise<AuthUser | null> {
    try {
      const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(SESSION_KEY) : await SecureStore.getItemAsync(SESSION_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  },
  async set(user: AuthUser | null) {
    const value = user ? JSON.stringify(user) : null;
    if (Platform.OS === 'web') {
      if (value) globalThis.localStorage?.setItem(SESSION_KEY, value);
      else globalThis.localStorage?.removeItem(SESSION_KEY);
      return;
    }
    if (value) await SecureStore.setItemAsync(SESSION_KEY, value);
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  },
};

/** Stable id per email so signing back in restores the same demo data. */
function idForEmail(email: string) {
  let hash = 0;
  for (const char of email.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `user_demo_${hash.toString(36)}`;
}

function makeUser(name: string, email: string): AuthUser {
  const first = name.trim().split(/\s+/)[0] || null;
  return {
    id: idForEmail(email),
    email: email.trim().toLowerCase(),
    firstName: first,
    fullName: name.trim() || null,
    createdAt: new Date().toISOString(),
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setLoaded] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pending, setPending] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    storage.get().then((stored) => {
      setUser(stored);
      setLoaded(true);
    });
  }, []);

  async function activate(next: AuthUser) {
    await storage.set(next);
    setUser(next);
  }

  function validCode(code: string): AuthResult | null {
    return /^\d{6}$/.test(code) ? null : { status: 'error', message: 'Enter the 6-digit code.', field: 'code' };
  }

  const actions: AuthActions = {
    async signInWithPassword(email, password) {
      await wait(500);
      if (password.length < 8) return { status: 'error', message: 'That password doesn’t look right.', field: 'password' };
      const isDemo = email.trim().toLowerCase() === DEMO_ACCOUNT.email;
      await activate(makeUser(isDemo ? DEMO_ACCOUNT.name : email.split('@')[0], email));
      return OK;
    },
    async verifySignInCode(code) {
      return validCode(code) ?? OK;
    },
    async signUp({ name, email }) {
      await wait(500);
      setPending({ name, email });
      return { status: 'needs_verification', email };
    },
    async verifySignUpCode(code) {
      await wait(400);
      const invalid = validCode(code);
      if (invalid) return invalid;
      if (!pending) return { status: 'error', message: 'Start again from sign up.' };
      await activate(makeUser(pending.name, pending.email));
      setPending(null);
      return OK;
    },
    async resendCode() {
      await wait(300);
      return OK;
    },
    async startPasswordReset(email) {
      await wait(400);
      return { status: 'needs_verification', email };
    },
    async completePasswordReset(code) {
      await wait(400);
      return validCode(code) ?? OK;
    },
    async signInWithOAuth() {
      await wait(600);
      await activate(makeUser(DEMO_ACCOUNT.name, DEMO_ACCOUNT.email));
      return OK;
    },
    async changePassword(_current, next) {
      await wait(400);
      return next.length >= 8 ? OK : { status: 'error', message: 'Use at least 8 characters.', field: 'password' };
    },
    async updateAvatar({ uri }) {
      if (!user) return undefined;
      await activate({ ...user, imageUrl: uri });
      return uri;
    },
    async signOut() {
      await storage.set(null);
      setUser(null);
    },
    async deleteAccount() {
      await storage.set(null);
      setUser(null);
      return OK;
    },
    getToken: async () => null,
    hasEntitlement: () => false,
    refreshSession: async () => undefined,
  };

  return (
    <AuthContext value={{ isLoaded, isSignedIn: !!user, user, mode: 'demo', actions }}>{children}</AuthContext>
  );
}
