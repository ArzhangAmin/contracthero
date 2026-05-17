/**
 * Pure helpers that compute the *deadline state* of a contract — the
 * decision input for the `DeadlineStatusBadge` UI component.
 *
 * The state derives from three signals:
 *  - `status`         — explicit lifecycle marker (ACTIVE/EXPIRED/CANCELLED).
 *  - `endDate`        — calendar deadline (string ISO from the API).
 *  - `noticePeriodDays` — notice window required to cancel (nullable).
 *
 * State precedence (top wins):
 *   CANCELLED      → explicit status === 'CANCELLED'
 *   EXPIRED        → status === 'EXPIRED' OR endDate is in the past
 *   NOTICE_PERIOD  → today falls within `noticePeriodDays` of endDate
 *   ENDING_SOON    → endDate within ENDING_SOON_THRESHOLD_DAYS
 *   ACTIVE         → everything else
 *
 * All math is done on **UTC calendar days** to avoid DST/timezone drift —
 * "10 days until expiry" should mean the same thing in Berlin and Tehran.
 */

import type { Contract, ContractStatus } from './types';

export type DeadlineState =
  | 'CANCELLED'
  | 'EXPIRED'
  | 'NOTICE_PERIOD'
  | 'ENDING_SOON'
  | 'ACTIVE';

/** A contract is "ending soon" when it expires within this many days. */
export const ENDING_SOON_THRESHOLD_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DeadlineComputationInput {
  status: ContractStatus;
  endDate: string | Date;
  noticePeriodDays: number | null;
}

export interface DeadlineComputation {
  state: DeadlineState;
  /**
   * Whole days from today (UTC) to endDate.
   * Negative when the deadline is in the past.
   * `null` when the input is unparseable.
   */
  daysUntilEnd: number | null;
}

function toUtcMidnight(value: string | Date): Date | null {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
}

/**
 * Computes the deadline state and `daysUntilEnd` for a contract.
 *
 * @param input  Deadline-relevant subset of a contract.
 * @param now    Reference "now" — injectable so tests can pin the clock.
 */
export function computeDeadlineStatus(
  input: DeadlineComputationInput,
  now: Date = new Date(),
): DeadlineComputation {
  if (input.status === 'CANCELLED') {
    return { state: 'CANCELLED', daysUntilEnd: null };
  }

  const todayUtc = toUtcMidnight(now);
  const endUtc = toUtcMidnight(input.endDate);

  if (todayUtc === null || endUtc === null) {
    // Defensive fallback: treat as EXPIRED if the lifecycle says so,
    // otherwise ACTIVE. We refuse to invent a `daysUntilEnd`.
    return {
      state: input.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
      daysUntilEnd: null,
    };
  }

  const daysUntilEnd = Math.round(
    (endUtc.getTime() - todayUtc.getTime()) / MS_PER_DAY,
  );

  if (input.status === 'EXPIRED' || daysUntilEnd < 0) {
    return { state: 'EXPIRED', daysUntilEnd };
  }

  if (
    input.noticePeriodDays !== null &&
    input.noticePeriodDays >= 0 &&
    daysUntilEnd <= input.noticePeriodDays
  ) {
    return { state: 'NOTICE_PERIOD', daysUntilEnd };
  }

  if (daysUntilEnd <= ENDING_SOON_THRESHOLD_DAYS) {
    return { state: 'ENDING_SOON', daysUntilEnd };
  }

  return { state: 'ACTIVE', daysUntilEnd };
}

/** Narrow `Contract` to just the fields that drive the deadline state. */
export function getDeadlineInput(contract: Contract): DeadlineComputationInput {
  return {
    status: contract.status,
    endDate: contract.endDate,
    noticePeriodDays: contract.noticePeriodDays,
  };
}
