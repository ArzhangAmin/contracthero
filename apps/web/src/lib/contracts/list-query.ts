/**
 * URL <-> ListContractsQuery serializer.
 *
 * The Contract List page uses the URL as the single source of truth so
 * that:
 *   - back/forward navigation restores state,
 *   - links/bookmarks are shareable,
 *   - server components can render with the right filters on first paint.
 *
 * `parseSearchParams` accepts the loose `searchParams` shape Next.js gives
 * us (string | string[] | undefined) and normalises it to a strict typed
 * query. `buildSearchParams` is the inverse — it builds a URLSearchParams
 * that we can stringify and push via the router.
 */

import {
  CONTRACT_CATEGORY_VALUES,
  CONTRACT_STATUS_VALUES,
  isContractCategory,
  isContractStatus,
  type ContractCategory,
  type ContractStatus,
  type ListContractsQuery,
} from './types';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MIN_PAGE = 1;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_LENGTH = 200;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const SEARCH_PARAM_KEYS = {
  status: 'status',
  category: 'category',
  search: 'q',
  page: 'page',
  pageSize: 'pageSize',
} as const;

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseIntInRange(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}

/**
 * Parse a Next.js `searchParams` record into a typed query.
 * Invalid values are silently dropped (never thrown) — the list page must
 * remain renderable even when a user pastes a malformed URL.
 */
export function parseSearchParams(
  searchParams: RawSearchParams,
): Required<Pick<ListContractsQuery, 'page' | 'pageSize'>> & ListContractsQuery {
  const statusRaw = pickFirst(searchParams[SEARCH_PARAM_KEYS.status]);
  const categoryRaw = pickFirst(searchParams[SEARCH_PARAM_KEYS.category]);
  const searchRaw = pickFirst(searchParams[SEARCH_PARAM_KEYS.search]);
  const pageRaw = pickFirst(searchParams[SEARCH_PARAM_KEYS.page]);
  const pageSizeRaw = pickFirst(searchParams[SEARCH_PARAM_KEYS.pageSize]);

  const status: ContractStatus | undefined =
    statusRaw !== undefined && isContractStatus(statusRaw) ? statusRaw : undefined;
  const category: ContractCategory | undefined =
    categoryRaw !== undefined && isContractCategory(categoryRaw) ? categoryRaw : undefined;

  let search: string | undefined;
  if (searchRaw !== undefined) {
    const trimmed = searchRaw.trim().slice(0, MAX_SEARCH_LENGTH);
    if (trimmed.length > 0) {
      search = trimmed;
    }
  }

  const page = parseIntInRange(pageRaw, MIN_PAGE, Number.MAX_SAFE_INTEGER, DEFAULT_PAGE);
  const pageSize = parseIntInRange(
    pageSizeRaw,
    MIN_PAGE_SIZE,
    MAX_PAGE_SIZE,
    DEFAULT_PAGE_SIZE,
  );

  return {
    status,
    category,
    search,
    page,
    pageSize,
  };
}

/**
 * Build a `URLSearchParams` from a typed query. Keys with default values
 * are omitted so that the canonical URL stays short.
 */
export function buildSearchParams(query: ListContractsQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.status !== undefined) {
    params.set(SEARCH_PARAM_KEYS.status, query.status);
  }
  if (query.category !== undefined) {
    params.set(SEARCH_PARAM_KEYS.category, query.category);
  }
  if (query.search !== undefined && query.search.length > 0) {
    params.set(SEARCH_PARAM_KEYS.search, query.search);
  }
  if (query.page !== undefined && query.page !== DEFAULT_PAGE) {
    params.set(SEARCH_PARAM_KEYS.page, String(query.page));
  }
  if (query.pageSize !== undefined && query.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set(SEARCH_PARAM_KEYS.pageSize, String(query.pageSize));
  }
  return params;
}

/** Convenience: the canonical query-string ("" when at defaults). */
export function buildQueryString(query: ListContractsQuery): string {
  const params = buildSearchParams(query);
  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}

export const AVAILABLE_STATUSES = CONTRACT_STATUS_VALUES;
export const AVAILABLE_CATEGORIES = CONTRACT_CATEGORY_VALUES;
