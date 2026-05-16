import { ReminderType } from '@prisma/client';

/**
 * Thresholds (days) ke baraye har contract check mishe.
 * Order: descending (30 → 14 → 7 → 1) ta aval door-tarin threshold check beshe.
 */
export const DEADLINE_THRESHOLDS: ReadonlyArray<{
  days: number;
  reminderType: ReminderType;
}> = [
  { days: 30, reminderType: ReminderType.DAYS_30 },
  { days: 14, reminderType: ReminderType.DAYS_14 },
  { days: 7, reminderType: ReminderType.DAYS_7 },
  { days: 1, reminderType: ReminderType.DAYS_1 },
] as const;

/**
 * Default cron schedule: har roz saat 08:00 UTC.
 * Az env var DEADLINE_CRON_SCHEDULE override mishavad.
 */
export const DEFAULT_DEADLINE_CRON = '0 8 * * *';

/** Milliseconds dar yek rooz — baraye daysUntilEnd calculation */
export const MS_PER_DAY = 86_400_000;
