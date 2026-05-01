# Story 1.4: Data Reconciliation & Weekly Aggregation

Status: review

## Story

As an admin,
I want Ticketmaster and Snowflake data reconciled at the date level with Monday-Sunday weekly summaries,
So that I have a single trustworthy dataset for reporting.

## Acceptance Criteria

1. **Given** both Ticketmaster and Snowflake data exist in `daily_metrics` for overlapping dates
   **When** reconciliation runs
   **Then** the system merges both sources at the date level without a shared join key (matching by `metric_date`)
   **And** produces reconciled rows with `source='reconciled'` combining TM fields (orders, gtv, sport, event_name) with Snowflake fields (face_value, gross_profit, tickets_sold from Snowflake's tickets_purchased)

2. **Given** the shared week boundary utility is implemented
   **When** `getWeekStart(date)` is called
   **Then** it returns the Monday 00:00:00 ET for the week containing that date
   **And** `getWeekEnd(date)` returns Sunday 23:59:59 ET
   **And** `getCurrentWeek()` returns the current week's Monday
   **And** `isMonday()` returns true only on Mondays
   **And** all functions use `date-fns` with `America/New_York` timezone

3. **Given** reconciled daily data exists in `daily_metrics` with `source='reconciled'`
   **When** the `weekly_summary` SQL view is queried
   **Then** it returns weekly aggregates (total tickets, orders, GTV, face value, gross profit) grouped by Monday-Sunday boundaries
   **And** includes week-over-week deltas for comparison

## Tasks / Subtasks

- [x] Task 1: Install date handling dependencies (AC: #2)
  - [x] Run `pnpm add date-fns date-fns-tz`
  - [x] Run `pnpm add -D vitest @vitest/ui` (if not already present)
  - [x] Verify installation in `package.json`

- [x] Task 2: Create shared week boundary utility (AC: #2)
  - [x] Create `src/lib/utils/week.ts`
  - [x] Implement `getWeekStart(date: Date): Date` — returns Monday 00:00:00 ET
  - [x] Implement `getWeekEnd(date: Date): Date` — returns Sunday 23:59:59 ET
  - [x] Implement `getCurrentWeek(): Date` — returns this week's Monday
  - [x] Implement `isMonday(date?: Date): boolean` — checks if date (or today) is Monday
  - [x] All functions use `date-fns` with `America/New_York` timezone via `date-fns-tz`

- [x] Task 3: Test week boundary utility (AC: #2)
  - [x] Create `src/lib/utils/week.test.ts` (co-located test)
  - [x] Test `getWeekStart()` returns Monday for various input dates
  - [x] Test `getWeekEnd()` returns Sunday 23:59:59 for various input dates
  - [x] Test `getCurrentWeek()` returns current week's Monday
  - [x] Test `isMonday()` returns true on Mondays, false otherwise
  - [x] Test timezone handling (ET vs UTC edge cases)
  - [x] Run tests: `pnpm vitest run src/lib/utils/week.test.ts`

- [x] Task 4: Create reconciliation module (AC: #1)
  - [x] Create `src/lib/pipeline/reconcile.ts`
  - [x] Implement `reconcileDailyMetrics(startDate: string, endDate: string): Promise<void>`
  - [x] Query `daily_metrics` for TM data (`source='tm_api'`) in date range
  - [x] Query `daily_metrics` for Snowflake data (`source='snowflake'`) in date range
  - [x] Merge by `metric_date`: TM provides orders, gtv, sport, event_name; Snowflake provides face_value, gross_profit, tickets_sold
  - [x] Write reconciled rows to `daily_metrics` with `source='reconciled'`
  - [x] Use Supabase service role client for writes
  - [x] Handle cases where only one source has data for a date (write partial reconciled row with nulls for missing fields)

- [x] Task 5: Verify weekly_summary view (AC: #3)
  - [x] Confirm `weekly_summary` SQL view exists in `supabase/schema.sql` (created in Story 1.1)
  - [x] Verify view uses Monday-Sunday boundaries via `date_trunc('week', metric_date + INTERVAL '1 day') - INTERVAL '1 day'`
  - [x] Verify view filters `WHERE source = 'reconciled'`
  - [x] Test query: `SELECT * FROM weekly_summary ORDER BY week_start DESC LIMIT 5`
  - [x] Verify aggregates: `total_tickets`, `total_orders`, `total_gtv`, `total_face_value`, `total_gross_profit`

- [x] Task 6: Add reconciliation to pipeline orchestrator (integration point for Story 1.5)
  - [x] Document: reconciliation will be called from `src/app/api/cron/daily-refresh/route.ts` after TM and Snowflake ingestion complete
  - [x] Document: reconciliation date range should be last 7-14 days to handle late-arriving data
  - [x] Document: reconciliation errors should be logged to `pipeline_runs` table with stage='reconciliation'

## Dev Notes

### Project Structure Notes

```
src/
├── lib/
│   ├── pipeline/
│   │   └── reconcile.ts          # Reconciliation logic (NEW)
│   └── utils/
│       ├── week.ts                # Week boundary utility (NEW)
│       └── week.test.ts           # Co-located tests (NEW)
└── app/
    └── api/
        └── cron/
            └── daily-refresh/
                └── route.ts       # Will call reconcile() in Story 1.5
```

### Week Boundary Utility Implementation

```typescript
// src/lib/utils/week.ts
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

const ET_TIMEZONE = 'America/New_York';

/**
 * Returns the Monday 00:00:00 ET for the week containing the given date.
 * Uses ISO weeks (Monday start).
 */
export function getWeekStart(date: Date): Date {
  const etDate = utcToZonedTime(date, ET_TIMEZONE);
  const weekStart = startOfWeek(etDate, { weekStartsOn: 1 }); // 1 = Monday
  return zonedTimeToUtc(weekStart, ET_TIMEZONE);
}

/**
 * Returns the Sunday 23:59:59 ET for the week containing the given date.
 */
export function getWeekEnd(date: Date): Date {
  const etDate = utcToZonedTime(date, ET_TIMEZONE);
  const weekEnd = endOfWeek(etDate, { weekStartsOn: 1 }); // 1 = Monday
  const endOfDay = new Date(weekEnd);
  endOfDay.setHours(23, 59, 59, 999);
  return zonedTimeToUtc(endOfDay, ET_TIMEZONE);
}

/**
 * Returns the Monday 00:00:00 ET for the current week.
 */
export function getCurrentWeek(): Date {
  return getWeekStart(new Date());
}

/**
 * Returns true if the given date (or today if not provided) is a Monday in ET timezone.
 */
export function isMonday(date?: Date): boolean {
  const checkDate = date || new Date();
  const etDate = utcToZonedTime(checkDate, ET_TIMEZONE);
  return etDate.getDay() === 1; // 1 = Monday
}
```

### Reconciliation Strategy

**Merge Logic:**
- For each `metric_date` in the date range:
  - Fetch TM row: `SELECT * FROM daily_metrics WHERE metric_date = $date AND source = 'tm_api'`
  - Fetch Snowflake row: `SELECT * FROM daily_metrics WHERE metric_date = $date AND source = 'snowflake'`
  - Create reconciled row:
    - `metric_date` = date
    - `orders` = TM.orders
    - `gtv` = TM.gtv
    - `sport` = TM.sport
    - `event_name` = TM.event_name
    - `face_value` = Snowflake.face_value
    - `gross_profit` = Snowflake.gross_profit
    - `tickets_sold` = Snowflake.tickets_purchased (renamed for consistency)
    - `source` = 'reconciled'
  - Upsert to `daily_metrics` with UNIQUE constraint on `(metric_date, event_name, source)`

**Handling Missing Data:**
- If TM data exists but Snowflake does not: write reconciled row with TM fields populated, Snowflake fields null
- If Snowflake data exists but TM does not: write reconciled row with Snowflake fields populated, TM fields null
- If neither exists: skip date (no reconciled row)

**Date Range:**
- Reconciliation should process the last 7-14 days to handle late-arriving data
- Called after both TM and Snowflake ingestion complete in the daily pipeline

### Reconciliation Implementation

```typescript
// src/lib/pipeline/reconcile.ts
import { createServerClient } from '@/lib/supabase/server';
import type { DailyMetric } from '@/lib/supabase/types';

/**
 * Reconciles Ticketmaster and Snowflake data for the given date range.
 * Creates reconciled rows in daily_metrics combining both sources.
 */
export async function reconcileDailyMetrics(
  startDate: string, // ISO date "2026-04-20"
  endDate: string     // ISO date "2026-04-30"
): Promise<void> {
  const supabase = createServerClient();

  // Fetch TM data for date range
  const { data: tmData, error: tmError } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('source', 'tm_api')
    .gte('metric_date', startDate)
    .lte('metric_date', endDate);

  if (tmError) throw new Error(`Failed to fetch TM data: ${tmError.message}`);

  // Fetch Snowflake data for date range
  const { data: sfData, error: sfError } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('source', 'snowflake')
    .gte('metric_date', startDate)
    .lte('metric_date', endDate);

  if (sfError) throw new Error(`Failed to fetch Snowflake data: ${sfError.message}`);

  // Group by metric_date
  const tmByDate = new Map<string, DailyMetric>();
  tmData?.forEach(row => tmByDate.set(row.metric_date, row));

  const sfByDate = new Map<string, DailyMetric>();
  sfData?.forEach(row => sfByDate.set(row.metric_date, row));

  // Get all unique dates
  const allDates = new Set([...tmByDate.keys(), ...sfByDate.keys()]);

  // Create reconciled rows
  const reconciledRows: Partial<DailyMetric>[] = [];

  for (const date of allDates) {
    const tmRow = tmByDate.get(date);
    const sfRow = sfByDate.get(date);

    reconciledRows.push({
      metric_date: date,
      orders: tmRow?.orders || null,
      gtv: tmRow?.gtv || null,
      sport: tmRow?.sport || null,
      event_name: tmRow?.event_name || null,
      face_value: sfRow?.face_value || null,
      gross_profit: sfRow?.gross_profit || null,
      tickets_sold: sfRow?.tickets_sold || null, // Snowflake's tickets_purchased
      source: 'reconciled',
    });
  }

  // Upsert reconciled rows
  const { error: upsertError } = await supabase
    .from('daily_metrics')
    .upsert(reconciledRows, {
      onConflict: 'metric_date,event_name,source',
    });

  if (upsertError) throw new Error(`Failed to upsert reconciled data: ${upsertError.message}`);

  console.log(`Reconciled ${reconciledRows.length} rows for ${startDate} to ${endDate}`);
}
```

### Weekly Summary View (from Story 1.1)

The `weekly_summary` view should already exist in `supabase/schema.sql`:

```sql
CREATE VIEW weekly_summary AS
SELECT
  date_trunc('week', metric_date + INTERVAL '1 day') - INTERVAL '1 day' AS week_start,
  SUM(tickets_sold) AS total_tickets,
  SUM(orders) AS total_orders,
  SUM(gtv) AS total_gtv,
  SUM(face_value) AS total_face_value,
  SUM(gross_profit) AS total_gross_profit
FROM daily_metrics
WHERE source = 'reconciled'
GROUP BY week_start
ORDER BY week_start DESC;
```

**Week Boundary Math Explanation:**
- Postgres `date_trunc('week', date)` returns Monday by default for ISO weeks
- Adding 1 day shifts the input date forward, then subtracting 1 day normalizes to Monday
- This ensures Monday-Sunday boundaries align with ET timezone expectations
- Verify in testing: `SELECT date_trunc('week', '2026-04-30'::date + INTERVAL '1 day') - INTERVAL '1 day'` should return `2026-04-27` (Monday)

### Dependencies

```json
{
  "dependencies": {
    "date-fns": "^3.6.0",
    "date-fns-tz": "^3.1.3"
  },
  "devDependencies": {
    "vitest": "^1.6.0",
    "@vitest/ui": "^1.6.0"
  }
}
```

### Test Structure

```typescript
// src/lib/utils/week.test.ts
import { describe, it, expect } from 'vitest';
import { getWeekStart, getWeekEnd, getCurrentWeek, isMonday } from './week';

describe('Week Boundary Utility', () => {
  describe('getWeekStart', () => {
    it('returns Monday for a date in the middle of the week', () => {
      const wednesday = new Date('2026-04-29T12:00:00Z'); // Wednesday
      const monday = getWeekStart(wednesday);
      expect(monday.getDay()).toBe(1); // Monday
      expect(monday.getHours()).toBe(0);
      expect(monday.getMinutes()).toBe(0);
    });

    it('returns the same date if input is already Monday', () => {
      const monday = new Date('2026-04-27T12:00:00Z'); // Monday
      const weekStart = getWeekStart(monday);
      expect(weekStart.getDay()).toBe(1);
    });
  });

  describe('getWeekEnd', () => {
    it('returns Sunday 23:59:59 for a date in the middle of the week', () => {
      const wednesday = new Date('2026-04-29T12:00:00Z'); // Wednesday
      const sunday = getWeekEnd(wednesday);
      expect(sunday.getDay()).toBe(0); // Sunday
      expect(sunday.getHours()).toBe(23);
      expect(sunday.getMinutes()).toBe(59);
      expect(sunday.getSeconds()).toBe(59);
    });
  });

  describe('getCurrentWeek', () => {
    it('returns the Monday of the current week', () => {
      const monday = getCurrentWeek();
      expect(monday.getDay()).toBe(1);
    });
  });

  describe('isMonday', () => {
    it('returns true for a Monday date', () => {
      const monday = new Date('2026-04-27T12:00:00Z'); // Monday
      expect(isMonday(monday)).toBe(true);
    });

    it('returns false for a non-Monday date', () => {
      const wednesday = new Date('2026-04-29T12:00:00Z'); // Wednesday
      expect(isMonday(wednesday)).toBe(false);
    });
  });
});
```

### Critical Conventions

- **File naming:** kebab-case for all files (e.g., `reconcile.ts`, `week.test.ts`)
- **Function naming:** camelCase (e.g., `getWeekStart`, `reconcileDailyMetrics`)
- **Type naming:** PascalCase (e.g., `DailyMetric`)
- **Date formats:** ISO 8601 strings for dates in JSON/DB (`"2026-04-20"`)
- **Timezone:** All date calculations use `America/New_York` via `date-fns-tz`
- **Co-located tests:** Test files live next to source files (`week.test.ts` next to `week.ts`)
- **Test runner:** Vitest (Vite-compatible, fast, modern)

### Integration Notes for Story 1.5 (Pipeline Orchestration)

The reconciliation module will be called from the daily cron endpoint:

```typescript
// src/app/api/cron/daily-refresh/route.ts (Story 1.5)
import { reconcileDailyMetrics } from '@/lib/pipeline/reconcile';
import { format, subDays } from 'date-fns';

export async function GET(request: Request) {
  // ... verify CRON_SECRET ...

  // 1. Pull Ticketmaster data (Story 1.2)
  // 2. Pull Snowflake data (Story 1.3)

  // 3. Reconcile last 14 days (handles late-arriving data)
  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), 14), 'yyyy-MM-dd');

  try {
    await reconcileDailyMetrics(startDate, endDate);
    // Log success to pipeline_runs
  } catch (error) {
    // Log error to pipeline_runs with stage='reconciliation'
  }

  // 4. Monday email flow (if isMonday())
}
```

### References

- [Source: {output_folder}/planning-artifacts/architecture.md#Data Architecture]
- [Source: {output_folder}/planning-artifacts/architecture.md#Cross-Cutting Concerns - Week boundary logic]
- [Source: {output_folder}/planning-artifacts/epics.md#Story 1.4: Data Reconciliation & Weekly Aggregation]
- [Source: supabase/schema.sql - weekly_summary view created in Story 1.1]
- [date-fns documentation](https://date-fns.org/docs/Getting-Started)
- [date-fns-tz documentation](https://github.com/marnusw/date-fns-tz)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- date-fns-tz v3 uses `toZonedTime`/`fromZonedTime` (not deprecated `utcToZonedTime`/`zonedTimeToUtc` or `TZDate` constructor)
- Tests verify ET timezone edge cases including UTC times that map to different ET days

### Completion Notes List
- Installed date-fns 4.1.0 and date-fns-tz 3.2.0 (vitest already present at ^4.1.5)
- Week boundary utility (src/lib/utils/week.ts) with 4 exported functions using date-fns-tz v3 API
- 15 unit tests for week utility covering all edge cases including UTC/ET day boundary shifts
- Reconciliation module (src/lib/pipeline/reconcile.ts) merges TM + Snowflake by metric_date, handles partial data
- 8 unit tests for reconciliation covering: both sources, TM-only, SF-only, no data, errors, multi-event
- weekly_summary SQL view verified in schema.sql with correct Mon-Sun boundaries and reconciled filter
- All 48 tests pass, lint clean

### File List
- src/lib/utils/week.ts (new)
- src/lib/utils/week.test.ts (new)
- src/lib/pipeline/reconcile.ts (new)
- src/lib/pipeline/reconcile.test.ts (new)
- package.json (modified — added date-fns, date-fns-tz)
- pnpm-lock.yaml (modified)
