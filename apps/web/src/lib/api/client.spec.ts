import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './client';

const BASE_URL = 'https://api.example.test';

function buildJsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildEmptyResponse(status: number): Response {
  return new Response(null, { status });
}

describe('ApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: ApiClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    client = new ApiClient({ baseUrl: BASE_URL, fetchImpl: fetchMock as unknown as typeof fetch });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hamishe credentials: include mifreste', async () => {
    fetchMock.mockResolvedValue(buildJsonResponse({ ok: true }, 200));
    await client.request('/foo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('include');
  });

  it('body ro JSON.stringify mikone va Content-Type ezafe mikone', async () => {
    fetchMock.mockResolvedValue(buildJsonResponse({ ok: true }, 200));
    await client.request('/foo', { method: 'POST', body: { x: 1 } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ x: 1 }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('JSON response ro parse mikone', async () => {
    fetchMock.mockResolvedValue(buildJsonResponse({ hello: 'world' }, 200));
    const data = await client.request<{ hello: string }>('/foo');
    expect(data).toEqual({ hello: 'world' });
  });

  it('baraye 204 undefined bargardone', async () => {
    fetchMock.mockResolvedValue(buildEmptyResponse(204));
    const data = await client.request('/foo', { method: 'POST' });
    expect(data).toBeUndefined();
  });

  it('non-2xx ro ApiError mide ba status doroost', async () => {
    fetchMock.mockResolvedValue(
      buildJsonResponse({ message: 'Invalid credentials', statusCode: 401 }, 401),
    );
    await expect(client.request('/foo')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Invalid credentials',
    });
  });

  it('baraye message array, message ha ro join mikone', async () => {
    fetchMock.mockResolvedValue(
      buildJsonResponse({ message: ['email invalid', 'password short'] }, 400),
    );
    try {
      await client.request('/foo');
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe('email invalid, password short');
    }
  });

  it('baseUrl trailing slash ro hazf mikone', async () => {
    const c = new ApiClient({
      baseUrl: `${BASE_URL}/`,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    fetchMock.mockResolvedValue(buildJsonResponse({ ok: true }, 200));
    await c.request('/foo');
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/foo`);
  });

  it('age response body khali bashe va status ok bashe, null bar migardone', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    const data = await client.request('/foo');
    expect(data).toBeNull();
  });
});
