/**
 * Contract domain types.
 *
 * Until the backend service is available, these types model what the
 * Contract List page consumes from the server-side data layer.
 */

export const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'cancelled'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const SORTABLE_FIELDS = ['title', 'counterparty', 'endDate', 'value'] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export interface Contract {
  readonly id: string;
  readonly title: string;
  readonly counterparty: string;
  readonly status: ContractStatus;
  /** ISO 8601 calendar date (YYYY-MM-DD). */
  readonly startDate: string;
  /** ISO 8601 calendar date (YYYY-MM-DD). */
  readonly endDate: string;
  readonly value: number;
  readonly currency: string;
}

export function isContractStatus(value: unknown): value is ContractStatus {
  return typeof value === 'string' && (CONTRACT_STATUSES as readonly string[]).includes(value);
}

export function isSortField(value: unknown): value is SortField {
  return typeof value === 'string' && (SORTABLE_FIELDS as readonly string[]).includes(value);
}

export function isSortDirection(value: unknown): value is SortDirection {
  return typeof value === 'string' && (SORT_DIRECTIONS as readonly string[]).includes(value);
}
