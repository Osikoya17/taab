import { ClerkProvider, useAuth, useClerk, useSignIn, useSignUp, useUser } from '@clerk/expo';
import { useSSO } from '@clerk/expo/experimental';
import { tokenCache } from '@clerk/expo/token-cache';
import * as WebBrowser from 'expo-web-browser';
import type { ReactNode } from 'react';

import { env } from '@/lib/env';

import { AuthContext, type AuthContextValue } from './auth-context';
import { toAuthError } from './errors';
import type { AuthActions, AuthResult, AuthUser } from './types';

// Completes the OAuth browser session when the app is reopened via redirect (web).
WebBrowser.maybeCompleteAuthSession();

const OK: AuthResult = { status: 'complete' };

/**
 * Adapts Clerk Core 3 hooks to the app's AuthActions contract. All Clerk
 * specifics live in this file.
 */
function ClerkBridge({ children }: { children: (value: AuthContextValue) => ReactNode }) {
  const { isLoaded, isSignedIn, getToken, has } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  const authUser: AuthUser | null = user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? '',
        firstName: user.firstName,
        fullName: user.fullName,
        imageUrl: user.hasImage ? user.imageUrl : undefined,
        createdAt: (user.createdAt ?? new Date()).toISOString(),
      }
    : null;

  const actions: AuthActions = {
    async signInWithPassword(email, password) {
      try {
        const { error } = await signIn.password({ identifier: email.trim(), password });
        if (error) return toAuthError(error);
        if (signIn.status === 'complete') {
          const { error: finalizeError } = await signIn.finalize();
          return finalizeError ? toAuthError(finalizeError) : OK;
        }
        if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
          const { error: sendError } = await signIn.mfa.sendEmailCode();
          if (sendError) return toAuthError(sendError);
          return { status: 'needs_verification', email: email.trim() };
        }
        return { status: 'error', message: 'This account needs another sign-in step. Try signing in with Google or Apple.' };
      } catch (error) {
        return toAuthError(error);
      }
    },

    async verifySignInCode(code) {
      try {
        const { error } = await signIn.mfa.verifyEmailCode({ code });
        if (error) return toAuthError(error);
        const { error: finalizeError } = await signIn.finalize();
        return finalizeError ? toAuthError(finalizeError) : OK;
      } catch (error) {
        return toAuthError(error);
      }
    },

    async signUp({ name, email, password }) {
      try {
        const [firstName, ...rest] = name.trim().split(/\s+/);
        const { error } = await signUp.password({
          emailAddress: email.trim(),
          password,
          firstName,
          lastName: rest.join(' ') || undefined,
        });
        if (error) return toAuthError(error);
        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError) return toAuthError(sendError);
        return { status: 'needs_verification', email: email.trim() };
      } catch (error) {
        return toAuthError(error);
      }
    },

    async verifySignUpCode(code) {
      try {
        const { error } = await signUp.verifications.verifyEmailCode({ code });
        if (error) return toAuthError(error);
        if (signUp.status !== 'complete') return { status: 'error', message: 'We need a little more information to finish.' };
        const { error: finalizeError } = await signUp.finalize();
        return finalizeError ? toAuthError(finalizeError) : OK;
      } catch (error) {
        return toAuthError(error);
      }
    },

    async resendCode(flow) {
      try {
        const { error } = flow === 'sign-up' ? await signUp.verifications.sendEmailCode() : await signIn.mfa.sendEmailCode();
        return error ? toAuthError(error) : OK;
      } catch (error) {
        return toAuthError(error);
      }
    },

    async startPasswordReset(email) {
      try {
        const { error } = await signIn.create({ identifier: email.trim() });
        if (error) return toAuthError(error);
        const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
        if (sendError) return toAuthError(sendError);
        return { status: 'needs_verification', email: email.trim() };
      } catch (error) {
        return toAuthError(error);
      }
    },

    async completePasswordReset(code, password) {
      try {
        const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });
        if (error) return toAuthError(error);
        const { error: submitError } = await signIn.resetPasswordEmailCode.submitPassword({ password });
        if (submitError) return toAuthError(submitError);
        if (signIn.status === 'complete') {
          const { error: finalizeError } = await signIn.finalize();
          return finalizeError ? toAuthError(finalizeError) : OK;
        }
        return OK;
      } catch (error) {
        return toAuthError(error);
      }
    },

    async signInWithOAuth(provider) {
      try {
        const { createdSessionId } = await startSSOFlow({
          strategy: provider === 'google' ? 'oauth_google' : 'oauth_apple',
        });
        // A null session means the user closed the browser — not an error.
        return createdSessionId ? OK : { status: 'error', message: '' };
      } catch (error) {
        return toAuthError(error, 'We couldn’t finish signing you in. Please try again.');
      }
    },

    async changePassword(currentPassword, newPassword) {
      if (!user) return { status: 'error', message: 'You’re signed out.' };
      try {
        await user.updatePassword({ currentPassword, newPassword });
        return OK;
      } catch (error) {
        return toAuthError(error);
      }
    },

    async updateAvatar({ base64, mimeType }) {
      if (!user || !base64) return undefined;
      const image = await user.setProfileImage({ file: `data:${mimeType ?? 'image/jpeg'};base64,${base64}` });
      await user.reload();
      return image.publicUrl ?? user.imageUrl;
    },

    async signOut() {
      await clerk.signOut();
    },

    async deleteAccount() {
      if (!user) return { status: 'error', message: 'You’re signed out.' };
      try {
        await user.delete();
        return OK;
      } catch (error) {
        return toAuthError(error, 'We couldn’t delete your account right now. Contact support and we’ll help.');
      }
    },

    getToken: () => getToken(),

    hasEntitlement(check) {
      if (!has) return false;
      if (check.plan) return has({ plan: check.plan });
      if (check.feature) return has({ feature: check.feature });
      return false;
    },

    async refreshSession() {
      await getToken({ skipCache: true });
      await user?.reload();
    },
  };

  return children({
    isLoaded: isLoaded && (!isSignedIn || !!user),
    isSignedIn: !!isSignedIn,
    user: authUser,
    mode: 'clerk',
    actions,
  });
}

export function ClerkAuthProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
      <ClerkBridge>{(value) => <AuthContext value={value}>{children}</AuthContext>}</ClerkBridge>
    </ClerkProvider>
  );
}
