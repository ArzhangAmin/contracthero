/**
 * Centralised auth-related constants for the web app.
 * Avoid duplicating these strings inline anywhere else.
 */

import type { ApiLocale } from './types';
import type { Locale } from '../../i18n/locale-utils';

/** Path segment (without locale prefix) of the login page. */
export const LOGIN_PATH = '/auth/login';

/** Path segment (without locale prefix) of the register page. */
export const REGISTER_PATH = '/auth/register';

/** Path the user is sent to after a successful login/register. */
export const POST_AUTH_REDIRECT_PATH = '/';

/** Auth cookie names — must match apps/api/src/auth/constants/auth.constants.ts. */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Path segments (without locale prefix) that require authentication. */
export const PROTECTED_PATH_PREFIXES: readonly string[] = ['/dashboard'];

/** Path segments (without locale prefix) that should redirect away if already authenticated. */
export const AUTH_ONLY_PATH_PREFIXES: readonly string[] = [LOGIN_PATH, REGISTER_PATH];

const LOCALE_TO_API_LOCALE: Record<Locale, ApiLocale> = {
  de: 'DE',
  en: 'EN',
  fa: 'FA',
};

/** Map a UI locale (lower-case) to the API enum value (upper-case). */
export function toApiLocale(locale: Locale): ApiLocale {
  return LOCALE_TO_API_LOCALE[locale];
}
