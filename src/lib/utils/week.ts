import { startOfWeek, endOfWeek, getDay, format, addDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const ET_TIMEZONE = 'America/New_York';

/**
 * Returns the Monday 00:00:00 ET for the week containing the given date.
 */
export function getWeekStart(date: Date): Date {
  const etDate = toZonedTime(date, ET_TIMEZONE);
  const weekStart = startOfWeek(etDate, { weekStartsOn: 1 });
  weekStart.setHours(0, 0, 0, 0);
  return fromZonedTime(weekStart, ET_TIMEZONE);
}

/**
 * Returns the Sunday 23:59:59 ET for the week containing the given date.
 */
export function getWeekEnd(date: Date): Date {
  const etDate = toZonedTime(date, ET_TIMEZONE);
  const weekEnd = endOfWeek(etDate, { weekStartsOn: 1 });
  weekEnd.setHours(23, 59, 59, 999);
  return fromZonedTime(weekEnd, ET_TIMEZONE);
}

/**
 * Returns the Monday 00:00:00 ET for the current week.
 */
export function getCurrentWeek(): Date {
  return getWeekStart(new Date());
}

/**
 * Returns true if the given date (or today) is a Monday in ET timezone.
 */
export function isMonday(date?: Date): boolean {
  const checkDate = date || new Date();
  const etDate = toZonedTime(checkDate, ET_TIMEZONE);
  return getDay(etDate) === 1;
}

/**
 * Returns the ISO week number for a date string (yyyy-MM-dd).
 */
export function getISOWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  const thursday = new Date(date);
  thursday.setDate(thursday.getDate() + (4 - (thursday.getDay() || 7)));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Formats a week_start date string as "Mon D - Mon D (W##)" (e.g., "Apr 20 - Apr 26 (W17)").
 */
export function formatWeekLabel(weekStartStr: string): string {
  const weekStart = new Date(weekStartStr + 'T00:00:00');
  const weekEnd = addDays(weekStart, 6);
  const weekNum = getISOWeekNumber(weekStartStr);
  return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')} (W${weekNum})`;
}
