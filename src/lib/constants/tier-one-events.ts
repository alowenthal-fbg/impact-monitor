/**
 * Tier-one events for the big 5 North American sports leagues.
 *
 * Each event defines a `getDate(year)` function that returns the approximate
 * date for that year. Where possible, dates follow the league's scheduling
 * pattern (e.g. "first Sunday of February" for the Super Bowl). Fallback
 * dates are provided for events whose scheduling varies too much to model.
 *
 * `sport` must match the sport key used in the seasonality chart.
 */

export interface TierOneEvent {
  label: string;
  sport: string;
  abbrev: string;
  /** Returns the approximate event date for the given calendar year */
  getDate: (year: number) => Date;
}

/** Returns the Nth occurrence of a given weekday in a month.
 *  weekday: 0=Sun … 6=Sat; n: 1-based (1=first, 2=second, etc.) */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const firstDay = first.getDay();
  const offset = (weekday - firstDay + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(year, month, day);
}

/** Returns the last occurrence of a weekday in a month */
function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0); // last day of month
  const diff = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - diff);
}

export const TIER_ONE_EVENTS: TierOneEvent[] = [
  // ── NFL ──────────────────────────────────────────────────────────────
  {
    label: 'Super Bowl',
    sport: 'Football',
    abbrev: 'SB',
    // Second Sunday of February
    getDate: (y) => nthWeekdayOfMonth(y, 1, 0, 2),
  },
  {
    label: 'NFL Draft',
    sport: 'Football',
    abbrev: 'Draft',
    // Last Thursday of April
    getDate: (y) => lastWeekdayOfMonth(y, 3, 4),
  },
  {
    label: 'NFL Kickoff',
    sport: 'Football',
    abbrev: 'Kickoff',
    // First Thursday after Labor Day (first Monday of Sep)
    getDate: (y) => {
      const laborDay = nthWeekdayOfMonth(y, 8, 1, 1);
      return new Date(y, 8, laborDay.getDate() + 3);
    },
  },
  {
    label: 'NFL Single-Game Tickets On Sale',
    sport: 'Football',
    abbrev: 'Tix',
    // Second Wednesday of May (approximates post-schedule-release on-sale)
    getDate: (y) => nthWeekdayOfMonth(y, 4, 3, 2),
  },

  // ── MLB ──────────────────────────────────────────────────────────────
  {
    label: 'MLB Single-Game Tickets On Sale',
    sport: 'Baseball',
    abbrev: 'Tix',
    // Last Saturday of January (league-wide approximation)
    getDate: (y) => lastWeekdayOfMonth(y, 0, 6),
  },
  {
    label: 'MLB Opening Day',
    sport: 'Baseball',
    abbrev: 'Open',
    // Last Thursday of March
    getDate: (y) => lastWeekdayOfMonth(y, 2, 4),
  },
  {
    label: 'MLB All-Star Game',
    sport: 'Baseball',
    abbrev: 'ASG',
    // Second Tuesday of July
    getDate: (y) => nthWeekdayOfMonth(y, 6, 2, 2),
  },
  {
    label: 'World Series',
    sport: 'Baseball',
    abbrev: 'WS',
    // Last Friday of October
    getDate: (y) => lastWeekdayOfMonth(y, 9, 5),
  },

  // ── NBA ──────────────────────────────────────────────────────────────
  {
    label: 'NBA All-Star Weekend',
    sport: 'Basketball',
    abbrev: 'ASW',
    // Third Sunday of February
    getDate: (y) => nthWeekdayOfMonth(y, 1, 0, 3),
  },
  {
    label: 'NBA Finals',
    sport: 'Basketball',
    abbrev: 'Finals',
    // First Thursday of June
    getDate: (y) => nthWeekdayOfMonth(y, 5, 4, 1),
  },
  {
    label: 'NBA Single-Game Tickets On Sale',
    sport: 'Basketball',
    abbrev: 'Tix',
    // Last Tuesday of August (league-wide approximation)
    getDate: (y) => lastWeekdayOfMonth(y, 7, 2),
  },
  {
    label: 'NBA Season Opener',
    sport: 'Basketball',
    abbrev: 'Open',
    // Third Tuesday of October
    getDate: (y) => nthWeekdayOfMonth(y, 9, 2, 3),
  },

  // ── NHL ──────────────────────────────────────────────────────────────
  {
    label: 'Winter Classic',
    sport: 'Hockey',
    abbrev: 'WC',
    // January 1
    getDate: (y) => new Date(y, 0, 1),
  },
  {
    label: 'NHL Single-Game Tickets On Sale',
    sport: 'Hockey',
    abbrev: 'Tix',
    // Second Wednesday of September (approximates training-camp open)
    getDate: (y) => nthWeekdayOfMonth(y, 8, 3, 2),
  },
  {
    label: 'Stanley Cup Finals',
    sport: 'Hockey',
    abbrev: 'SCF',
    // First Saturday of June
    getDate: (y) => nthWeekdayOfMonth(y, 5, 6, 1),
  },
  {
    label: 'NHL Season Opener',
    sport: 'Hockey',
    abbrev: 'Open',
    // First Tuesday of October
    getDate: (y) => nthWeekdayOfMonth(y, 9, 2, 1),
  },

  // ── MLS ──────────────────────────────────────────────────────────────
  {
    label: 'MLS Season Opener',
    sport: 'Soccer',
    abbrev: 'Open',
    // Third Saturday of February
    getDate: (y) => nthWeekdayOfMonth(y, 1, 6, 3),
  },
  {
    label: 'MLS All-Star Game',
    sport: 'Soccer',
    abbrev: 'ASG',
    // Fourth Wednesday of July
    getDate: (y) => nthWeekdayOfMonth(y, 6, 3, 4),
  },
  {
    label: 'MLS Cup',
    sport: 'Soccer',
    abbrev: 'Cup',
    // First Saturday of December
    getDate: (y) => nthWeekdayOfMonth(y, 11, 6, 1),
  },
];
