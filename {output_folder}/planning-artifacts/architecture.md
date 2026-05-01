---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: ['{output_folder}/planning-artifacts/prd.md']
workflowType: 'architecture'
project_name: 'Impact Monitor'
user_name: 'Adam'
date: '2026-04-29'
lastStep: 8
status: 'complete'
completedAt: '2026-04-30'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
33 FRs spanning data ingestion, visualization, export, AI generation, email delivery, and admin configuration. The system is a pipeline-to-presentation product: ingest from two sources, reconcile, store, visualize, generate AI content, and deliver automatically. Most FRs are straightforward CRUD or rendering — the architectural weight sits in the pipeline orchestration (FR1-FR7) and multi-format output generation (FR15-FR25).

**Non-Functional Requirements:**
- Performance: 3s dashboard load, 1s week switching, 5s image export, 2min pipeline completion
- Security: All credentials in environment variables, no client exposure, basic auth for dashboard access, Supabase RLS
- Reliability: Zero silent failures, automatic retry with admin alerting, graceful partial failure handling
- Integration: Retry logic for all three external services (Ticketmaster API, Snowflake, Resend)

**Scale & Complexity:**
- Primary domain: Full-stack web (React SPA + serverless + scheduled jobs)
- Complexity level: Medium
- Estimated architectural components: 6 (data pipeline, data store, dashboard frontend, image generator, AI narrative engine, email delivery)

### Technical Constraints & Dependencies

- **Vercel free tier** — serverless function limits (10s default timeout, 1GB memory on free plan) may constrain Snowflake queries and image generation
- **Snowflake in serverless** — JS SDK cold-start and connection overhead in stateless functions; may need REST API fallback
- **Image generation serverless** — Puppeteer/headless Chrome on Vercel free tier is tight on memory; may need client-side canvas approach with server-side fallback for email
- **Three external service dependencies** — Ticketmaster API, Snowflake, Resend — each with different auth models and failure modes
- **Solo developer** — architecture must favor simplicity and managed services over custom infrastructure

### Cross-Cutting Concerns Identified

- **Week boundary logic** — Monday-Sunday calculation used in pipeline, dashboard, AI generation, and email. Must be a single shared utility
- **Error handling & observability** — pipeline failures need retry, alerting, and status surfacing across all stages
- **Credential management** — three separate external services with environment-variable-based secrets
- **Date/time handling** — 7am ET scheduling, daily vs Monday-only jobs, timezone-aware data reconciliation

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application (React SPA + serverless API routes + scheduled jobs) based on project requirements for dashboard, data pipeline, and automated email delivery.

### Starter Options Considered

**1. `create-next-app` (Next.js 16.2.4 — current stable)**
- Official Next.js scaffolding with App Router, TypeScript, Tailwind CSS, ESLint, Turbopack
- Includes `AGENTS.md` / `CLAUDE.md` for AI-assisted development
- Deploys natively on Vercel with zero config
- App Router provides file-based routing + API route handlers for serverless functions

**2. T3 Stack (`create-t3-app`)**
- Next.js + TypeScript + Tailwind + tRPC + Prisma + NextAuth
- Overkill for this project — adds ORM, type-safe API layer, and auth that aren't needed. Single-user internal tool with Supabase as the data layer.

**3. Plain Vite + React**
- Would require a separate backend for API routes and cron triggers
- Loses Vercel's native cron integration and serverless function support

### Selected Starter: `create-next-app` (Next.js 16.2.4)

**Rationale for Selection:**
- Native Vercel deployment with cron jobs, serverless functions, and edge capabilities
- App Router gives clean separation of pages and API routes
- TypeScript + Tailwind included by default — matches all stated preferences
- Simplest path for a solo developer: one codebase, one deploy target, zero infrastructure config
- AI agent guidance files (`AGENTS.md`) included automatically

**Initialization Command:**

```bash
npx create-next-app@latest impact-monitor --yes
```

