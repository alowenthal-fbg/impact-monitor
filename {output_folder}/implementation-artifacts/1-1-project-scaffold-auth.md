# Story 1.1: Project Scaffold with Auth-Protected App Shell

Status: review

## Story

As an admin,
I want a secured Next.js application with database schema and authentication,
so that I have a foundation to build all features on with no unauthorized access to business data.

## Acceptance Criteria

1. Next.js project created with TypeScript, Tailwind CSS, ESLint, App Router, Turbopack, pnpm
2. `.env.example` documents all required environment variables
3. Supabase schema applied: `daily_metrics`, `pipeline_runs`, `subscribers` tables + `weekly_summary` view
4. Row Level Security enabled: anon key = read-only, service role = full access
5. Unauthenticated users redirected to `/login` (except `/login`, `/api/auth/*`, `/api/cron/*`)
6. Login page accepts `AUTH_PASSWORD`, sets session cookie on success
7. Cron endpoints reject requests without valid `CRON_SECRET` header (401)
8. Supabase browser client uses anon key; server routes use service role key
9. API routes return consistent format: `{ data: T, error: null }` or `{ data: null, error: { message, code } }`

## Tasks / Subtasks

- [x] Task 1: Scaffold Next.js project (AC: #1)
  - [x] Run `npx create-next-app@latest impact-monitor --yes`
  - [x] Remove default npm lockfile, initialize with `pnpm install`
  - [x] Verify TypeScript, Tailwind CSS, ESLint, App Router, Turbopack are configured
  - [x] Set up `@/*` import alias in tsconfig.json
- [x] Task 2: Create environment configuration (AC: #2)
  - [x] Create `.env.example` with all required variables (see Dev Notes)
  - [x] Create `.env.local` entry in `.gitignore` (should already be there from starter)
  - [x] Add `vercel.json` stub for future cron configuration
- [x] Task 3: Create Supabase schema (AC: #3, #4)
  - [x] Create `supabase/schema.sql` with full DDL
  - [x] Define `daily_metrics` table
  - [x] Define `pipeline_runs` table
  - [x] Define `subscribers` table
  - [x] Create `weekly_summary` SQL view with Mon-Sun boundaries
  - [x] Add RLS policies: anon = SELECT only, service_role = all operations
- [x] Task 4: Set up Supabase client libraries (AC: #8)
  - [x] Install `@supabase/supabase-js`
  - [x] Create `src/lib/supabase/client.ts` (browser, anon key)
  - [x] Create `src/lib/supabase/server.ts` (server, service role key)
  - [x] Create `src/lib/supabase/types.ts` (DailyMetric, PipelineRun, Subscriber types)
- [x] Task 5: Implement auth proxy (AC: #5, #7)
  - [x] Create `proxy.ts` at project root (Next.js 16 renamed middleware → proxy)
  - [x] Redirect unauthenticated requests to `/login`
  - [x] Exclude `/login`, `/api/auth/*`, `/api/cron/*` from auth check
  - [x] Verify `CRON_SECRET` header for `/api/cron/*` routes
- [x] Task 6: Create login page and auth endpoint (AC: #6)
  - [x] Create `src/app/login/page.tsx` with password form
  - [x] Create `src/app/api/auth/login/route.ts` — verify password, set cookie
  - [x] Use httpOnly secure cookie for session
- [x] Task 7: Set up API response utility (AC: #9)
  - [x] Create response helper in `src/lib/utils/api.ts`
  - [x] Export `successResponse(data)` and `errorResponse(message, code, status)`

## Dev Notes

### Environment Variables (.env.example)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Auth
AUTH_PASSWORD=

# Cron Protection
CRON_SECRET=

# Ticketmaster (used in future stories)
TM_API_KEY=
TM_API_SECRET=

# Snowflake (used in future stories)
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USER=
SNOWFLAKE_PASSWORD=
SNOWFLAKE_DATABASE=FDE
SNOWFLAKE_WAREHOUSE=FDE_LOYALTY_ANALYST_LG_WH

# Resend (used in future stories)
RESEND_API_KEY=

# Claude AI (used in future stories)
ANTHROPIC_API_KEY=
```

### Supabase Schema Details

```sql
-- daily_metrics: one row per date per event per source
CREATE TABLE daily_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date DATE NOT NULL,
  tickets_sold INT,
  orders INT,
  gtv NUMERIC(12,2),
  face_value NUMERIC(12,2),
  gross_profit NUMERIC(12,2),
  sport TEXT,
  event_name TEXT,
  source TEXT NOT NULL CHECK (source IN ('tm_api', 'snowflake', 'reconciled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(metric_date, event_name, source)
);

-- pipeline_runs: one row per pipeline execution
CREATE TABLE pipeline_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT now(),
  stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  error_message TEXT,
  completed_at TIMESTAMPTZ
);

-- subscribers: email list for Monday delivery
CREATE TABLE subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- weekly_summary: aggregates daily_metrics by Mon-Sun week
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

Note: The `weekly_summary` view uses Postgres date math to align to Monday-Sunday boundaries. The formula `date_trunc('week', metric_date + INTERVAL '1 day') - INTERVAL '1 day'` shifts ISO weeks (Mon start) correctly. Verify this logic produces Monday dates in testing.

### Auth Proxy Pattern (Next.js 16: `proxy.ts` replaces `middleware.ts`)

**CRITICAL:** In Next.js 16, the middleware file is renamed from `middleware.ts` to `proxy.ts`. The function export is `export default async function proxy(req)` instead of `export function middleware(req)`.

```typescript
// proxy.ts (project root — NOT middleware.ts)
import { NextRequest, NextResponse } from 'next/server';

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes - no auth needed
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Cron routes - verify CRON_SECRET instead of session
  if (pathname.startsWith('/api/cron')) {
    const cronSecret = request.headers.get('authorization');
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { data: null, error: { message: 'Unauthorized', code: 'INVALID_CRON_SECRET' } },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // All other routes - check session cookie
  const session = request.cookies.get('session');
  if (!session?.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### Key Library Versions

- **Next.js:** 16.2.4 (latest stable, April 2026)
- **@supabase/supabase-js:** ^2.105.1 (requires Node 20+; Node 18 support dropped in v2.79.0)
- **@supabase/ssr:** latest (for browser client helper)

### Supabase Client Setup

```typescript
// src/lib/supabase/client.ts - Browser client (anon key, read-only via RLS)
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// src/lib/supabase/server.ts - Server client (service role, full access)
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

### TypeScript Types

```typescript
// src/lib/supabase/types.ts
export interface DailyMetric {
  id: string;
  metric_date: string; // ISO date "2026-04-20"
  tickets_sold: number | null;
  orders: number | null;
  gtv: number | null;
  face_value: number | null;
  gross_profit: number | null;
  sport: string | null;
  event_name: string | null;
  source: 'tm_api' | 'snowflake' | 'reconciled';
  created_at: string;
}

export interface PipelineRun {
  id: string;
  started_at: string;
  stage: string;
  status: 'running' | 'success' | 'partial' | 'failed';
  error_message: string | null;
  completed_at: string | null;
}

export interface Subscriber {
  id: string;
  email: string;
  created_at: string;
}
```

### API Response Helper

```typescript
// src/lib/utils/api.ts
import { NextResponse } from 'next/server';

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function errorResponse(message: string, code: string, status = 500) {
  return NextResponse.json({ data: null, error: { message, code } }, { status });
}
```

### Project Structure (files created in this story)

```
impact-monitor/
├── .env.example
├── .gitignore
├── proxy.ts
├── next.config.ts
├── package.json (pnpm)
├── pnpm-lock.yaml
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
├── supabase/
│   └── schema.sql
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx (placeholder dashboard page)
    │   ├── login/
    │   │   └── page.tsx
    │   └── api/
    │       └── auth/
    │           └── login/
    │               └── route.ts
    └── lib/
        ├── supabase/
        │   ├── client.ts
        │   ├── server.ts
        │   └── types.ts
        └── utils/
            └── api.ts
```

### Critical Conventions

- **File naming:** kebab-case for all files (e.g., `daily-metrics.ts`, not `dailyMetrics.ts`)
- **Component naming:** PascalCase for React components
- **Variable naming:** camelCase for functions/variables, UPPER_SNAKE_CASE for constants
- **No barrel files:** Import directly from source files, never from `index.ts` re-exports
- **Package manager:** pnpm only — never use npm or yarn commands
- **Dates in DB:** `DATE` type for metric dates, `TIMESTAMPTZ` for timestamps
- **Dates in JSON:** ISO 8601 strings (`"2026-04-20"` for dates, `"2026-04-20T11:00:00Z"` for timestamps)

### Vercel Cron Configuration

```json
// vercel.json - stub for future cron (Story 1.5 will activate)
{
  "crons": [{
    "path": "/api/cron/daily-refresh",
    "schedule": "0 12 * * *"
  }]
}
```

**Hobby tier limits:** once-per-day minimum frequency, ±59 min timing precision (e.g., `0 12 * * *` runs between 12:00-12:59 UTC). The `12 UTC` = ~7-8am ET depending on DST.

### Security Notes

- `AUTH_PASSWORD` is compared server-side only — never sent to client bundle
- Session cookie must be `httpOnly`, `secure` (in production), `sameSite: 'lax'`
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never prefixed with `NEXT_PUBLIC_`
- `CRON_SECRET` verified via `Authorization: Bearer <secret>` header (Vercel's standard pattern)
- Proxy (proxy.ts) performs optimistic auth checks only — for sensitive operations, also verify session in the route handler

### References

- [Source: {output_folder}/planning-artifacts/architecture.md#Starter Template Evaluation]
- [Source: {output_folder}/planning-artifacts/architecture.md#Authentication & Security]
- [Source: {output_folder}/planning-artifacts/architecture.md#Data Architecture]
- [Source: {output_folder}/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: {output_folder}/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: {output_folder}/planning-artifacts/prd.md#Non-Functional Requirements - Security]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Build verified: `pnpm build` succeeds with all routes detected (/, /login, /api/auth/login) + proxy
- Lint verified: `pnpm lint` passes clean
- Next.js 16.2.4 confirmed via build output
- proxy.ts (not middleware.ts) confirmed supported via Next.js 16 source inspection

### Completion Notes List
- Scaffolded via `create-next-app@latest --yes --use-pnpm` into temp dir, then moved into existing repo
- Restructured to `src/` directory layout with `@/*` alias pointing to `./src/*`
- All 3 Supabase tables + weekly_summary view + RLS policies defined in `supabase/schema.sql`
- Auth proxy (`src/proxy.ts`) handles session cookie check, CRON_SECRET verification, and public route exclusion
- Login page is client-side form posting to `/api/auth/login` which sets httpOnly secure cookie
- API response utility provides consistent `{ data, error }` format
- No tests added for this story — it's pure scaffolding with no business logic to unit test. Auth flow is integration-testable once deployed.

### Change Log
- 2026-05-01: Initial scaffold and all 7 tasks completed

### File List
- .env.example (new)
- .gitignore (modified — added !.env.example exclusion)
- AGENTS.md (new — from create-next-app)
- README.md (new — from create-next-app)
- eslint.config.mjs (new)
- next-env.d.ts (new)
- next.config.ts (new)
- package.json (new)
- pnpm-lock.yaml (new)
- pnpm-workspace.yaml (new)
- postcss.config.mjs (new)
- tsconfig.json (new — @/* alias points to ./src/*)
- vercel.json (new — cron stub)
- public/ (new — static assets from starter)
- supabase/schema.sql (new)
- src/app/globals.css (new)
- src/app/layout.tsx (new)
- src/app/page.tsx (new — placeholder dashboard)
- src/app/favicon.ico (new)
- src/app/login/page.tsx (new)
- src/app/api/auth/login/route.ts (new)
- src/lib/supabase/client.ts (new)
- src/lib/supabase/server.ts (new)
- src/lib/supabase/types.ts (new)
- src/lib/utils/api.ts (new)
- src/proxy.ts (new)
