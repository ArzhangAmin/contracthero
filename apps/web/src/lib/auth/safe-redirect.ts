/**
 * Helpers for safely handling the `?redirect=` query parameter used by the
 * auth flow (e.g. middleware redirects unauthenticated users to
 * `/<locale>/auth/login?redirect=<original-path>`, and the login page sends
 * the user back to `<original-path>` after a successful sign-in).
 *
 * Untrusted input from the URL must never be passed directly to a navigation
 * call — an attacker can craft links like
 *   /en/auth/login?redirect=https://evil.example
 *   /en/auth/login?redirect=//evil.example
 *   /en/auth/login?redirect=/\evil.example
 * to abuse our domain as an open-redirect for phishing.
 *
 * The contract of {@link sanitizeRedirectPath} is intentionally strict:
 *   - input MUST be a string starting with a single `/`
 *   - input MUST NOT start with `//` or `/\` (protocol-relative / browser quirks)
 *   - input MUST NOT contain control characters / newlines / whitespace
 *   - input MUST resolve to the same origin when parsed as a URL
 *   - input MUST NOT itself point back at an auth page (prevents loops)
 *
 * Any value that fails validation is rejected by returning `null` so the
 * caller can fall back to a known-safe default (the post-auth landing page).
 */

import { AUTH_ONLY_PATH_PREFIXES } from './constants';
import { isValidLocale, type Locale } from '../../i18n/locale-utils';

/**
 * Base origin used purely as a reference point when resolving the candidate
 * path with `new URL()`. The value itself is never sent anywhere — it just
 * has to be a valid, well-known origin so the URL parser can decide whether
 * the candidate is same-origin.
 */
const REFERENCE_ORIGIN = 'http://localhost';

/**
 * Strips the leading locale segment from a path (if present).
 * `/en/dashboard` -> `/dashboard`
 * `/dashboard`    -> `/dashboard`
 */
function stripLocalePrefix(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const [first, ...rest] = segments;
  if (first !== undefined && isValidLocale(first)) {
    return `/${rest.join('/')}` || '/';
  }
  return path;
}

function pointsAtAuthPage(path: string): boolean {
  const withoutLocale = stripLocalePrefix(path);
  return AUTH_ONLY_PATH_PREFIXES.some(
    (prefix) => withoutLocale === prefix || withoutLocale.startsWith(`${prefix}/`),
  );
}

/**
 * Returns the candidate path verbatim if it is a safe, same-origin relative
 * URL; returns `null` otherwise so the caller can substitute a default.
 *
 * @param candidate Untrusted value from `?redirect=` or a form prop.
 */
export function sanitizeRedirectPath(candidate: unknown): string | null {
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return null;
  }

  // Reject anything containing whitespace / control chars — these can be
  // used to smuggle a second URL past naive parsers.
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(candidate)) {
    return null;
  }

  // Must be an absolute path on our origin. Reject protocol-relative URLs
  // (`//evil.com`) and the `/\` browser quirk.
  if (!candidate.startsWith('/')) {
    return null;
  }
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return null;
  }

  // Defence-in-depth: resolve via WHATWG URL and confirm origin equality.
  let resolved: URL;
  try {
    resolved = new URL(candidate, REFERENCE_ORIGIN);
  } catch {
    return null;
  }
  if (resolved.origin !== REFERENCE_ORIGIN) {
    return null;
  }

  // Prevent redirect loops back into the auth flow.
  if (pointsAtAuthPage(resolved.pathname)) {
    return null;
  }

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

/**
 * Convenience: return {@link sanitizeRedirectPath} or the default
 * post-auth landing page for the given locale.
 */
export function resolveRedirectTarget(
  candidate: unknown,
  locale: Locale,
  fallbackPath: string,
): string {
  const safe = sanitizeRedirectPath(candidate);
  if (safe !== null) {
    return safe;
  }
  return `/${locale}${fallbackPath}`;
}
