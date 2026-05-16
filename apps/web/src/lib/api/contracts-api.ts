/**
 * Typed wrappers around the contracts endpoints exposed by `apps/api`.
 *
 * All methods reuse the shared {@link ApiClient}, which:
 *   - sends cookies on every request (`credentials: 'include'`) so the
 *     HTTP-only JWT cookie set by `/auth/login` is forwarded, and
 *   - throws an {@link ApiError} on non-2xx responses so callers can branch
 *     on `status` instead of parsing strings.
 *
 * The wire format matches the NestJS Contracts controller:
 *   - `POST   /contracts`         → 201, `Contract`
 *   - `GET    /contracts`         → 200, `PaginatedContracts`
 *   - `GET    /contracts/:id`     → 200, `Contract`
 *   - `PATCH  /contracts/:id`     → 200, `Contract`
 *   - `DELETE /contracts/:id`     → 204, no body
 */

import { getApiClient, type ApiClient } from './client';
import type {
  Contract,
  CreateContractPayload,
  ListContractsQuery,
  PaginatedContracts,
  UpdateContractPayload,
} from './contracts-types';

const PATH_CONTRACTS = '/contracts';

export interface ContractsApi {
  list(query?: ListContractsQuery): Promise<PaginatedContracts>;
  get(id: string): Promise<Contract>;
  create(payload: CreateContractPayload): Promise<Contract>;
  update(id: string, payload: UpdateContractPayload): Promise<Contract>;
  remove(id: string): Promise<void>;
}

/**
 * Serializes a {@link ListContractsQuery} into a `?key=value&...` string.
 *
 * - `undefined` values are skipped so we never send `?status=undefined`.
 * - Numbers are coerced via `String(...)` (safe for finite ints).
 * - The returned string includes the leading `?`, or is empty when no
 *   parameters are set.
 */
export function buildListQueryString(query: ListContractsQuery | undefined): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  if (query.status !== undefined) {
    params.set('status', query.status);
  }
  if (query.category !== undefined) {
    params.set('category', query.category);
  }
  if (query.search !== undefined && query.search.length > 0) {
    params.set('search', query.search);
  }
  if (query.page !== undefined) {
    params.set('page', String(query.page));
  }
  if (query.pageSize !== undefined) {
    params.set('pageSize', String(query.pageSize));
  }
  const serialized = params.toString();
  return serialized.length === 0 ? '' : `?${serialized}`;
}

/**
 * URL-safe encoder for path segments. Centralized so every endpoint that
 * embeds a user-supplied id (`/contracts/:id`) is consistently encoded.
 */
function encodeId(id: string): string {
  return encodeURIComponent(id);
}

export class HttpContractsApi implements ContractsApi {
  constructor(private readonly client: ApiClient = getApiClient()) {}

  public async list(query?: ListContractsQuery): Promise<PaginatedContracts> {
    const queryString = buildListQueryString(query);
    return this.client.request<PaginatedContracts>(
      `${PATH_CONTRACTS}${queryString}`,
      { method: 'GET' },
    );
  }

  public async get(id: string): Promise<Contract> {
    return this.client.request<Contract>(`${PATH_CONTRACTS}/${encodeId(id)}`, {
      method: 'GET',
    });
  }

  public async create(payload: CreateContractPayload): Promise<Contract> {
    return this.client.request<Contract>(PATH_CONTRACTS, {
      method: 'POST',
      body: payload,
    });
  }

  public async update(id: string, payload: UpdateContractPayload): Promise<Contract> {
    return this.client.request<Contract>(`${PATH_CONTRACTS}/${encodeId(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  public async remove(id: string): Promise<void> {
    await this.client.request<void>(`${PATH_CONTRACTS}/${encodeId(id)}`, {
      method: 'DELETE',
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
