import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { isValidLocale, type Locale } from './i18n/locale-utils';
import {
  ACCESS_TOKEN_COOKIE,
  AUTH_ONLY_PATH_PREFIXES,
  LOGIN_PATH,
  POST_AUTH_REDIRECT_PATH,
  PROTECTED_PATH_PREFIXES,
  REFRESH_TOKEN_COOKIE,
} from './lib/auth/constants';
import { sanitizeRedirectPath } from './lib/auth/safe-redirect';

const intlMiddleware = createIntlMiddleware(routing);

interface LocalePathMatch {
  locale: Locale;
  pathWithoutLocale: string;
}

function matchLocalePath(pathname: string): LocalePathMatch {
  const segments = pathname.split('/').filter(Boolean);
  const [firstSegment, ...rest] = segments;
  if (firstSegment !== undefined && isValidLocale(firstSegment)) {
    return {
      locale: firstSegment,
      pathWithoutLocale: `/${rest.join('/')}` || '/',
    };
  }
  return {
    locale: routing.defaultLocale,
    pathWithoutLocale: pathname || '/',
  };
}

function matchesAnyPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function hasAuthCookie(request: NextRequest): boolean {
  return (
    request.cookies.has(ACCESS_TOKEN_COOKIE) ||
    request.cookies.has(REFRESH_TOKEN_COOKIE)
  );
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const { locale, pathWithoutLocale } = matchLocalePath(pathname);

  const isAuthPage = matchesAnyPrefix(pathWithoutLocale, AUTH_ONLY_PATH_PREFIXES);
  const isProtectedPage = matchesAnyPrefix(pathWithoutLocale, PROTECTED_PATH_PREFIXES);
  const authenticated = hasAuthCookie(request);

  if (isProtectedPage && !authenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}${LOGIN_PATH}`;
    loginUrl.search = '';
    // `pathname` and `search` come from the incoming request URL (an origin
    // we control) so they're already a safe relative path. `searchParams.set`
    // handles URL-encoding for us.
    const redirectTarget = `${pathname}${search}`;
    loginUrl.searchParams.set('redirect', redirectTarget);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && authenticated) {
    // If the user is already authenticated and visits the login/register
    // page with `?redirect=<path>`, honour the redirect (subject to the
    // same-origin validation) instead of dropping them on the home page.
    const candidateRedirect = request.nextUrl.searchParams.get('redirect');
    const safeRedirect = sanitizeRedirectPath(candidateRedirect);

    const targetUrl = request.nextUrl.clone();
    if (safeRedirect !== null) {
      const parsed = new URL(safeRedirect, request.nextUrl.origin);
      targetUrl.pathname = parsed.pathname;
      targetUrl.search = parsed.search;
      targetUrl.hash = parsed.hash;
    } else {
      targetUrl.pathname = `/${locale}${POST_AUTH_REDIRECT_PATH}`;
      targetUrl.search = '';
      targetUrl.hash = '';
    }
    return NextResponse.redirect(targetUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  /**
   * Skip Next.js internals, static files, and API routes.
   * Everything else flows through the locale + auth guard.
   */
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
