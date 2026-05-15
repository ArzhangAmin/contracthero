/**
 * Barrel that re-exports the canonical auth constants from
 * `./constants/auth.constants` plus shared validation limits.
 *
 * Kept as a thin shim so other modules can import from `auth/constants`.
 */
export * from './constants/auth.constants';

export const MIN_PASSWORD_LENGTH = 8;

/**
 * bcrypt silently truncates its input to the first 72 bytes. If we accept
 * passwords longer than 72 bytes, two distinct passwords sharing the same
 * 72-byte UTF-8 prefix would hash to the same value and authenticate against
 * one another. We therefore cap the password at exactly the bcrypt limit and
 * enforce the bound on UTF-8 byte length (not character count) so that
 * multi-byte characters cannot smuggle the input past the limit.
 *
 * See: https://en.wikipedia.org/wiki/Bcrypt#User_input
 */
export const BCRYPT_MAX_PASSWORD_BYTES = 72;
export const MAX_PASSWORD_LENGTH = BCRYPT_MAX_PASSWORD_BYTES;

export const MAX_EMAIL_LENGTH = 254;
export const MAX_NAME_LENGTH = 100;
