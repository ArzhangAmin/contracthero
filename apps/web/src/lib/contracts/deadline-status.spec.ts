import { describe, expect, it } from 'vitest';
import {
  ENDING_SOON_THRESHOLD_DAYS,
  computeDeadlineStatus,
} from './deadline-status';

const NOW = new Date('2025-06-01T12:00:00.000Z');

function daysFromNow(days: number): string {
  const base = new Date('2025-06-01T00:00:00.000Z');
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

describe('computeDeadlineStatus', () => {
  it('CANCELLED status hamishe state=CANCELLED bargardune (bedoone hesabe ruz)', () => {
    const result = computeDeadlineStatus(
      { status: 'CANCELLED', endDate: daysFromNow(100), noticePeriodDays: null },
      NOW,
    );
    expect(result).toEqual({ state: 'CANCELLED', daysUntilEnd: null });
  });

  it('EXPIRED status state=EXPIRED bargardune', () => {
    const result = computeDeadlineStatus(
      { status: 'EXPIRED', endDate: daysFromNow(5), noticePeriodDays: null },
      NOW,
    );
    expect(result.state).toBe('EXPIRED');
    expect(result.daysUntilEnd).toBe(5);
  });

  it('age endDate dar gozashte bashe, EXPIRED bargardune ham age status ACTIVE bashe', () => {
    const result = computeDeadlineStatus(
      { status: 'ACTIVE', endDate: daysFromNow(-1), noticePeriodDays: null },
      NOW,
    );
    expect(result.state).toBe('EXPIRED');
    expect(result.daysUntilEnd).toBe(-1);
  });

  it('age daysUntilEnd dar notice period bashe, NOTICE_PERIOD bargardune', () => {
    const result = computeDeadlineStatus(
      { status: 'ACTIVE', endDate: daysFromNow(60), noticePeriodDays: 90 },
      NOW,
    );
    expect(result.state).toBe('NOTICE_PERIOD');
    expect(result.daysUntilEnd).toBe(60);
  });

  it('marz-e notice period (daysUntilEnd === noticePeriodDays) niz NOTICE_PERIOD ast', () => {
    const result = computeDeadlineStatus(
      { status: 'ACTIVE', endDate: daysFromNow(30), noticePeriodDays: 30 },
      NOW,
    );
    expect(result.state).toBe('NOTICE_PERIOD');
  });

  it('age noticePeriodDays null bashe, NOTICE_PERIOD trigger nemishe', () => {
    const result = computeDeadlineStatus(
      { status: 'ACTIVE', endDate: daysFromNow(40), noticePeriodDays: null },
      NOW,
    );
    expect(result.state).toBe('ACTIVE');
  });

  it('daysUntilEnd <= ENDING_SOON_THRESHOLD_DAYS state=ENDING_SOON ast', () => {
    const result = computeDeadlineStatus(
      {
        status: 'ACTIVE',
        endDate: daysFromNow(ENDING_SOON_THRESHOLD_DAYS),
        noticePeriodDays: null,
      },
      NOW,
    );
    expect(result.state).toBe('ENDING_SOON');
    expect(result.daysUntilEnd).toBe(ENDING_SOON_THRESHOLD_DAYS);
  });

  it('balatar az threshold ACTIVE bargardune', () => {
    const result = computeDeadlineStatus(
      {
        status: 'ACTIVE',
        endDate: daysFromNow(ENDING_SOON_THRESHOLD_DAYS + 1),
        noticePeriodDays: null,
      },
      NOW,
    );
    expect(result.state).toBe('ACTIVE');
  });

  it('NOTICE_PERIOD nesbat be ENDING_SOON olaviyat dare', () => {
    // 10 days remaining (within ending-soon 30-day threshold) but ALSO
    // within the notice period — notice period should win.
    const result = computeDeadlineStatus(
      { status: 'ACTIVE', endDate: daysFromNow(10), noticePeriodDays: 14 },
      NOW,
    );
    expect(result.state).toBe('NOTICE_PERIOD');
  });

  it('endDate naa-motabar ra defensively handle mikone', () => {
    const result = computeDeadlineStatus(
      { status: 'ACTIVE', endDate: 'not-a-date', noticePeriodDays: null },
      NOW,
    );
    expect(result.state).toBe('ACTIVE');
    expect(result.daysUntilEnd).toBeNull();
  });

  it('endDate naa-motabar va status=EXPIRED → EXPIRED ba daysUntilEnd null', () => {
    const result = computeDeadlineStatus(
      { status: 'EXPIRED', endDate: 'invalid', noticePeriodDays: null },
      NOW,
    );
    expect(result).toEqual({ state: 'EXPIRED', daysUntilEnd: null });
  });

  it('endDate be onvane Date object ham kar mikone', () => {
    const end = new Date('2025-06-15T00:00:00.000Z');
    const result = computeDeadlineStatus(
      { status: 'ACTIVE', endDate: end, noticePeriodDays: null },
      NOW,
    );
    expect(result.daysUntilEnd).toBe(14);
    expect(result.state).toBe('ENDING_SOON');
  });
});
