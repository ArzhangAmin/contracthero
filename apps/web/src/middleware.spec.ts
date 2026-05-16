import { describe, expect, it, vi } from 'vitest';

const intlResponse = { kind: 'intl-pass' };

vi.mock('next-intl/middleware', () => ({
  default: vi.fn(() => vi.fn(() => intlResponse)),
}));

import { middleware } from './middleware';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './lib/auth/constants';

interface MockRequestOptions {
  pathname: string;
  cookies?: Record<string, string>;
}

interface MockRequest {
  nextUrl: URL & { clone(): URL };
  cookies: {
    has(name: string): boolean;
  };
}

function buildRequest({ pathname, cookies = {} }: MockRequestOptions): MockRequest {
  const base = `http://localhost:3000${pathname}`;
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
});