(`--yes` uses recommended defaults: TypeScript, Tailwind CSS, ESLint, App Router, Turbopack, `@/*` import alias, AGENTS.md)

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript with Next.js 16.2.4, React 19 (canary), Node.js 20.9+

**Styling Solution:**
Tailwind CSS (configured out of the box)

**Build Tooling:**
Turbopack (default dev bundler), SWC for production builds

**Testing Framework:**
Not included — will need to add (Vitest recommended for Vite-compatible testing in Next.js)

**Code Organization:**
App Router file-based routing (`app/` directory), `@/*` path aliases, `public/` for static assets

**Development Experience:**
Hot reload via Turbopack, TypeScript type-checking, ESLint linting

**Key Constraint Discovered:**
Vercel Hobby tier limits cron jobs to once-per-day execution with +/-59 min precision. Architecture must use a single daily cron that handles both data refresh and conditional Monday email delivery (check day-of-week in code). Upgrade to Pro ($20/mo) would unlock per-minute precision if timing becomes critical.

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Data modeling: daily granular rows + weekly aggregation
- Snowflake connectivity: REST API (SQL API)
- AI provider: Claude API (Anthropic SDK)
- Dashboard auth: env-var password via Next.js middleware

**Important Decisions (Shape Architecture):**
- Direct Supabase client for dashboard reads
- TanStack Query for data fetching state
- Hybrid image export (client-side DOM capture + server-side Satori for email)
- Pipeline error handling with partial success and status logging

**Deferred Decisions (Post-MVP):**
- External monitoring (Sentry, etc.) — revisit if pipeline reliability becomes an issue
- GitHub Actions CI — revisit if pre-deploy testing is needed
- Vercel Pro upgrade — revisit if cron timing precision matters

### Data Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Database | Supabase (Postgres, free tier) | Managed, free, JS client library, RLS for access control |
| Data modeling | Daily granular rows + weekly SQL views | Supports both mid-week checks and weekly reporting; weekly aggregation is trivial from daily data |
| Snowflake connectivity | Snowflake REST API (SQL API) | No native dependencies, reliable in Vercel serverless, HTTP-based |
| Supabase client | `@supabase/supabase-js` direct from client (anon key + RLS) | Simplest read path for dashboard, no API route middleman needed |
| Pipeline state | `pipeline_runs` table tracking stage status, errors, timestamps | Enables partial failure visibility and admin status checks |

### Authentication & Security

| Decision | Choice | Rationale |
|---|---|---|
| Dashboard auth | Env-var password with Next.js middleware + session cookie | Free tier compatible, simple, sufficient for single-user internal tool |
| Cron endpoint protection | `CRON_SECRET` header verification | Vercel standard pattern, prevents unauthorized pipeline triggers |
| Supabase server access | Service role key (server-side only) | Never exposed to client; used by pipeline API routes for writes |
| Supabase client access | Anon key with Row Level Security | Read-only dashboard access; RLS enforces data visibility |
| Credential storage | Vercel environment variables | Secrets never in code or files; `.env.local` for local dev |

### API & Communication Patterns

| Decision | Choice | Rationale |
|---|---|---|
| Dashboard data fetching | Direct Supabase client queries | No API route proxy needed; Supabase handles auth via RLS |
| Pipeline error handling | Partial success with status logging | Aligns with NFR for graceful partial failure; each stage logs independently to `pipeline_runs` |
| AI narrative generation | Claude API (Anthropic SDK) | Leverages existing enterprise Claude access; consistent with development tooling |
| Pipeline orchestration | Sequential stages in a single serverless function | Daily cron triggers one function that runs: Ticketmaster -> Snowflake -> reconcile -> store; Monday adds: AI generate -> email send |

### Frontend Architecture

