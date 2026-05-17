/**
 * Deadline status helpers used by the ContractList UI to colour-code
 * upcoming contract end dates.
 */

export const DEADLINE_SOON_THRESHOLD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEADLINE_STATUSES = ['expired', 'due_today', 'due_soon', 'on_track'] as const;
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number];

function toUtcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Returns the deadline bucket for the given end date relative to `now`.
 *
 * Comparison is done at calendar-day granularity in UTC to avoid timezone
 * drift between the server (where we compute the badge) and the client.
 *
 * @throws Error when `endDate` cannot be parsed.
 */
export function computeDeadlineStatus(endDate: string, now: Date = new Date()): DeadlineStatus {
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) {
    throw new Error(`Invalid endDate: ${endDate}`);
  }

  const diffDays = Math.floor((toUtcMidnight(end) - toUtcMidnight(now)) / MS_PER_DAY);

  if (diffDays < 0) {
    return 'expired';
  }
  if (diffDays === 0) {
    return 'due_today';
  }
  if (diffDays <= DEADLINE_SOON_THRESHOLD_DAYS) {
    return 'due_soon';
  }
  return 'on_track';
}
