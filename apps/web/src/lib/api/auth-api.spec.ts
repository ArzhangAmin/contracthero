import { describe, expect, it, vi } from 'vitest';
import { HttpAuthApi } from './auth-api';
import { ApiClient, ApiError } from './client';
import type { AuthUser } from '../auth/types';

const USER: AuthUser = {
  id: 'user_1',
  email: 'user@example.com',
  name: 'Jane',
  locale: 'DE',
  createdAt: new Date('2024-01-01').toISOString(),
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

describe('HttpAuthApi', () => {
  it('login user ro az response.user bar migardone', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue({ user: USER });
    const api = new HttpAuthApi(client);

    const result = await api.login({ email: USER.email, password: 'pw' });

    expect(result).toEqual(USER);
    expect(request).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: USER.email, password: 'pw' },
    });
  });

  it('register payload kamel ro mifreste', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue({ user: USER });
    const api = new HttpAuthApi(client);

    await api.register({
      email: USER.email,
      password: 'StrongPass1',
      name: USER.name,
      locale: 'DE',
    });

    expect(request).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: {
        email: USER.email,
        password: 'StrongPass1',
        name: USER.name,
        locale: 'DE',
      },
    });
  });

  it('logout POST mifreste va undefined bar migardone', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue(undefined);
    const api = new HttpAuthApi(client);

    await api.logout();

    expect(request).toHaveBeenCalledWith('/auth/logout', { method: 'POST' });
  });

  it('me() ba 401 null bar migardone', async () => {
    const { client, request } = makeClient();
    request.mockRejectedValue(new ApiError(401, 'Unauthorized', null));
    const api = new HttpAuthApi(client);

    const result = await api.me();
    expect(result).toBeNull();
  });

  it('me() error gheyr 401 ro re-throw mikone', async () => {
    const { client, request } = makeClient();
    request.mockRejectedValue(new ApiError(500, 'Server error', null));
    const api = new HttpAuthApi(client);

    await expect(api.me()).rejects.toMatchObject({ status: 500 });
  });

  it('me() user ro az response.user bar migardone', async () => {
    const { client, request } = makeClient();
    request.mockResolvedValue({ user: USER });
    const api = new HttpAuthApi(client);

    const result = await api.me();
    expect(result).toEqual(USER);
  });
});
