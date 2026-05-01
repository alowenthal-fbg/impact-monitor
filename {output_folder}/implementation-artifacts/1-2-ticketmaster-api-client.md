# Story 1.2: Ticketmaster Impact Partner API Client

Status: review

## Story

As an admin,
I want the system to pull ticket sales data from the Ticketmaster Impact Partner API,
so that order, GTV, event, and sport category data flows into the system automatically.

## Acceptance Criteria

1. Given valid Impact Partner API credentials in env vars, when TM client is invoked for a date range, it retrieves ticket sales data (orders, GTV, event details, sport categories) and stores as rows in daily_metrics with source='tm_api'
2. Given API rate limit or transient error, retries up to 3 times with exponential backoff (1s, 2s, 4s), surfaces clear error if all fail
3. Given expired auth token, refreshes token and retries
4. Given successful API call, upserts data (no duplicates for same date+source)

## Tasks / Subtasks

- [x] Task 1: Create retry utility (AC: #2)
  - [x] Implement `src/lib/utils/retry.ts` with generic `retryWithBackoff` wrapper
  - [x] Co-located test `src/lib/utils/retry.test.ts`
- [x] Task 2: Implement Ticketmaster API client (AC: #1, #3, #4)
  - [x] Create `src/lib/pipeline/ticketmaster.ts`
  - [x] Implement OAuth2 client credentials authentication
  - [x] Implement token refresh on 401
  - [x] Fetch order/sales data for date range (handle pagination)
  - [x] Transform API response to daily_metrics schema
  - [x] Upsert to Supabase via service role client (ON CONFLICT dedupe)
- [x] Task 3: Add tests (AC: all)
  - [x] Create `src/lib/pipeline/ticketmaster.test.ts`
  - [x] Test successful fetch + upsert
  - [x] Test token refresh on 401
  - [x] Test retry on 429 rate limit
  - [x] Test error after max retries

## Dev Notes

### Retry Utility (`src/lib/utils/retry.ts`)

Generic exponential backoff — reused by Snowflake (Story 1.3) and Resend (Story 4.1):

```typescript
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries) break;
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  throw lastError!;
}
```

### Ticketmaster Client (`src/lib/pipeline/ticketmaster.ts`)

**Authentication:** OAuth2 client credentials flow. POST to token endpoint with client_id (TM_API_KEY) + client_secret (TM_API_SECRET). Store access_token + expiry. Refresh 5min before expiry.

**Client structure:**

```typescript
import { createServerClient } from '../supabase/server';
import { retryWithBackoff } from '../utils/retry';

export async function pullTicketmasterData(startDate: string, endDate: string): Promise<void> {
  // 1. Authenticate (get/refresh token)
  // 2. Fetch orders for date range (paginate if needed)
  // 3. Transform to daily_metrics rows (group by metric_date + event_name)
  // 4. Upsert to Supabase
}
```

**Key implementation details:**
- Auth token: Cache in module scope, refresh on 401 or expiry
- Rate limit (429): Throw error → retryWithBackoff handles it
- 5xx errors: Throw → retryWithBackoff handles
- 4xx (non-401/429): Throw without retry (permanent error)
- Pagination: Loop until all pages fetched
- Transform: Group orders by (metric_date, event_name, sport), aggregate tickets_sold, orders count, gtv sum
- Upsert: `supabase.from('daily_metrics').upsert(rows, { onConflict: 'metric_date,event_name,source' })`
- Source field: Always `'tm_api'`

**Data transformation:** TM API returns order-level data. Aggregate per (date, event):
- `metric_date` = order date
- `tickets_sold` = sum of ticket quantities
- `orders` = count of orders
- `gtv` = sum of total amounts
- `face_value` = sum of face values (if API provides, else null — Snowflake provides this)
- `gross_profit` = null (Snowflake provides this)
- `sport` = category from API
- `event_name` = event name from API

**Note:** The dev agent will need to discover exact TM Impact Partner API endpoints from documentation. The credentials exist in `~/.tm_credentials` on Adam's local machine — for production, they're in Vercel env vars.

### Project Structure Notes

Files created in this story:
```
src/lib/utils/retry.ts          (NEW - shared retry wrapper)
src/lib/utils/retry.test.ts     (NEW - tests)
src/lib/pipeline/ticketmaster.ts (NEW - TM API client)
src/lib/pipeline/ticketmaster.test.ts (NEW - tests)
```

Files from Story 1.1 used:
- `src/lib/supabase/server.ts` — createServerClient()
- `src/lib/supabase/types.ts` — DailyMetric type

### References

- [Source: {output_folder}/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: {output_folder}/planning-artifacts/architecture.md#Implementation Patterns - Retry Logic]
- [Source: {output_folder}/planning-artifacts/prd.md#FR1]
- [Source: {output_folder}/planning-artifacts/prd.md#NFR10 - retry logic for TM API]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- All 12 tests pass (5 retry + 7 ticketmaster)
- Lint clean, build succeeds

### Completion Notes List
- Created generic `retryWithBackoff` utility (reusable by Snowflake/Resend clients)
- TM client implements OAuth2 client credentials flow with module-scoped token caching
- Token auto-refreshes on 401 or 5min before expiry
- Orders are grouped by (date, event_name) and aggregated (tickets_sold, orders, gtv, face_value)
- Upsert uses ON CONFLICT on (metric_date, event_name, source) to prevent duplicates
- 429 and 5xx errors throw to trigger retryWithBackoff; 4xx (non-401/429) are permanent errors
- Installed vitest as test framework, added test/test:watch scripts to package.json

### Change Log
- 2026-05-01: Implemented retry utility and Ticketmaster API client with full test coverage

### File List
- package.json (modified — added vitest, test scripts)
- pnpm-lock.yaml (modified)
- src/lib/utils/retry.ts (new)
- src/lib/utils/retry.test.ts (new)
- src/lib/pipeline/ticketmaster.ts (new)
- src/lib/pipeline/ticketmaster.test.ts (new)
