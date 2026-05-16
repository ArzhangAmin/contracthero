/**
 * Contract-related types shared between the Next.js API client, the
 * Contracts UI (list / detail / forms), and any future feature modules.
 *
 * These mirror the public-safe shapes returned by the NestJS Contracts
 * controller (see `apps/api/src/contracts/dto/*`). Two important deviations
 * from the Prisma model:
 *
 * - `startDate`, `endDate`, `createdAt`, `updatedAt` are serialized as ISO
 *   8601 strings on the wire (Date objects do not survive JSON.stringify
 *   without a downstream Date constructor). Callers that need a Date should
 *   call `new Date(contract.startDate)` at the consumption point.
 * - `value` is a string (NUMERIC(14, 2)) because IEEE-754 numbers cannot
 *   safely represent the full domain. The list/detail UI should treat it as
 *   an opaque string and only convert with a big-decimal library if doing
 *   math.
 */

/** Matches Prisma enum `ContractCategory`. */
export type ContractCategory =
  | 'RENT'
  | 'INSURANCE'
  | 'GYM'
  | 'MOBILE'
  | 'INTERNET'
  | 'UTILITIES'
  | 'OTHER';

/** Matches Prisma enum `ContractStatus`. */
export type ContractStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

/** Tuple form of {@link ContractCategory} for iteration / select options. */
export const CONTRACT_CATEGORIES: readonly ContractCategory[] = [
  'RENT',
  'INSURANCE',
  'GYM',
  'MOBILE',
  'INTERNET',
  'UTILITIES',
  'OTHER',
] as const;

/** Tuple form of {@link ContractStatus} for iteration / select options. */
export const CONTRACT_STATUSES: readonly ContractStatus[] = [
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
] as const;

/**
 * Public-safe representation of a Contract returned by the API.
 * Mirrors `ContractResponseDto` on the server.
 */
export interface Contract {
  id: string;
  userId: string;
  title: string;
  category: ContractCategory;
  counterparty: string;
  /** ISO 8601 date-time string. */
  startDate: string;
  /** ISO 8601 date-time string. */
  endDate: string;
  noticePeriodDays: number | null;
  autoRenew: boolean;
  /** Decimal value serialized as a string to preserve NUMERIC(14, 2) precision. */
  value: string | null;
  /** ISO 4217 currency code (3 uppercase letters) or null. */
  currency: string | null;
  status: ContractStatus;
  notes: string | null;
  /** ISO 8601 date-time string. */
  createdAt: string;
  /** ISO 8601 date-time string. */
  updatedAt: string;
}

/**
 * Payload for `POST /contracts`. Mirrors `CreateContractDto`.
 *
 * Dates are sent as ISO 8601 strings; NestJS' `class-transformer` will revive
 * them to `Date` instances on the server.
 */
export interface CreateContractPayload {
  title: string;
  category: ContractCategory;
  counterparty: string;
  startDate: string;
  endDate: string;
  noticePeriodDays?: number;
  autoRenew?: boolean;
  /** Monetary value as a finite, non-negative number (max 2 decimal places). */
  value?: number;
  /** ISO 4217 currency code; will be upper-cased server-side. */
  currency?: string;
  status?: ContractStatus;
  notes?: string;
}

/**
 * Payload for `PATCH /contracts/:id`. Every field is optional; the server
 * still enforces `endDate > startDate` when both are present.
 */
export type UpdateContractPayload = Partial<CreateContractPayload>;

/** Query parameters for `GET /contracts`. Mirrors `ListContractsQueryDto`. */
export interface ListContractsQuery {
  status?: ContractStatus;
  category?: ContractCategory;
  /** Case-insensitive substring match on title or counterparty. */
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Paginated envelope returned by `GET /contracts`. Mirrors `PaginatedContractsDto`. */
export interface PaginatedContracts {
  items: Contract[];
  total: number;
  page: number;
  pageSize: number;
  /** `ceil(total / pageSize)`, always >= 1. */
  totalPages: number;
}
