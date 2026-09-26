import { hasRemoteApi, request } from './client';

/** A single transport boundary keeps screens and query hooks independent of hosting. */
export function connectService<T extends object>(name: string, local: T): T {
  if (!hasRemoteApi) return local;
  return Object.fromEntries(Object.keys(local).map((method) => [method, (...args: unknown[]) =>
    request(`/rpc/${name}/${method}`, { method: 'POST', body: JSON.stringify({ args }) }),
  ])) as T;
}