| Decision | Choice | Rationale |
|---|---|---|
| State management | TanStack Query + React useState | TanStack Query handles caching, loading/error states for Supabase queries; local state for week selection |
| Charting | Recharts | User preference; well-maintained React charting library |
| Chart types | Line/area (weekly trends), bar (sport breakdown), table (top 5 events) | Matches PRD dashboard requirements (FR8-FR14) |
| Image export (download) | `html-to-image` / `dom-to-image-more` | Client-side, pixel-perfect capture of what user sees |
| Image export (email) | `@vercel/og` (Satori) | Server-side JSX-to-image, works in serverless for Monday email attachment |
| Component architecture | App Router pages + shared UI components in `@/components` | Standard Next.js pattern; keeps dashboard views and reusable components separated |

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|---|---|---|
| Hosting | Vercel (Hobby/free tier) | Native Next.js support, cron jobs, serverless functions, zero config |
| CI/CD | Vercel Git Integration (push to main = deploy) | Simplest path for solo developer; preview deployments on PRs |
| Environment management | Vercel env vars + `.env.local` for local dev | Next.js native support, secrets stay out of repo |
| Monitoring | `pipeline_runs` table + dashboard status indicator | Free, built-in, sufficient for single-user tool |
| Package manager | pnpm | Fast, disk-efficient, well-supported by Vercel |

### Decision Impact Analysis

**Implementation Sequence:**
1. Project scaffold (`create-next-app`) + pnpm setup
2. Supabase project creation + schema (daily data table, pipeline_runs, subscribers)
3. Auth middleware (env-var password)
4. Data pipeline: Ticketmaster API client -> Snowflake REST client -> reconciliation -> Supabase storage
5. Dashboard: TanStack Query + Recharts visualizations
6. Image export (client-side download)
7. AI narrative generation (Claude API)
8. Email delivery (Resend) + server-side image (Satori)
9. Cron job configuration (`vercel.json`)

**Cross-Component Dependencies:**
- Week boundary utility is shared across pipeline, dashboard, AI prompts, and email
- `pipeline_runs` table is written by the pipeline and read by the dashboard status indicator
- Supabase schema must be in place before both pipeline and dashboard work
- Satori email image and Recharts dashboard charts show the same data but render independently

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (Supabase/Postgres):**
- Tables: `snake_case`, plural — `daily_metrics`, `pipeline_runs`, `subscribers`
- Columns: `snake_case` — `tickets_sold`, `created_at`, `gross_profit`
- Foreign keys: `{referenced_table_singular}_id` — `pipeline_run_id`

**API Routes (Next.js):**
- Route handlers: `kebab-case` — `/api/cron/daily-refresh`, `/api/admin/subscribers`
- Query params: `camelCase` — `?weekStart=2026-04-20`

**Code (TypeScript/React):**
- Files: `kebab-case` — `weekly-trend-chart.tsx`, `week-utils.ts`, `snowflake-client.ts`
- Components: `PascalCase` — `WeeklyTrendChart`, `KpiCard`, `SportBreakdown`
- Functions/variables: `camelCase` — `getWeeklyData`, `ticketsSold`
- Types/interfaces: `PascalCase` — `DailyMetric`, `PipelineRun`, `WeekSummary`
- Constants: `UPPER_SNAKE_CASE` — `WEEK_START_DAY`, `PIPELINE_STAGES`

### Structure Patterns

**Project Organization: feature-grouped under `@/lib`**

- Tests co-located: `week.test.ts` next to `week.ts`
- No barrel files (`index.ts` re-exports) — direct imports only

### Format Patterns

**API Responses:**
```typescript
// Success
{ data: T, error: null }

// Error
{ data: null, error: { message: string, code: string } }
```

**Dates:**
- Database: `DATE` type for metric dates, `TIMESTAMPTZ` for timestamps
- JSON/API: ISO 8601 strings — `"2026-04-20"` for dates, `"2026-04-20T11:00:00Z"` for timestamps
- Display: `"Apr 20, 2026"` or `"Week of Apr 20"`

**JSON fields from Supabase:** `snake_case` (matches Postgres columns directly, no transform layer)

### Process Patterns

