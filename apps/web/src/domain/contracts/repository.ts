import type { Contract, ContractStatus, SortDirection, SortField } from './contract';
import { CONTRACTS_FIXTURE } from './mock-data';

export interface ContractsQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: SortField;
  readonly direction: SortDirection;
  readonly status?: ContractStatus;
  readonly search?: string;
  /** Inclusive lower bound on Contract.endDate (ISO date). */
  readonly endDateFrom?: string;
  /** Inclusive upper bound on Contract.endDate (ISO date). */
  readonly endDateTo?: string;
}

export interface ContractsPage {
  readonly items: readonly Contract[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface ContractsRepository {
  list(query: ContractsQuery): Promise<ContractsPage>;
}

function compareContracts(a: Contract, b: Contract, field: SortField): number {
  switch (field) {
    case 'title':
      return a.title.localeCompare(b.title);
    case 'counterparty':
      return a.counterparty.localeCompare(b.counterparty);
    case 'endDate':
      return a.endDate.localeCompare(b.endDate);
    case 'value':
      return a.value - b.value;
  }
}

function matchesSearch(contract: Contract, term: string): boolean {
  const haystack = `${contract.title} ${contract.counterparty}`.toLowerCase();
  return haystack.includes(term.toLowerCase());
}

function filterContracts(items: readonly Contract[], query: ContractsQuery): Contract[] {
  return items.filter((contract) => {
    if (query.status && contract.status !== query.status) {
      return false;
    }
    if (query.search && query.search.trim() !== '' && !matchesSearch(contract, query.search.trim())) {
      return false;
    }
    if (query.endDateFrom && contract.endDate < query.endDateFrom) {
      return false;
    }
    if (query.endDateTo && contract.endDate > query.endDateTo) {
      return false;
    }
    return true;
  });
}

function sortContracts(items: Contract[], field: SortField, direction: SortDirection): Contract[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => sign * compareContracts(a, b, field));
}

/**
 * Creates a pure in-memory repository over the given dataset.
 *
 * Exposed as a factory so the repository can be unit-tested with a
 * controlled fixture without depending on the global mock data.
 */
export function createInMemoryContractsRepository(dataset: readonly Contract[]): ContractsRepository {
  return {
    async list(query: ContractsQuery): Promise<ContractsPage> {
      if (query.page < 1) {
        throw new Error(`page must be >= 1, got ${query.page}`);
      }
      if (query.pageSize < 1) {
        throw new Error(`pageSize must be >= 1, got ${query.pageSize}`);
      }

      const filtered = filterContracts(dataset, query);
      const sorted = sortContracts(filtered, query.sort, query.direction);

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const safePage = Math.min(query.page, totalPages);
      const start = (safePage - 1) * query.pageSize;
      const items = sorted.slice(start, start + query.pageSize);

      return {
        items,
        total,
        page: safePage,
        pageSize: query.pageSize,
        totalPages,
      };
    },
  };
}

/** Default repository used by the web app while the backend is unavailable. */
export const contractsRepository: ContractsRepository = createInMemoryContractsRepository(CONTRACTS_FIXTURE);
