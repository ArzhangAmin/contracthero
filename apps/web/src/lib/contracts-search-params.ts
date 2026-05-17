import {
  isContractStatus,
  isSortDirection,
  isSortField,
  type ContractStatus,
  type SortDirection,
  type SortField,
} from '@/domain/contracts/contract';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_SORT: SortField = 'endDate';
export const DEFAULT_DIRECTION: SortDirection = 'asc';

/** Raw `searchParams` shape as delivered by Next.js page props. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ContractsSearchParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: SortField;
  readonly direction: SortDirection;
  readonly status?: ContractStatus;
  readonly search?: string;
  readonly endDateFrom?: string;
  readonly endDateTo?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parsePositiveInt(value: string | undefined, fallback: number, max?: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return max !== undefined ? Math.min(parsed, max) : parsed;
}

function parseIsoDate(value: string | undefined): string | undefined {
  if (!value || !ISO_DATE_RE.test(value)) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : value;
}

/**
 * Normalises raw URL search params for the Contract List page into a
 * strongly-typed object with sensible defaults. Unknown / malformed
 * values fall back to defaults rather than throwing, so a hand-edited
 * URL never breaks the page.
 */
export function parseContractsSearchParams(raw: RawSearchParams): ContractsSearchParams {
  const sortRaw = firstValue(raw.sort);
  const directionRaw = firstValue(raw.dir);
  const statusRaw = firstValue(raw.status);
  const searchRaw = firstValue(raw.search)?.trim();
  const endDateFrom = parseIsoDate(firstValue(raw.endDateFrom));
  const endDateTo = parseIsoDate(firstValue(raw.endDateTo));

  return {
    page: parsePositiveInt(firstValue(raw.page), DEFAULT_PAGE),
    pageSize: parsePositiveInt(firstValue(raw.pageSize), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    sort: isSortField(sortRaw) ? sortRaw : DEFAULT_SORT,
    direction: isSortDirection(directionRaw) ? directionRaw : DEFAULT_DIRECTION,
    status: isContractStatus(statusRaw) ? statusRaw : undefined,
    search: searchRaw && searchRaw.length > 0 ? searchRaw : undefined,
    endDateFrom,
    endDateTo,
  };
}

export interface BuildQueryStringOverrides {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: SortField;
  readonly direction?: SortDirection;
  readonly status?: ContractStatus | null;
  readonly search?: string | null;
  readonly endDateFrom?: string | null;
  readonly endDateTo?: string | null;
}

/**
 * Builds a query string that represents `current` with the given
 * `overrides` applied. Default values are omitted so the URL stays
 * clean.
 *
 * Passing `null` for an optional field explicitly clears it.
 */
export function buildContractsQueryString(
  current: ContractsSearchParams,
  overrides: BuildQueryStringOverrides = {},
): string {
  const params = new URLSearchParams();

  const page = overrides.page ?? current.page;
  if (page !== DEFAULT_PAGE) {
    params.set('page', String(page));
  }

  const pageSize = overrides.pageSize ?? current.pageSize;
  if (pageSize !== DEFAULT_PAGE_SIZE) {
    params.set('pageSize', String(pageSize));
  }

  const sort = overrides.sort ?? current.sort;
  if (sort !== DEFAULT_SORT) {
    params.set('sort', sort);
  }

  const direction = overrides.direction ?? current.direction;
  if (direction !== DEFAULT_DIRECTION) {
    params.set('dir', direction);
  }

  const status = 'status' in overrides ? overrides.status : current.status;
  if (status) {
    params.set('status', status);
  }

  const search = 'search' in overrides ? overrides.search : current.search;
  if (search) {
    params.set('search', search);
  }

  const endDateFrom = 'endDateFrom' in overrides ? overrides.endDateFrom : current.endDateFrom;
  if (endDateFrom) {
    params.set('endDateFrom', endDateFrom);
  }

  const endDateTo = 'endDateTo' in overrides ? overrides.endDateTo : current.endDateTo;
  if (endDateTo) {
    params.set('endDateTo', endDateTo);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
