import { describe, expect, it, vi } from 'vitest';

const intlResponse = { kind: 'intl-pass' };

vi.mock('next-intl/middleware', () => ({
  default: vi.fn(() => vi.fn(() => intlResponse)),
}));

import { middleware } from './middleware';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './lib/auth/constants';

interface MockRequestOptions {
  pathname: string;
  search?: string;
  cookies?: Record<string, string>;
}

interface MockRequest {
  nextUrl: URL & { clone(): URL };
  cookies: {
    has(name: string): boolean;
  };
}

function buildRequest({ pathname, search = '', cookies = {} }: MockRequestOptions): MockRequest {
  const base = `http://localhost:3000${pathname}${search}`;
  const url = new URL(base);
  const clone = (): URL => new URL(url.toString());
  const nextUrl = Object.assign(url, { clone }) as URL & { clone(): URL };
  return {
    nextUrl,
    cookies: {
      has(name: string): boolean {
        return name in cookies;
      },
    },
  };
}

function callMiddleware(req: MockRequest): {
  status: number;
  location: string | null;
  passedThrough: boolean;
} {
  // The middleware function expects a NextRequest; our mock satisfies the
  // subset of the interface that middleware actually touches.
  const response = middleware(req as unknown as Parameters<typeof middleware>[0]);
  const candidate = response as unknown as
    | { status: number; headers: Headers }
    | typeof intlResponse;
  if ('kind' in candidate && candidate.kind === 'intl-pass') {
    return { status: 200, location: null, passedThrough: true };
  }
  const real = candidate as { status: number; headers: Headers };
  return {
    status: real.status,
    location: real.headers.get('location'),
    passedThrough: false,
  };
}

describe('middleware', () => {
  it('public path bedoone auth cookie pass through mishe', () => {
    const result = callMiddleware(buildRequest({ pathname: '/en' }));
    expect(result.passedThrough).toBe(true);
  });

  it('protected path bedoone cookie be /<locale>/auth/login redirect mishe', () => {
    const result = callMiddleware(buildRequest({ pathname: '/en/dashboard' }));
    expect(result.passedThrough).toBe(false);
    expect(result.status).toBeGreaterThanOrEqual(300);
    expect(result.location).toContain('/en/auth/login');
    expect(result.location).toContain('redirect=%2Fen%2Fdashboard');
  });

  it('protected path ba access_token cookie pass through mishe', () => {
    const result = callMiddleware(
      buildRequest({
        pathname: '/de/dashboard',
        cookies: { [ACCESS_TOKEN_COOKIE]: 'token' },
      }),
    );
    expect(result.passedThrough).toBe(true);
  });

  it('protected path ba refresh_token cookie pass through mishe', () => {
    const result = callMiddleware(
      buildRequest({
        pathname: '/de/dashboard',
        cookies: { [REFRESH_TOKEN_COOKIE]: 'rt' },
      }),
    );
    expect(result.passedThrough).toBe(true);
  });

  it('auth-only path ba cookie be home redirect mishe', () => {
    const result = callMiddleware(
      buildRequest({
        pathname: '/fa/auth/login',
        cookies: { [ACCESS_TOKEN_COOKIE]: 'token' },
      }),
    );
    expect(result.passedThrough).toBe(false);
    expect(result.location).toContain('/fa/');
  });

  it('auth-only path bedoone cookie pass through mishe', () => {
    const result = callMiddleware(buildRequest({ pathname: '/de/auth/register' }));
    expect(result.passedThrough).toBe(true);
  });

  it('locale invalid -> default locale baraye redirect estefade mishe', () => {
    const result = callMiddleware(buildRequest({ pathname: '/dashboard' }));
    expect(result.passedThrough).toBe(false);
    expect(result.location).toContain('/de/auth/login');
  });

  it('authenticated user ba safe ?redirect= be target redirect mishe', () => {
    const result = callMiddleware(
      buildRequest({
        pathname: '/en/auth/login',
        search: '?redirect=%2Fen%2Fdashboard',
        cookies: { [ACCESS_TOKEN_COOKIE]: 'token' },
      }),
    );
    expect(result.passedThrough).toBe(false);
    expect(result.location).toContain('/en/dashboard');
    expect(result.location).not.toContain('redirect=');
  });

  it('authenticated user ba unsafe ?redirect= (cross-origin) be home redirect mishe', () => {
    const result = callMiddleware(
      buildRequest({
        pathname: '/en/auth/login',
        search: '?redirect=https%3A%2F%2Fevil.example%2Fphish',
        cookies: { [ACCESS_TOKEN_COOKIE]: 'token' },
      }),
    );
    expect(result.passedThrough).toBe(false);
    expect(result.location).not.toContain('evil.example');
    expect(result.location).toContain('/en/');
  });

  it('authenticated user ba ?redirect=//evil be home redirect mishe (na protocol-relative)', () => {
    const result = callMiddleware(
      buildRequest({
        pathname: '/de/auth/login',
        search: '?redirect=%2F%2Fevil.example',
        cookies: { [ACCESS_TOKEN_COOKIE]: 'token' },
      }),
    );
    expect(result.passedThrough).toBe(false);
    expect(result.location).not.toContain('evil.example');
    expect(result.location).toContain('/de/');
  });

  it('authenticated user ba ?redirect=/auth/login (loop) be home redirect mishe', () => {
    const result = callMiddleware(
      buildRequest({
        pathname: '/en/auth/login',
        search: '?redirect=%2Fen%2Fauth%2Flogin',
        cookies: { [ACCESS_TOKEN_COOKIE]: 'token' },
      }),
    );
    expect(result.passedThrough).toBe(false);
    // Should fall back to the home page rather than looping back to login.
    const location = result.location ?? '';
    expect(location.endsWith('/en/')).toBe(true);
  });
});
