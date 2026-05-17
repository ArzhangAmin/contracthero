import { describe, expect, it } from 'vitest';
import type { Contract } from './contract';
import { createInMemoryContractsRepository } from './repository';

const SAMPLE: readonly Contract[] = [
  {
    id: '1',
    title: 'Alpha Lease',
    counterparty: 'Zeta GmbH',
    status: 'active',
    startDate: '2024-01-01',
    endDate: '2025-06-30',
    value: 1000,
    currency: 'EUR',
  },
  {
    id: '2',
    title: 'Beta Subscription',
    counterparty: 'Alpha AG',
    status: 'draft',
    startDate: '2024-02-01',
    endDate: '2026-01-31',
    value: 500,
    currency: 'EUR',
  },
  {
    id: '3',
    title: 'Charlie Audit',
    counterparty: 'Beta LLC',
    status: 'expired',
    startDate: '2022-01-01',
    endDate: '2024-12-31',
    value: 750,
    currency: 'EUR',
  },
  {
    id: '4',
    title: 'Delta Hosting',
    counterparty: 'Cloud Co',
    status: 'active',
    startDate: '2024-04-01',
    endDate: '2025-03-31',
    value: 2000,
    currency: 'EUR',
  },
];

describe('createInMemoryContractsRepository', () => {
  const repo = createInMemoryContractsRepository(SAMPLE);

  it('paginates results and reports totals', async () => {
    const result = await repo.list({ page: 1, pageSize: 2, sort: 'title', direction: 'asc' });
    expect(result.total).toBe(4);
    expect(result.totalPages).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((c) => c.id)).toEqual(['1', '2']);
  });

  it('returns the second page when requested', async () => {
    const result = await repo.list({ page: 2, pageSize: 2, sort: 'title', direction: 'asc' });
    expect(result.page).toBe(2);
    expect(result.items.map((c) => c.id)).toEqual(['3', '4']);
  });

  it('clamps the page to the last available page', async () => {
    const result = await repo.list({ page: 99, pageSize: 2, sort: 'title', direction: 'asc' });
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('sorts ascending and descending by value', async () => {
    const asc = await repo.list({ page: 1, pageSize: 10, sort: 'value', direction: 'asc' });
    expect(asc.items.map((c) => c.value)).toEqual([500, 750, 1000, 2000]);

    const desc = await repo.list({ page: 1, pageSize: 10, sort: 'value', direction: 'desc' });
    expect(desc.items.map((c) => c.value)).toEqual([2000, 1000, 750, 500]);
  });

  it('filters by status', async () => {
    const result = await repo.list({
      page: 1,
      pageSize: 10,
      sort: 'title',
      direction: 'asc',
      status: 'active',
    });
    expect(result.items.map((c) => c.id)).toEqual(['1', '4']);
  });

  it('filters by case-insensitive search across title and counterparty', async () => {
    const result = await repo.list({
      page: 1,
      pageSize: 10,
      sort: 'title',
      direction: 'asc',
      search: 'alpha',
    });
    // Matches "Alpha Lease" via title and "Alpha AG" via counterparty.
    expect(result.items.map((c) => c.id).sort()).toEqual(['1', '2']);
  });

  it('filters by inclusive endDate range', async () => {
    const result = await repo.list({
      page: 1,
      pageSize: 10,
      sort: 'endDate',
      direction: 'asc',
      endDateFrom: '2025-01-01',
      endDateTo: '2025-12-31',
    });
    expect(result.items.map((c) => c.id)).toEqual(['4', '1']);
  });

  it('returns empty page when nothing matches', async () => {
    const result = await repo.list({
      page: 1,
      pageSize: 10,
      sort: 'title',
      direction: 'asc',
      search: 'zzz-no-match',
    });
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.items).toEqual([]);
  });

  it('rejects invalid pagination input', async () => {
    await expect(
      repo.list({ page: 0, pageSize: 10, sort: 'title', direction: 'asc' }),
    ).rejects.toThrowError(/page must be >= 1/);
    await expect(
      repo.list({ page: 1, pageSize: 0, sort: 'title', direction: 'asc' }),
    ).rejects.toThrowError(/pageSize must be >= 1/);
  });
});
