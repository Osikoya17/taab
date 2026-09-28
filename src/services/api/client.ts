import { env } from '@/lib/env';

import { ServiceError, type ServiceErrorCode } from './errors';

/**
 * HTTP client for the taab backend. Setting EXPO_PUBLIC_API_URL switches all
 * domain services to authenticated requests; otherwise they use device storage.
 *
 * The session token comes from Clerk via `setTokenProvider` and is sent as a
 * bearer token. The backend must verify it — never trust client claims for
 * entitlements or ownership.
 */
type TokenProvider = () => Promise<string | null>;

let tokenProvider: TokenProvider = async () => null;

export function setTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

export const hasRemoteApi = env.apiUrl.length > 0;

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenProvider();
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    response = await fetch(`${env.apiUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const codes: ServiceErrorCode[] = ['network', 'not_found', 'forbidden', 'validation', 'history_locked', 'limit_reached', 'rate_limited', 'unavailable', 'unknown'];
      if (body && typeof body === 'object' && 'code' in body && codes.includes(body.code as ServiceErrorCode)) throw new ServiceError(body.code as ServiceErrorCode);
      throw new ServiceError(response.status === 401 || response.status === 403 ? 'forbidden' : response.status === 404 ? 'not_found' : response.status === 422 || response.status === 400 ? 'validation' : response.status === 429 ? 'rate_limited' : 'unknown');
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('network');
  } finally {
    clearTimeout(timeout);
  }
}