**Error Handling:**
- API routes: try/catch at the top level, return `{ data: null, error: { message, code } }` with appropriate HTTP status
- Pipeline stages: each stage catches its own errors, logs to `pipeline_runs` with stage name and error detail, returns partial result
- Client components: TanStack Query `error` state renders inline error messages, no global error toasts
- No custom error classes — plain `Error` with descriptive messages

**Loading States:**
- TanStack Query's `isLoading` / `isPending` for data fetches
- Tailwind `animate-pulse` skeleton placeholders for dashboard cards/charts during load
- No global loading spinner

**Retry Logic:**
- External API calls (Ticketmaster, Snowflake, Resend): 3 retries with exponential backoff (1s, 2s, 4s)
- Supabase calls: no retry (managed service, failures are unlikely and fast)

**Week Boundary (shared utility):**
- `getWeekStart(date)` — Monday 00:00:00 ET
- `getWeekEnd(date)` — Sunday 23:59:59 ET
- `getCurrentWeek()` — current week's Monday
- `isMonday()` — boolean check for conditional email trigger
- All functions use `date-fns` with `America/New_York` timezone handling

## Project Structure & Boundaries

### Complete Project Directory Structure

```
impact-monitor/
├── .env.local                          # Local dev env vars (gitignored)
├── .env.example                        # Template for required env vars
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json                         # Cron job configuration
├── middleware.ts                        # Auth: env-var password check
├── AGENTS.md                           # AI agent guidance (from starter)
├── CLAUDE.md                           # Claude-specific guidance
├── README.md
│
├── public/
│   └── favicon.ico
│
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx                  # Root layout + QueryClientProvider
│   │   ├── page.tsx                    # Dashboard page (FR8-FR14)
│   │   ├── login/
│   │   │   └── page.tsx                # Password login form
│   │   ├── api/
│   │   │   ├── cron/
│   │   │   │   └── daily-refresh/
│   │   │   │       └── route.ts        # Daily pipeline + Monday email (FR6, FR22)
│   │   │   ├── admin/
│   │   │   │   ├── subscribers/
│   │   │   │   │   └── route.ts        # GET/POST/DELETE subscribers (FR27-FR28)
│   │   │   │   ├── refresh/
│   │   │   │   │   └── route.ts        # Manual refresh trigger (FR7)
│   │   │   │   └── status/
│   │   │   │       └── route.ts        # Pipeline status (FR33)
│   │   │   ├── export/
│   │   │   │   └── talk-track/
│   │   │   │       └── route.ts        # Generate & return talk track (FR16-FR17)
│   │   │   └── auth/
│   │   │       └── login/
│   │   │           └── route.ts        # Password verification + set cookie
│   │
│   ├── components/
│   │   ├── kpi-card.tsx                # KPI card with WoW delta (FR8)
│   │   ├── weekly-trend-chart.tsx      # Line/area chart (FR9)
│   │   ├── sport-breakdown.tsx         # Bar charts for tickets + GTV by sport (FR10-FR11)
│   │   ├── top-events-table.tsx        # Top 5 events table (FR12)
│   │   ├── week-selector.tsx           # Historical week picker (FR13-FR14)
│   │   ├── dashboard-export.tsx        # One-click image export button (FR15)
│   │   ├── talk-track-download.tsx     # Talk track download button (FR16)
│   │   ├── pipeline-status.tsx         # Pipeline run status indicator (FR33)
│   │   ├── subscriber-manager.tsx      # Add/remove email subscribers (FR27-FR28)
│   │   └── dashboard-composite.tsx     # Wrapper div for image capture
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # Browser Supabase client (anon key)
│   │   │   ├── server.ts              # Server Supabase client (service role)
│   │   │   └── types.ts               # DB row types: DailyMetric, PipelineRun, Subscriber
│   │   ├── pipeline/
│   │   │   ├── ticketmaster.ts        # TM Impact Partner API client (FR1)
│   │   │   ├── snowflake.ts           # Snowflake REST API client (FR2)
│   │   │   ├── reconcile.ts           # Date-level reconciliation (FR3-FR4)
│   │   │   └── orchestrator.ts        # Pipeline stage runner with partial success (FR5-FR6)
│   │   ├── ai/
│   │   │   ├── narrative.ts           # 2-4 sentence summary via Claude (FR18, FR20-FR21)
│   │   │   └── talk-track.ts          # Full talk track via Claude (FR19)
│   │   ├── email/
│   │   │   ├── send.ts               # Resend client + Monday email (FR22-FR26)
│   │   │   ├── template.ts           # Email HTML template
│   │   │   └── image.ts              # Satori server-side image for attachment (FR25)
│   │   └── utils/
│   │       ├── week.ts               # Week boundary: getWeekStart, getWeekEnd, getCurrentWeek, isMonday
│   │       ├── week.test.ts           # Tests for week boundary logic
│   │       ├── dates.ts              # Date formatting, timezone helpers
│   │       ├── dates.test.ts          # Tests for date utilities
│   │       └── retry.ts              # Exponential backoff retry wrapper
│   │
│   └── hooks/
│       ├── use-weekly-data.ts         # TanStack Query hook for weekly aggregates
│       ├── use-daily-data.ts          # TanStack Query hook for daily metrics
│       └── use-pipeline-status.ts     # TanStack Query hook for pipeline run status
│
└── supabase/
    └── schema.sql                     # DDL: daily_metrics, pipeline_runs, subscribers, weekly view
```

