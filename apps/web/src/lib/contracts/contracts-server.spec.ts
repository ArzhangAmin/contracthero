import { describe, expect, it, vi } from 'vitest';
import {
  ContractsServerError,
  fetchContractsServerSide,
  resolveServerApiBaseUrl,
} from './contracts-server';
import type { PaginatedContracts } from './types';

// Mock `next/headers` so this spec does not depend on a Next.js request scope.
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [
      { name: 'access_token', value: 'abc' },
      { name: 'refresh_token', value: 'xyz' },
    ],
  })),
}));

const PAGE: PaginatedContracts = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchContractsServerSide', () => {
  it('Cookie header ra az next/headers misaze', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGE, 200));
    await fetchContractsServerSide(
      {},
      { fetchImpl: fetchMock as unknown as typeof fetch, baseUrl: 'http://api.test' },
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Cookie).toBe('access_token=abc; refresh_token=xyz');
    expect(headers.Accept).toBe('application/json');
  });

  it('explicit cookieHeader override mishe', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGE, 200));
    await fetchContractsServerSide(
      {},
      {
        fetchImpl: fetchMock as unknown as typeof fetch,
        baseUrl: 'http://api.test',
        cookieHeader: 'access_token=manual',
      },
    );
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers.Cookie).toBe('access_token=manual');
  });

  it('URL ra ba query params dorost misaze', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGE, 200));
    await fetchContractsServerSide(
      { status: 'ACTIVE', page: 2 },
      { fetchImpl: fetchMock as unknown as typeof fetch, baseUrl: 'http://api.test' },
    );
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('http://api.test/contracts?');
    expect(url).toContain('status=ACTIVE');
    expect(url).toContain('page=2');
  });

  it('cache: no-store mizade ta vue ye user be vue ye user dige nashure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGE, 200));
    await fetchContractsServerSide(
      {},
      { fetchImpl: fetchMock as unknown as typeof fetch, baseUrl: 'http://api.test' },
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.cache).toBe('no-store');
  });

  it('non-2xx ContractsServerError ba status doroost partab mikone', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('Nope', { status: 401 }));
    await expect(
      fetchContractsServerSide(
        {},
        { fetchImpl: fetchMock as unknown as typeof fetch, baseUrl: 'http://api.test' },
      ),
    ).rejects.toMatchObject({ name: 'ContractsServerError', status: 401 });
  });

  it('baseUrl trailing slash ra hazf mikone', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGE, 200));
    await fetchContractsServerSide(
      {},
      {
        fetchImpl: fetchMock as unknown as typeof fetch,
        baseUrl: 'http://api.test/',
      },
    );
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('http://api.test/contracts');
  });

  it('JSON ra parse mikone', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGE, 200));
    const result = await fetchContractsServerSide(
      {},
      { fetchImpl: fetchMock as unknown as typeof fetch, baseUrl: 'http://api.test' },
    );
    expect(result).toEqual(PAGE);
  });
});

describe('resolveServerApiBaseUrl', () => {
  it('hamishe string bargardune (fallback be localhost)', () => {
    const url = resolveServerApiBaseUrl();
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });
});

describe('ContractsServerError', () => {
  it('status va message ra hold mikone', () => {
    const err = new ContractsServerError(500, 'boom');
    expect(err.status).toBe(500);
    expect(err.message).toBe('boom');
    expect(err.name).toBe('ContractsServerError');
  });
});
