/**
 * Server-side fetcher for `/contracts` — used by Next.js Server Components.
 *
 * Server components cannot rely on `credentials: 'include'` because they
 * run in Node, not the browser. We must explicitly forward the incoming
 * request's cookies to the API via the `Cookie` header.
 *
 * On non-2xx we throw a `ContractsServerError` carrying the status code so
 * the page can branch on auth (401) vs server error (5xx) vs not-found.
 *
 * Why no `import 'server-only'`? The use of `cookies()` from `next/headers`
 * already throws at runtime if anyone imports this from a client component,
 * which is the natural guard. We deliberately avoid pulling in the
 * `server-only` package just to add a build-time tripwire.
 */

import { cookies } from 'next/headers';
import { ApiError } from '../api/client';
import { buildSearchParams } from './list-query';
import type { ListContractsQuery, PaginatedContracts } from './types';

const PATH_CONTRACTS = '/contracts';
const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const JSON_CONTENT_TYPE = 'application/json';

/**
 * Resolves the API base URL for **server-side** fetches. Prefers the
 * server-only `API_INTERNAL_URL` (useful in containerised deployments
 * where the public URL is not reachable from inside the cluster), then
 * falls back to the public `NEXT_PUBLIC_API_URL`, then localhost.
 */
export function resolveServerApiBaseUrl(): string {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    DEFAULT_API_BASE_URL
  ).replace(/\/+$/, '');
}

export interface FetchContractsOptions {
  /** Optional override — defaults to `fetch` bound to globalThis. */
  fetchImpl?: typeof fetch;
  /** Optional override — defaults to `resolveServerApiBaseUrl()`. */
  baseUrl?: string;
  /** Cookie header value — when omitted, read from `next/headers`. */
  cookieHeader?: string;
}

export class ContractsServerError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ContractsServerError';
    this.status = status;
  }
}

async function readCookieHeader(): Promise<string> {
  const store = await cookies();
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

function buildListUrl(baseUrl: string, query: ListContractsQuery): string {
  const params = buildSearchParams(query);
  const qs = params.toString();
  return qs.length > 0
    ? `${baseUrl}${PATH_CONTRACTS}?${qs}`
    : `${baseUrl}${PATH_CONTRACTS}`;
}

/**
 * Fetches a paginated list of contracts on the server, forwarding the
 * caller's cookies for auth. Throws `ContractsServerError` on non-2xx.
 */
export async function fetchContractsServerSide(
  query: ListContractsQuery,
  options: FetchContractsOptions = {},
): Promise<PaginatedContracts> {
  const baseUrl = options.baseUrl ?? resolveServerApiBaseUrl();
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  const cookieHeader = options.cookieHeader ?? (await readCookieHeader());

  const url = buildListUrl(baseUrl, query);

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: JSON_CONTENT_TYPE,
      ...(cookieHeader.length > 0 ? { Cookie: cookieHeader } : {}),
    },
    // `no-store`: contract list is per-user and frequently mutated; we
    // don't want Next's default Data Cache to leak one user's view to
    // another or to serve stale post-mutation data.
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ContractsServerError(
      response.status,
      text.length > 0 ? text : response.statusText,
    );
  }

  return (await response.json()) as PaginatedContracts;
}

/** Re-export so callers can branch on the shared ApiError type if needed. */
export { ApiError };