### Architectural Boundaries

**API Boundaries:**
- `/api/cron/*` — protected by `CRON_SECRET` header; only Vercel cron should call these
- `/api/admin/*` — protected by auth middleware (session cookie); admin-only operations
- `/api/export/*` — protected by auth middleware; server-side generation endpoints
- `/api/auth/*` — public (login endpoint)

**Component Boundaries:**
- `components/` — presentational React components. Each receives data via props or TanStack Query hooks. No direct API calls in components.
- `hooks/` — data access layer. TanStack Query hooks that call Supabase client. Components consume hooks, never Supabase directly.
- `lib/` — pure business logic and external service clients. No React dependencies. Testable in isolation.

**Data Boundaries:**
- Browser -> Supabase (anon key + RLS): read-only access to `daily_metrics` and `pipeline_runs`
- Server -> Supabase (service role): full read/write for pipeline data storage and subscriber management
- Server -> External APIs: Ticketmaster, Snowflake, Resend, Claude — all in `lib/`, never called from client

### Requirements to Structure Mapping

| FR Category | Files |
|---|---|
| Data Pipeline (FR1-FR7) | `lib/pipeline/*`, `api/cron/daily-refresh/route.ts`, `api/admin/refresh/route.ts` |
| Dashboard (FR8-FR14) | `app/page.tsx`, `components/*-chart.tsx`, `components/kpi-card.tsx`, `hooks/use-*-data.ts` |
| Export (FR15-FR17) | `components/dashboard-export.tsx`, `components/talk-track-download.tsx`, `api/export/talk-track/route.ts` |
| AI Generation (FR18-FR21) | `lib/ai/narrative.ts`, `lib/ai/talk-track.ts` |
| Email (FR22-FR28) | `lib/email/*`, `api/admin/subscribers/route.ts` |
| Configuration (FR29-FR33) | `api/admin/status/route.ts`, `components/pipeline-status.tsx`, `components/subscriber-manager.tsx`, env vars |

### Cross-Cutting Concerns Mapping

| Concern | Files |
|---|---|
| Week boundaries | `lib/utils/week.ts` — imported by pipeline, dashboard hooks, AI prompts, email |
| Auth | `middleware.ts` — intercepts all routes except `/login` and `/api/auth/*` and `/api/cron/*` |
| Retry logic | `lib/utils/retry.ts` — used by Ticketmaster, Snowflake, and Resend clients |
| DB types | `lib/supabase/types.ts` — shared types for all Supabase interactions |

