/**
 * Contract domain types shared between the API client, server fetcher,
 * and UI components.
 *
 * These mirror the public-safe shapes returned by the NestJS contracts
 * controller (see apps/api/src/contracts/dto/contract-response.dto.ts).
 *
 * Note on `value`: Prisma's `Decimal` (NUMERIC(14, 2)) does not round-trip
 * safely through JavaScript's IEEE-754 `number`, so the API serializes it
 * as a **string**. Callers that need to do math should parse it with a
 * big-decimal library; for display the string form preserves precision.
 */

export type ContractStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export type ContractCategory =
  | 'RENT'
  | 'INSURANCE'
  | 'GYM'
  | 'MOBILE'
  | 'INTERNET'
  | 'UTILITIES'
  | 'OTHER';

export const CONTRACT_STATUS_VALUES: readonly ContractStatus[] = [
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
] as const;

export const CONTRACT_CATEGORY_VALUES: readonly ContractCategory[] = [
  'RENT',
  'INSURANCE',
  'GYM',
  'MOBILE',
  'INTERNET',
  'UTILITIES',
  'OTHER',
] as const;

export interface Contract {
  id: string;
  userId: string;
  title: string;
  category: ContractCategory;
  counterparty: string;
  /** ISO-8601 string, e.g. "2025-01-31T00:00:00.000Z". */
  startDate: string;
  /** ISO-8601 string, e.g. "2026-01-31T00:00:00.000Z". */
  endDate: string;
  noticePeriodDays: number | null;
  autoRenew: boolean;
  /** Decimal value as string (NUMERIC(14, 2)). */
  value: string | null;
  currency: string | null;
  status: ContractStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListContractsQuery {
  status?: ContractStatus;
  category?: ContractCategory;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedContracts {
  items: Contract[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function isContractStatus(value: string): value is ContractStatus {
  return (CONTRACT_STATUS_VALUES as readonly string[]).includes(value);
}

export function isContractCategory(value: string): value is ContractCategory {
  return (CONTRACT_CATEGORY_VALUES as readonly string[]).includes(value);
}
