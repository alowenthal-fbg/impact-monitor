# Story 1.3: Snowflake REST API Client

Status: ready-for-dev

## Story

As an admin,
I want the system to query Snowflake for face value, gross profit, and tickets purchased,
so that internal financial metrics complement the Ticketmaster sales data.

## Acceptance Criteria

1. Given valid Snowflake credentials in env vars, when client is invoked for a date range, it queries `PFI_ECOSYSTEM_DAILY_ACTIVITY` via Snowflake REST API (SQL API) and retrieves face_value, gross_profit, tickets_purchased per date, storing in `daily_metrics` with `source='snowflake'`
2. Given query timeout or failure, retries up to 3 times with exponential backoff (1s, 2s, 4s), surfaces clear error if all fail
3. Given successful query, upserts data (no duplicates for same date+source)
4. No native Snowflake SDK dependencies — HTTP-only (works in Vercel serverless)

## Tasks / Subtasks

- [ ] Task 1: Create Snowflake REST API client (AC: #1, #4)
  - [ ] Create `src/lib/pipeline/snowflake.ts` with `fetchSnowflakeData(startDate, endDate)` function
  - [ ] Implement JWT token generation for Snowflake key-pair auth
  - [ ] Implement SQL API request: POST to `https://{account}.snowflakecomputing.com/api/v2/statements`
  - [ ] Parse response with `rowType` (column metadata) and `data` (array of arrays)
  - [ ] Map raw response to typed `DailyMetric` objects
  - [ ] Use `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_WAREHOUSE` from env
- [ ] Task 2: Integrate retry logic (AC: #2)
  - [ ] Import `retryWithBackoff` from `src/lib/utils/retry.ts` (created in Story 1.2)
  - [ ] Wrap Snowflake API call with retry wrapper
  - [ ] Handle async query execution: poll GET `/api/v2/statements/{statementHandle}` until complete
  - [ ] Surface clear error messages if all retries fail (include Snowflake error code if available)
- [ ] Task 3: Implement data persistence (AC: #3)
  - [ ] Import server Supabase client from `src/lib/supabase/server.ts`
  - [ ] Use `.upsert()` with `{ onConflict: 'metric_date,event_name,source' }` to prevent duplicates
  - [ ] Transform Snowflake response fields to match `daily_metrics` schema
  - [ ] Set `source = 'snowflake'` for all inserted rows
- [ ] Task 4: Add TypeScript types
  - [ ] Define `SnowflakeQueryParams` interface (startDate, endDate)
  - [ ] Define `SnowflakeApiResponse` interface (statementHandle, rowType, data, message)
  - [ ] Define `SnowflakeDailyMetric` interface matching raw query result

## Dev Notes

### Project Structure Notes

**File:** `src/lib/pipeline/snowflake.ts`

This is the Snowflake data ingestion client. It will be called by the pipeline orchestrator (Story 1.5) but should be independently testable.

**Dependencies:**
- `src/lib/utils/retry.ts` (Story 1.2) for exponential backoff
- `src/lib/supabase/server.ts` for service role client (write access)
- `src/lib/supabase/types.ts` for `DailyMetric` type

**Key design decisions:**
- Uses Snowflake SQL API (REST) — NOT `snowflake-sdk` npm package
- Auth via username/password (not key-pair JWT) for simplicity (key-pair requires RSA key generation)
- Query is synchronous for smaller date ranges (async polling not needed initially)
- Stores raw Snowflake data with `source='snowflake'` — reconciliation happens separately (Story 1.4)

### Snowflake SQL API Details

#### Endpoint

```
POST https://{account}.snowflakecomputing.com/api/v2/statements
```

#### Authentication

**Option 1: Basic Auth (username/password)** — simplest for serverless
```typescript
headers: {
  'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
  'Content-Type': 'application/json',
}
```

**Option 2: OAuth/JWT (key-pair)** — more secure but requires RSA key management
- Requires generating a JWT token signed with a private key
- Snowflake public key must be uploaded to user account
- More complex; defer unless password auth fails

**Recommendation:** Start with Basic Auth (Option 1). If Snowflake account requires MFA or SSO, escalate to key-pair.

#### Request Body

```typescript
{
  "statement": "SELECT metric_date, face_value, gross_profit, tickets_purchased FROM FDE.FANAPP.REPORTING.PFI_ECOSYSTEM_DAILY_ACTIVITY WHERE metric_date BETWEEN ? AND ?",
  "parameters": {
    "bindings": {
      "1": { "type": "DATE", "value": "2026-04-20" },
      "2": { "type": "DATE", "value": "2026-04-26" }
    }
  },
  "warehouse": "FDE_LOYALTY_ANALYST_LG_WH",
  "database": "FDE",
  "role": "LOYALTY_ANALYST",
  "timeout": 60
}
```

**Alternative (no parameterized query):**
```typescript
{
  "statement": "SELECT metric_date, face_value, gross_profit, tickets_purchased FROM FDE.FANAPP.REPORTING.PFI_ECOSYSTEM_DAILY_ACTIVITY WHERE metric_date BETWEEN '2026-04-20' AND '2026-04-26'",
  "warehouse": "FDE_LOYALTY_ANALYST_LG_WH",
  "database": "FDE",
  "role": "LOYALTY_ANALYST",
  "timeout": 60
}
```

Use direct string interpolation (second option) for simplicity unless SQL injection is a concern (not an issue here — dates are controlled by system, not user input).

#### Response Format (Synchronous Execution)

```json
{
  "resultSetMetaData": {
    "rowType": [
      { "name": "METRIC_DATE", "type": "date", "nullable": false },
      { "name": "FACE_VALUE", "type": "fixed", "scale": 2, "precision": 12, "nullable": true },
      { "name": "GROSS_PROFIT", "type": "fixed", "scale": 2, "precision": 12, "nullable": true },
      { "name": "TICKETS_PURCHASED", "type": "fixed", "scale": 0, "precision": 10, "nullable": true }
    ]
  },
  "data": [
    ["2026-04-20", "1250.00", "450.00", "10"],
    ["2026-04-21", "2300.50", "820.25", "18"]
  ],
  "statementHandle": "01b5c2e3-...",
  "statementStatusUrl": "/api/v2/statements/01b5c2e3-..."
}
```

**Key fields:**
- `resultSetMetaData.rowType`: column definitions (name, type, nullable)
- `data`: array of arrays — each inner array is one row of values (strings)
- `statementHandle`: unique ID for async polling (optional; only needed for long-running queries)

#### Response Format (Async Execution)

If query takes >60s or if you request async execution:

**Initial POST returns:**
```json
{
  "statementHandle": "01b5c2e3-...",
  "statementStatusUrl": "/api/v2/statements/01b5c2e3-...",
  "message": "Statement executed successfully.",
  "code": "090001"
}
```

**Then poll GET `https://{account}.snowflakecomputing.com/api/v2/statements/{statementHandle}`:**

```json
{
  "statementHandle": "01b5c2e3-...",
  "sqlText": "SELECT ...",
  "statementStatusUrl": "/api/v2/statements/01b5c2e3-...",
  "resultSetMetaData": { ... },
  "data": [ ... ]
}
```

Poll every 1-2 seconds until `data` field is present. Max 10 retries (20 seconds).

#### Error Handling

**Rate limit (429):**
```json
{
  "code": "429",
  "message": "Too Many Requests"
}
```
→ Retry with backoff

**Auth failure (401):**
```json
{
  "code": "390144",
  "message": "Incorrect username or password was specified."
}
```
→ Surface error immediately (do NOT retry — credentials are wrong)

**Timeout (timeout exceeded):**
```json
{
  "code": "604",
  "message": "Statement reached its timeout."
}
```
→ Retry

**General query error (e.g., invalid SQL, missing table):**
```json
{
  "code": "002003",
  "message": "SQL compilation error: Object 'PFI_ECOSYSTEM_DAILY_ACTIVITY' does not exist."
}
```
→ Surface error immediately (do NOT retry)

### Query Logic

**Table:** `FDE.FANAPP.REPORTING.PFI_ECOSYSTEM_DAILY_ACTIVITY`

**Columns needed:**
- `metric_date` (DATE) — maps to `daily_metrics.metric_date`
- `face_value` (NUMERIC) — maps to `daily_metrics.face_value`
- `gross_profit` (NUMERIC) — maps to `daily_metrics.gross_profit`
- `tickets_purchased` (INT) — maps to `daily_metrics.tickets_sold` (note the name difference!)

**SQL query:**
```sql
SELECT
  metric_date,
  face_value,
  gross_profit,
  tickets_purchased
FROM FDE.FANAPP.REPORTING.PFI_ECOSYSTEM_DAILY_ACTIVITY
WHERE metric_date BETWEEN '2026-04-20' AND '2026-04-26'
ORDER BY metric_date ASC
```

**Assumptions:**
- Snowflake table is pre-aggregated to daily level (no event-level detail)
- `event_name` column is NULL for Snowflake rows (only TM API has event detail)
- `sport` column is NULL for Snowflake rows (only TM API has sport detail)

**Data transformation:**
```typescript
// Snowflake response row: ["2026-04-20", "1250.00", "450.00", "10"]
// Maps to:
{
  metric_date: "2026-04-20",
  tickets_sold: 10,  // from tickets_purchased
  orders: null,      // Snowflake doesn't have orders
  gtv: null,         // Snowflake doesn't have GTV
  face_value: 1250.00,
  gross_profit: 450.00,
  sport: null,
  event_name: null,
  source: 'snowflake'
}
```

### Code Structure

```typescript
// src/lib/pipeline/snowflake.ts

import { retryWithBackoff } from '@/lib/utils/retry';
import { createServerClient } from '@/lib/supabase/server';
import type { DailyMetric } from '@/lib/supabase/types';

interface SnowflakeQueryParams {
  startDate: string; // ISO date "2026-04-20"
  endDate: string;   // ISO date "2026-04-26"
}

interface SnowflakeApiResponse {
  resultSetMetaData?: {
    rowType: Array<{ name: string; type: string; nullable: boolean }>;
  };
  data?: string[][];
  statementHandle?: string;
  statementStatusUrl?: string;
  message?: string;
  code?: string;
}

/**
 * Fetch daily metrics from Snowflake PFI_ECOSYSTEM_DAILY_ACTIVITY table
 * and store in Supabase with source='snowflake'
 */
export async function fetchSnowflakeData({ startDate, endDate }: SnowflakeQueryParams): Promise<void> {
  const account = process.env.SNOWFLAKE_ACCOUNT!;
  const username = process.env.SNOWFLAKE_USER!;
  const password = process.env.SNOWFLAKE_PASSWORD!;
  const database = process.env.SNOWFLAKE_DATABASE!;
  const warehouse = process.env.SNOWFLAKE_WAREHOUSE!;

  const url = `https://${account}.snowflakecomputing.com/api/v2/statements`;

  const sql = `
    SELECT
      metric_date,
      face_value,
      gross_profit,
      tickets_purchased
    FROM FDE.FANAPP.REPORTING.PFI_ECOSYSTEM_DAILY_ACTIVITY
    WHERE metric_date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY metric_date ASC
  `;

  const requestBody = {
    statement: sql,
    warehouse,
    database,
    role: 'LOYALTY_ANALYST',
    timeout: 60,
  };

  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

  // Wrap API call with retry logic
  const response = await retryWithBackoff(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const json: SnowflakeApiResponse = await res.json();

    // Handle auth errors (do not retry)
    if (res.status === 401) {
      throw new Error(`Snowflake auth failed: ${json.message || 'Invalid credentials'}`);
    }

    // Handle rate limits (retry)
    if (res.status === 429) {
      throw new Error('Rate limit exceeded');
    }

    // Handle query errors (do not retry)
    if (!res.ok) {
      throw new Error(`Snowflake query failed (${json.code}): ${json.message}`);
    }

    return json;
  });

  // Transform response to DailyMetric format
  const metrics: Omit<DailyMetric, 'id' | 'created_at'>[] = response.data?.map((row) => ({
    metric_date: row[0],
    tickets_sold: parseInt(row[3], 10),
    orders: null,
    gtv: null,
    face_value: parseFloat(row[1]),
    gross_profit: parseFloat(row[2]),
    sport: null,
    event_name: null,
    source: 'snowflake' as const,
  })) || [];

  // Store in Supabase
  const supabase = createServerClient();
  const { error } = await supabase
    .from('daily_metrics')
    .upsert(metrics, { onConflict: 'metric_date,event_name,source' });

  if (error) {
    throw new Error(`Failed to store Snowflake data in Supabase: ${error.message}`);
  }
}
```

### Async Query Handling (Optional Enhancement)

If queries take longer than 60 seconds, implement async polling:

```typescript
async function pollStatement(statementHandle: string, account: string, authHeader: string): Promise<SnowflakeApiResponse> {
  const url = `https://${account}.snowflakecomputing.com/api/v2/statements/${statementHandle}`;
  const maxRetries = 10;
  let attempt = 0;

  while (attempt < maxRetries) {
    const res = await fetch(url, {
      headers: { Authorization: authHeader },
    });

    const json: SnowflakeApiResponse = await res.json();

    // If data is present, query completed
    if (json.data) {
      return json;
    }

    // Wait 2 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempt++;
  }

  throw new Error('Snowflake query timeout: statement did not complete within 20 seconds');
}
```

Call this if initial POST returns only `statementHandle` without `data`.

### TypeScript Types

```typescript
// src/lib/pipeline/snowflake.ts (add to existing types)

interface SnowflakeQueryParams {
  startDate: string; // ISO date "2026-04-20"
  endDate: string;   // ISO date "2026-04-26"
}

interface SnowflakeApiResponse {
  resultSetMetaData?: {
    rowType: Array<{
      name: string;
      type: string;
      nullable: boolean;
      scale?: number;
      precision?: number;
    }>;
  };
  data?: string[][];
  statementHandle?: string;
  statementStatusUrl?: string;
  message?: string;
  code?: string;
}

interface SnowflakeDailyMetric {
  metric_date: string;
  face_value: number | null;
  gross_profit: number | null;
  tickets_purchased: number | null;
}
```

### Error Messages

**Clear error format:**
```typescript
throw new Error(`Snowflake query failed (code ${code}): ${message}`);
```

Examples:
- `"Snowflake auth failed: Incorrect username or password was specified."`
- `"Snowflake query failed (002003): SQL compilation error: Object 'PFI_ECOSYSTEM_DAILY_ACTIVITY' does not exist."`
- `"Snowflake query timeout: statement did not complete within 20 seconds"`
- `"Failed to store Snowflake data in Supabase: duplicate key value violates unique constraint"`

### Testing Notes

**Manual test (once deployed):**
1. Set env vars in Vercel dashboard
2. Create test API route: `/api/test/snowflake`
3. Call `fetchSnowflakeData({ startDate: '2026-04-20', endDate: '2026-04-26' })`
4. Verify rows appear in `daily_metrics` with `source='snowflake'`
5. Call again with same dates — verify upsert (no duplicates)

**Mock test (local dev):**
Use `msw` (Mock Service Worker) to intercept Snowflake API calls:
```typescript
import { rest } from 'msw';

const handlers = [
  rest.post('https://VYB11067.us-east-1.snowflakecomputing.com/api/v2/statements', (req, res, ctx) => {
    return res(
      ctx.json({
        resultSetMetaData: {
          rowType: [
            { name: 'METRIC_DATE', type: 'date', nullable: false },
            { name: 'FACE_VALUE', type: 'fixed', nullable: true },
            { name: 'GROSS_PROFIT', type: 'fixed', nullable: true },
            { name: 'TICKETS_PURCHASED', type: 'fixed', nullable: true },
          ],
        },
        data: [
          ['2026-04-20', '1250.00', '450.00', '10'],
          ['2026-04-21', '2300.50', '820.25', '18'],
        ],
      })
    );
  }),
];
```

### References

- [Snowflake SQL API Documentation](https://docs.snowflake.com/en/developer-guide/sql-api/reference)
- [Snowflake Authentication: Key Pair](https://docs.snowflake.com/en/user-guide/key-pair-auth)
- [Architecture: Data Pipeline - Snowflake Integration]({output_folder}/planning-artifacts/architecture.md#Data Pipeline Architecture)
- [PRD: FR2 - Query Snowflake for face value, gross profit, tickets]({output_folder}/planning-artifacts/prd.md#Functional Requirements)
- [Architecture: Implementation Patterns - Retry Logic]({output_folder}/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules)
- [Story 1.2: Ticketmaster API Client]({output_folder}/implementation-artifacts/1-2-ticketmaster-client.md) (parallel implementation pattern)

### Critical Conventions

- **File naming:** kebab-case (`snowflake.ts`, not `snowflakeClient.ts`)
- **Function naming:** camelCase (`fetchSnowflakeData`, not `FetchSnowflakeData`)
- **Error handling:** Always throw with clear messages — no silent failures
- **Dates:** ISO 8601 strings (`"2026-04-20"`) for all date parameters and DB storage
- **Retry logic:** Use `retryWithBackoff` from Story 1.2 — do NOT implement custom retry
- **Environment variables:** Always use `process.env.VARIABLE!` (non-null assertion) — fail fast if missing
- **Supabase client:** Always use `createServerClient()` for server-side writes (never browser client)
- **Source tagging:** All rows inserted must have `source='snowflake'` for reconciliation (Story 1.4)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
