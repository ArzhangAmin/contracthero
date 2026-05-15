/**
 * Barrel that re-exports the canonical auth constants from
 * `./constants/auth.constants` plus shared validation limits.
 *
 * Kept as a thin shim so other modules can import from `auth/constants`.
 */
export * from './constants/auth.constants';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_NAME_LENGTH = 100;
