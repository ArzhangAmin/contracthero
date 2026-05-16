/**
 * Centralized constants for the Contracts module. No magic numbers/strings
 * scattered across services, controllers, or DTOs.
 */

/** Field length caps (UTF-16 code units, matching `@MaxLength`). */
export const MAX_TITLE_LENGTH = 200;
export const MAX_COUNTERPARTY_LENGTH = 200;
export const MAX_NOTES_LENGTH = 2000;

/** ISO 4217 currency codes are exactly 3 uppercase letters. */
export const CURRENCY_CODE_LENGTH = 3;

/** Decimal precision for monetary `value` column: NUMERIC(14, 2). */
export const VALUE_MAX_DECIMAL_PLACES = 2;

/**
 * Notice period upper bound. A notice period longer than ~10 years is almost
 * certainly a data-entry error and would also break the deadline engine math.
 */
export const MIN_NOTICE_PERIOD_DAYS = 0;
export const MAX_NOTICE_PERIOD_DAYS = 3650;

/** Pagination defaults & limits. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MIN_PAGE = 1;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;