### Data Flow

```
[Vercel Cron] -> /api/cron/daily-refresh
                    |
                    +-- ticketmaster.ts -> Impact Partner API
                    +-- snowflake.ts -> Snowflake REST API
                    +-- reconcile.ts -> merge at date level
                    +-- orchestrator.ts -> write to Supabase (daily_metrics + pipeline_runs)
                    |
                    +-- (if Monday)
                        +-- narrative.ts -> Claude API -> 2-4 sentence summary
                        +-- talk-track.ts -> Claude API -> full script
                        +-- image.ts -> Satori -> PNG buffer
                        +-- send.ts -> Resend -> email with KPIs + summary + image attachment

[Browser] -> page.tsx
                |
                +-- use-weekly-data.ts -> Supabase (anon) -> weekly view
                +-- use-daily-data.ts -> Supabase (anon) -> daily_metrics
                +-- use-pipeline-status.ts -> Supabase (anon) -> pipeline_runs
```

### Supabase Schema Overview

**Tables:**
- `daily_metrics` — one row per date per event: `metric_date DATE`, `tickets_sold INT`, `orders INT`, `gtv NUMERIC`, `face_value NUMERIC`, `gross_profit NUMERIC`, `sport TEXT`, `event_name TEXT`, `source TEXT` (tm_api | snowflake | reconciled)
- `pipeline_runs` — one row per run: `id UUID`, `started_at TIMESTAMPTZ`, `stage TEXT`, `status TEXT` (running | success | partial | failed), `error_message TEXT`, `completed_at TIMESTAMPTZ`
- `subscribers` — `id UUID`, `email TEXT`, `created_at TIMESTAMPTZ`

**Views:**
- `weekly_summary` — aggregates `daily_metrics` by week (Mon-Sun): total tickets, orders, GTV, face value, gross profit, with WoW deltas

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**
All technology choices are compatible: Next.js 16.2.4 + React 19 + TypeScript + Tailwind CSS + TanStack Query + Recharts + Supabase JS client + Resend + Anthropic SDK. No version conflicts or incompatibilities identified.

**Pattern Consistency:**
Naming conventions are internally consistent — snake_case for DB, kebab-case for files/routes, camelCase for code, PascalCase for components/types. API response format is uniform across all routes. Date handling uses a single shared utility.

**Structure Alignment:**
Project structure directly supports all architectural decisions. Clear separation between client (`components/`, `hooks/`) and server (`lib/`, `api/`) code. No circular dependencies in the data flow.

### Requirements Coverage Validation

**Functional Requirements:** All 33 FRs (FR1-FR33) mapped to specific files in the project structure. No gaps.

**Non-Functional Requirements:**
- Performance: addressed via TanStack Query caching, pre-processed Supabase data, direct client reads
- Security: addressed via middleware auth, CRON_SECRET, RLS, env-var credentials
- Reliability: addressed via partial success pipeline, retry logic, pipeline_runs status table
- Integration: addressed via retry wrapper for all external services

**Note:** FR29-FR30 (credential configuration) are handled via Vercel environment variables rather than an in-app UI. Appropriate for a single-user tool where admin = developer.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Simple, well-bounded architecture with clear separation of concerns
- Every FR maps to specific files — no ambiguity for implementing agents
- Managed services (Supabase, Vercel, Resend) eliminate ops overhead
- Cross-cutting concerns (week boundaries, retry, types) are centralized
- Zero-cost hosting on free tiers of all services

**Areas for Future Enhancement:**
- In-app credential configuration UI (currently env vars only)
- External monitoring if pipeline reliability becomes a concern
- Vercel Pro upgrade for precise cron timing
- Testing infrastructure (Vitest setup deferred)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions

**First Implementation Priority:**
```bash
npx create-next-app@latest impact-monitor --yes
```
Then set up Supabase schema, auth middleware, and begin the data pipeline.
