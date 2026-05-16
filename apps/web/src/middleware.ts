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
    const redirectTarget = `${pathname}${search}`;
    loginUrl.searchParams.set('redirect', redirectTarget);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && authenticated) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = `/${locale}${POST_AUTH_REDIRECT_PATH}`;
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
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
