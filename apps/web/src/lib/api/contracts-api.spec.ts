import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './client';
import {
  HttpContractsApi,
  __setContractsApiForTesting,
  buildListQueryString,
  getContractsApi,
} from './contracts-api';
import type {
  Contract,
  CreateContractPayload,
  PaginatedContracts,
  UpdateContractPayload,
} from './contracts-types';

const CONTRACT_ID = 'ckcontract_1';
const USER_ID = 'ckuser_1';

const CONTRACT: Contract = {
  id: CONTRACT_ID,
  userId: USER_ID,
  title: 'Apartment Lease — Berlin Mitte',
  category: 'RENT',
  counterparty: 'Vonovia SE',
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2026-01-01T00:00:00.000Z',
  noticePeriodDays: 90,
  autoRenew: false,
  value: '1250.50',
  currency: 'EUR',
  status: 'ACTIVE',
  notes: null,
  createdAt: '2024-12-01T10:00:00.000Z',
  updatedAt: '2024-12-01T10:00:00.000Z',
};

const PAGINATED: PaginatedContracts = {
  items: [CONTRACT],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

function makeClient(): {
  client: ApiClient;
  request: ReturnType<typeof vi.fn>;
} {
  const request = vi.fn();
  const client = Object.create(ApiClient.prototype) as ApiClient;
  Object.assign(client, { request });
  return { client, request };
}

describe('buildListQueryString', () => {
  it('vaghti hich filter dade nashode string khali bar migardone', () => {
    expect(buildListQueryString(undefined)).toBe('');
    expect(buildListQueryString({})).toBe('');
  });

  it('faghat field-haye taarif-shode ro mifreste (undefined skip mishe)', () => {
    const qs = buildListQueryString({
      status: 'ACTIVE',
      page: 2,
      pageSize: 50,
    });

    expect(qs).toBe('?status=ACTIVE&page=2&pageSize=50');
  });

  it('search khali ro emaal nemikone (no-op vaghti rooye empty string)', () => {
    expect(buildListQueryString({ search: '' })).toBe('');
  });

  it('search ba karaktere makhsoos ro encode mikone', () => {
    expect(buildListQueryString({ search: 'a&b c' })).toBe('?search=a%26b+c');
  });

  it('hame field-ha ba ham', () => {
    const qs = buildListQueryString({
      status: 'EXPIRED',
      category: 'GYM',
      search: 'McFit',
      page: 3,
      pageSize: 10,
    });

    expect(qs).toBe('?status=EXPIRED&category=GYM&search=McFit&page=3&pageSize=10');
  });
});

describe('HttpContractsApi', () => {
  it('list() bedoone query, GET /contracts mizane', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(PAGINATED);
    const api = new HttpContractsApi(client);

    const result = await api.list();

    expect(result).toEqual(PAGINATED);
    expect(request).toHaveBeenCalledWith('/contracts', { method: 'GET' });
  });

  it('list() ba query, query-string ro be path append mikone', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(PAGINATED);
    const api = new HttpContractsApi(client);

    await api.list({ status: 'ACTIVE', page: 2, pageSize: 50 });

    expect(request).toHaveBeenCalledWith(
      '/contracts?status=ACTIVE&page=2&pageSize=50',
      { method: 'GET' },
    );
  });

  it('get(id) GET /contracts/:id mizane va Contract bar migardone', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(CONTRACT);
    const api = new HttpContractsApi(client);

    const result = await api.get(CONTRACT_ID);

    expect(result).toEqual(CONTRACT);
    expect(request).toHaveBeenCalledWith(`/contracts/${CONTRACT_ID}`, {
      method: 'GET',
    });
  });

  it('get(id) id ro URL-encode mikone', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(CONTRACT);
    const api = new HttpContractsApi(client);

    await api.get('weird id/with slashes');

    expect(request).toHaveBeenCalledWith(
      '/contracts/weird%20id%2Fwith%20slashes',
      { method: 'GET' },
    );
  });

  it('create() POST /contracts ba payload kamel mizane', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(CONTRACT);
    const api = new HttpContractsApi(client);

    const payload: CreateContractPayload = {
      title: CONTRACT.title,
      category: CONTRACT.category,
      counterparty: CONTRACT.counterparty,
      startDate: CONTRACT.startDate,
      endDate: CONTRACT.endDate,
      noticePeriodDays: 90,
      autoRenew: false,
      value: 1250.5,
      currency: 'EUR',
      status: 'ACTIVE',
    };

    const result = await api.create(payload);

    expect(result).toEqual(CONTRACT);
    expect(request).toHaveBeenCalledWith('/contracts', {
      method: 'POST',
      body: payload,
    });
  });

  it('update() PATCH /contracts/:id ba partial payload mizane', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(CONTRACT);
    const api = new HttpContractsApi(client);

    const payload: UpdateContractPayload = { status: 'CANCELLED' };

    const result = await api.update(CONTRACT_ID, payload);

    expect(result).toEqual(CONTRACT);
    expect(request).toHaveBeenCalledWith(`/contracts/${CONTRACT_ID}`, {
      method: 'PATCH',
      body: payload,
    });
  });

  it('remove() DELETE /contracts/:id mizane va undefined bar migardone', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(undefined);
    const api = new HttpContractsApi(client);

    const result = await api.remove(CONTRACT_ID);

    expect(result).toBeUndefined();
    expect(request).toHaveBeenCalledWith(`/contracts/${CONTRACT_ID}`, {
      method: 'DELETE',
    });
  });

  it('ApiError ha ro be caller forward mikone (404)', async () => {
    const { client, request } = makeClient();
    request.mockRejectedValue(new ApiError(404, 'Not Found', null));
    const api = new HttpContractsApi(client);

    await expect(api.get('missing')).rejects.toMatchObject({
      status: 404,
      name: 'ApiError',
    });
  });

  it('ApiError 401 ro re-throw mikone (caller bayad mosaeede konad redirect ya na)', async () => {
    const { client, request } = makeClient();
    request.mockRejectedValue(new ApiError(401, 'Unauthorized', null));
    const api = new HttpContractsApi(client);

    await expect(api.list()).rejects.toMatchObject({ status: 401 });
  });

  it('ApiError 400 ba body ro forward mikone (validation errors)', async () => {
    const { client, request } = makeClient();
    request.mockRejectedValue(
      new ApiError(400, 'Validation failed', {
        message: ['title should not be empty'],
        statusCode: 400,
      }),
    );
    const api = new HttpContractsApi(client);

    await expect(
      api.create({
        title: '',
        category: 'OTHER',
        counterparty: 'X',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2026-01-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      status: 400,
      body: { message: ['title should not be empty'], statusCode: 400 },
    });
  });
});

describe('getContractsApi singleton', () => {
  it('hamishe hamoon instance ro bar migardone', () => {
    __setContractsApiForTesting(null);
    const first = getContractsApi();
    const second = getContractsApi();

    expect(first).toBe(second);

    __setContractsApiForTesting(null);
  });

  it('__setContractsApiForTesting injection ro emaal mikone', () => {
    const stub: ReturnType<typeof getContractsApi> = {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    __setContractsApiForTesting(stub);

    expect(getContractsApi()).toBe(stub);

    __setContractsApiForTesting(null);
  });
});
