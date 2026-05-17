/**
 * Typed wrapper around the `/contracts` endpoints exposed by apps/api.
 *
 * This is the **browser-side** client — it relies on cookie-based auth and
 * the shared `ApiClient` (which sends `credentials: 'include'`). Server
 * components must use `contracts-server.ts` instead so they can forward
 * the request cookies via Next.js `headers()`.
 */

import { getApiClient, type ApiClient } from '../api/client';
import { buildSearchParams } from './list-query';
import type {
  Contract,
  ListContractsQuery,
  PaginatedContracts,
} from './types';

const PATH_CONTRACTS = '/contracts';

export interface ContractsApi {
  list(query?: ListContractsQuery): Promise<PaginatedContracts>;
  getById(id: string): Promise<Contract>;
}

function buildListPath(query: ListContractsQuery | undefined): string {
  if (!query) {
    return PATH_CONTRACTS;
  }
  const params = buildSearchParams(query);
  const serialized = params.toString();
  return serialized.length > 0 ? `${PATH_CONTRACTS}?${serialized}` : PATH_CONTRACTS;
}

export class HttpContractsApi implements ContractsApi {
  constructor(private readonly client: ApiClient = getApiClient()) {}

  public list(query?: ListContractsQuery): Promise<PaginatedContracts> {
    return this.client.request<PaginatedContracts>(buildListPath(query), {
      method: 'GET',
    });
  }

  public getById(id: string): Promise<Contract> {
    return this.client.request<Contract>(`${PATH_CONTRACTS}/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  }
}

let defaultContractsApi: ContractsApi | null = null;

export function getContractsApi(): ContractsApi {
  if (!defaultContractsApi) {
    defaultContractsApi = new HttpContractsApi();
  }
  return defaultContractsApi;
}

/** Test-only helper to inject a mock implementation. */
export function __setContractsApiForTesting(api: ContractsApi | null): void {
  defaultContractsApi = api;
}
