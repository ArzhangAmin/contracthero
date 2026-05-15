/**
 * Centralized auth constants. No magic numbers/strings scattered across the module.
 */
export const BCRYPT_SALT_ROUNDS = 12;

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export const DEFAULT_ACCESS_EXPIRES_IN = '15m';
export const DEFAULT_REFRESH_EXPIRES_IN = '7d';

/** Cookie maxAge fallbacks in milliseconds, used only if env-derived values are missing. */
export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const TOKEN_TYPE_ACCESS = 'access' as const;
export const TOKEN_TYPE_REFRESH = 'refresh' as const;

export type TokenType = typeof TOKEN_TYPE_ACCESS | typeof TOKEN_TYPE_REFRESH;
