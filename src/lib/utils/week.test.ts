import { describe, it, expect } from 'vitest';
import { toZonedTime } from 'date-fns-tz';
import { getWeekStart, getWeekEnd, getCurrentWeek, isMonday, getISOWeekNumber, formatWeekLabel } from './week';

const ET = 'America/New_York';

function toET(date: Date) {
  return toZonedTime(date, ET);
}

describe('Week Boundary Utility', () => {
  describe('getWeekStart', () => {
    it('returns Monday for a Wednesday input', () => {
      // 2026-04-29 is a Wednesday
      const wednesday = new Date('2026-04-29T12:00:00Z');
      const result = toET(getWeekStart(wednesday));
      expect(result.getDay()).toBe(1); // Monday
    });

    it('returns the same Monday date if input is already Monday', () => {
      // 2026-04-27 is a Monday
      const monday = new Date('2026-04-27T15:00:00Z');
      const result = toET(getWeekStart(monday));
      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(27);
    });

    it('returns Monday for a Sunday input (end of week)', () => {
      // 2026-05-03 is a Sunday
      const sunday = new Date('2026-05-03T12:00:00Z');
      const result = toET(getWeekStart(sunday));
      expect(result.getDay()).toBe(1);
      expect(result.getDate()).toBe(27);
    });

    it('returns midnight ET', () => {
      const date = new Date('2026-04-29T12:00:00Z');
      const result = toET(getWeekStart(date));
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe('getWeekEnd', () => {
    it('returns Sunday for a Wednesday input', () => {
      const wednesday = new Date('2026-04-29T12:00:00Z');
      const result = toET(getWeekEnd(wednesday));
      expect(result.getDay()).toBe(0); // Sunday
    });

    it('returns 23:59:59 ET', () => {
      const wednesday = new Date('2026-04-29T12:00:00Z');
      const result = toET(getWeekEnd(wednesday));
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
    });

    it('returns correct Sunday for a Monday input', () => {
      // 2026-04-27 is Monday, week end should be 2026-05-03 (Sunday)
      const monday = new Date('2026-04-27T12:00:00Z');
      const result = toET(getWeekEnd(monday));
      expect(result.getDay()).toBe(0);
      expect(result.getMonth()).toBe(4); // May (0-indexed)
      expect(result.getDate()).toBe(3);
    });
  });

  describe('getCurrentWeek', () => {
    it('returns a Monday', () => {
      const result = toET(getCurrentWeek());
      expect(result.getDay()).toBe(1);
    });

    it('returns a date in the past or today', () => {
      const result = getCurrentWeek();
      expect(result.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('isMonday', () => {
    it('returns true for a Monday date', () => {
      const monday = new Date('2026-04-27T12:00:00Z');
      expect(isMonday(monday)).toBe(true);
    });

    it('returns false for a Wednesday date', () => {
      const wednesday = new Date('2026-04-29T12:00:00Z');
      expect(isMonday(wednesday)).toBe(false);
    });

    it('returns false for a Sunday date', () => {
      const sunday = new Date('2026-05-03T12:00:00Z');
      expect(isMonday(sunday)).toBe(false);
    });

    it('handles ET timezone edge case: late Sunday UTC is still Sunday ET', () => {
      // 2026-05-03 Sunday at 23:00 UTC = Sunday 19:00 ET (EDT offset = -4)
      const lateSundayUTC = new Date('2026-05-03T23:00:00Z');
      expect(isMonday(lateSundayUTC)).toBe(false);
    });

    it('handles ET timezone edge case: early Monday UTC is Monday ET', () => {
      // 2026-04-27 Monday at 10:00 UTC = Monday 06:00 ET
      const earlyMondayUTC = new Date('2026-04-27T10:00:00Z');
      expect(isMonday(earlyMondayUTC)).toBe(true);
    });

    it('handles ET timezone edge case: very early Monday UTC is still Sunday ET', () => {
      // 2026-04-27 Monday at 03:00 UTC = Sunday 23:00 ET (EDT is UTC-4)
      const veryEarlyMondayUTC = new Date('2026-04-27T03:00:00Z');
      expect(isMonday(veryEarlyMondayUTC)).toBe(false);
    });
  });

  describe('getISOWeekNumber', () => {
    it('returns W17 for April 20, 2026 (Monday)', () => {
      expect(getISOWeekNumber('2026-04-20')).toBe(17);
    });

    it('returns W17 for April 26, 2026 (Sunday)', () => {
      expect(getISOWeekNumber('2026-04-26')).toBe(17);
    });

    it('returns W18 for April 27, 2026 (Monday)', () => {
      expect(getISOWeekNumber('2026-04-27')).toBe(18);
    });

    it('returns W1 for Jan 5, 2026 (Monday)', () => {
      expect(getISOWeekNumber('2026-01-05')).toBe(2);
    });
  });

  describe('formatWeekLabel', () => {
    it('formats Apr 20-26 as "Apr 20 - Apr 26 (W17)"', () => {
      expect(formatWeekLabel('2026-04-20')).toBe('Apr 20 - Apr 26 (W17)');
    });

    it('handles month boundary: Apr 27 - May 3', () => {
      expect(formatWeekLabel('2026-04-27')).toBe('Apr 27 - May 3 (W18)');
    });
  });
});
