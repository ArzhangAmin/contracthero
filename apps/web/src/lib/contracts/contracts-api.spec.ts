import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../api/client';
import { HttpContractsApi } from './contracts-api';
import type { Contract, PaginatedContracts } from './types';

const CONTRACT: Contract = {
  id: 'c_1',
  userId: 'u_1',
  title: 'WG Rent',
  category: 'RENT',
  counterparty: 'Hausverwaltung Müller',
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2026-01-01T00:00:00.000Z',
  noticePeriodDays: 90,
  autoRenew: true,
  value: '850.00',
  currency: 'EUR',
  status: 'ACTIVE',
  notes: null,
  createdAt: '2025-01-01T10:00:00.000Z',
  updatedAt: '2025-01-01T10:00:00.000Z',
};

const PAGE: PaginatedContracts = {
  items: [CONTRACT],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

function makeClient(): { client: ApiClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn();
  const client = Object.create(ApiClient.prototype) as ApiClient;
  Object.assign(client, { request });
  return { client, request };
}

describe('HttpContractsApi', () => {
  it('list bedoone query default path ra mizade', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(PAGE);
    const api = new HttpContractsApi(client);

    const result = await api.list();

    expect(result).toEqual(PAGE);
    expect(request).toHaveBeenCalledWith('/contracts', { method: 'GET' });
  });

  it('list ba query parameters URL ra dorost misaze', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(PAGE);
    const api = new HttpContractsApi(client);

    await api.list({ status: 'ACTIVE', search: 'WG', page: 2, pageSize: 50 });

    const [path, opts] = request.mock.calls[0];
    expect(path).toMatch(/^\/contracts\?/);
    expect(path).toContain('status=ACTIVE');
    expect(path).toContain('q=WG');
    expect(path).toContain('page=2');
    expect(path).toContain('pageSize=50');
    expect(opts).toEqual({ method: 'GET' });
  });

  it('list defaults (page=1, pageSize=20) ra omit mikone', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(PAGE);
    const api = new HttpContractsApi(client);

    await api.list({ page: 1, pageSize: 20 });

    expect(request).toHaveBeenCalledWith('/contracts', { method: 'GET' });
  });

  it('getById path ra ba encode kardan misaze', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(CONTRACT);
    const api = new HttpContractsApi(client);

    await api.getById('abc/def');

    expect(request).toHaveBeenCalledWith('/contracts/abc%2Fdef', { method: 'GET' });
  });
});
