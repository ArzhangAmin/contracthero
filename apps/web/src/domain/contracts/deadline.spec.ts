import { describe, expect, it } from 'vitest';
import { computeDeadlineStatus, DEADLINE_SOON_THRESHOLD_DAYS } from './deadline';

const NOW = new Date('2025-06-15T12:00:00.000Z');

describe('computeDeadlineStatus', () => {
  it('returns "expired" when end date is in the past', () => {
    expect(computeDeadlineStatus('2025-06-14', NOW)).toBe('expired');
    expect(computeDeadlineStatus('2024-01-01', NOW)).toBe('expired');
  });

  it('returns "due_today" when end date equals today (UTC)', () => {
    expect(computeDeadlineStatus('2025-06-15', NOW)).toBe('due_today');
  });

  it('returns "due_soon" inside the warning window', () => {
    expect(computeDeadlineStatus('2025-06-16', NOW)).toBe('due_soon');
    expect(computeDeadlineStatus('2025-07-15', NOW)).toBe('due_soon');
  });

  it('returns "on_track" beyond the warning window', () => {
    const justOutside = new Date(NOW);
    justOutside.setUTCDate(justOutside.getUTCDate() + DEADLINE_SOON_THRESHOLD_DAYS + 1);
    expect(computeDeadlineStatus(justOutside.toISOString(), NOW)).toBe('on_track');
  });

  it('throws on invalid input', () => {
    expect(() => computeDeadlineStatus('not-a-date', NOW)).toThrowError(/Invalid endDate/);
  });
});
