import { createClerkClient, verifyToken } from '@clerk/backend';

import { ServiceError } from '../src/services/api/errors';
import type { ApiOptions } from './api';

/** Reads the `azp` origin from a JWT payload without verifying it. */
function tokenAzp(token: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { azp?: unknown };
    return typeof payload.azp === 'string' ? payload.azp.slice(0, 200) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Browser tokens carry an `azp` (the origin they were issued to) and must match
 * the allow-list. Native app tokens have no `azp` — there is no web origin — so
 * they are verified without the list; Clerk's check would otherwise reject them.
 * Choosing from the unverified payload is safe: verifyToken checks the
 * signature over every claim, so stripping `azp` from a web token fails.
 */
export function authorizedPartiesFor(token: string, authorizedParties: string[]): string[] | undefined {
  return tokenAzp(token) === undefined ? undefined : authorizedParties;
}

export function clerkServices(secretKey: string, authorizedParties: string[]): Required<Pick<ApiOptions, 'authenticate' | 'deleteIdentity'>> {
  const clerk = createClerkClient({ secretKey });
  return {
    async authenticate(request) {
      const match = request.headers.authorization?.match(/^Bearer (\S+)$/);
      if (!match) throw new ServiceError('forbidden');
      // Explain rejections in the server log (never the token itself) so auth
      // misconfiguration, such as an unlisted authorized party, is diagnosable.
      const reject = (reason: string): never => {
        console.warn(`Sign-in token rejected: ${reason}`);
        throw new ServiceError('forbidden');
      };
      let claims: Awaited<ReturnType<typeof verifyToken>>;
      try {
        claims = await verifyToken(match[1], { secretKey, authorizedParties: authorizedPartiesFor(match[1], authorizedParties) });
      } catch (error) {
        const reason = error && typeof error === 'object' && 'reason' in error ? String(error.reason) : 'verification failed';
        return reject(`${reason} (token azp: ${tokenAzp(match[1]) ?? 'none'}; authorized parties: ${authorizedParties.join(', ')})`);
      }
      try {
        if (!claims.sub || typeof claims.sid !== 'string') return reject('token has no user session');
        const user = await clerk.users.getUser(claims.sub);
        if (user.banned || user.locked) return reject('user is banned or locked');
        const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId && e.verification?.status === 'verified')?.emailAddress;
        if (!email) return reject('user has no verified primary email');
        return { userId: user.id, email, name: [user.firstName, user.lastName].filter(Boolean).join(' ') || email.split('@')[0], avatarUrl: user.imageUrl, createdAt: new Date(user.createdAt).toISOString() };
      } catch (error) {
        if (error instanceof ServiceError) throw error;
        return reject('could not load the user from Clerk');
      }
    },
    async deleteIdentity(userId) {
      try { await clerk.users.deleteUser(userId); }
      catch (error) {
        if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) throw error;
      }
    },
  };
}
