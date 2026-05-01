---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments: ['{output_folder}/planning-artifacts/prd.md', '{output_folder}/planning-artifacts/architecture.md']
---

# Impact Monitor - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Impact Monitor, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: System can pull ticket sales data from the Impact Partner API on a scheduled basis
FR2: System can query Snowflake `PFI_ECOSYSTEM_DAILY_ACTIVITY` for face value, gross profit, and tickets purchased on a scheduled basis
FR3: System can reconcile Impact API and Snowflake data at the date level without a shared join key
FR4: System can aggregate transaction-level data into weekly summaries using Monday-Sunday boundaries
FR5: System can store processed weekly data persistently for historical access
FR6: System can execute the data pipeline daily by 7am ET automatically
FR7: Admin can trigger a manual data refresh on demand
FR8: User can view headline KPI cards (Total Tickets Sold, Total Orders, Total Revenue/GTV, Avg Order Value) with week-over-week comparison and percentage change
FR9: User can view a weekly trend chart tracking tickets sold and GTV over time
FR10: User can view a breakdown of tickets sold by sport with counts and percentages
FR11: User can view a breakdown of GTV by sport
FR12: User can view the top 5 events ranked by GTV with sport, event name, and dollar amount
FR13: User can select any historical week to view its dashboard data
FR14: User can view the current (in-progress) week's data for mid-week checks
FR15: User can export a single composite image of the dashboard in a slide-ready format with one click
FR16: User can download an AI-generated talk track script for the current week's WBR update
FR17: The talk track includes headline summary, KPI callouts with WoW deltas, key drivers analysis, context/takeaway, and forward-looking focus areas
FR18: System can generate a 2-4 sentence narrative summary of the week's performance for email delivery
FR19: System can generate a full talk track script matching the style and depth of the historical WBR scripts
FR20: System can analyze week-over-week trends to identify key drivers (demand shifts, sport mix changes, marquee events, inventory gaps)
FR21: System can reference historical weekly context to provide meaningful comparative analysis
FR22: System can send an automated email every Monday morning by 7am ET
FR23: The Monday email includes headline KPIs with WoW deltas in the email body
FR24: The Monday email includes the 2-4 sentence AI-generated narrative summary in the email body
FR25: The Monday email includes the composite dashboard image as an attachment
FR26: The Monday email includes a link to the full dashboard
FR27: Admin can add email addresses to the subscriber list
FR28: Admin can remove email addresses from the subscriber list
FR29: Admin can configure Impact Partner API credentials
FR30: Admin can configure Snowflake connection details
FR31: Admin can configure the daily refresh schedule
FR32: Admin can configure the Monday email delivery schedule
FR33: Admin can view the status of the most recent data pipeline run (success/failure)

### NonFunctional Requirements

NFR1: Dashboard initial load completes within 3 seconds on a standard broadband connection
NFR2: Week selection (switching between historical weeks) renders updated data within 1 second
NFR3: Composite image export generates and downloads within 5 seconds
NFR4: Data pipeline completes full refresh (both sources + reconciliation + storage) within 2 minutes
NFR5: Impact Partner API credentials stored as Vercel environment variables, never exposed to the client
NFR6: Snowflake connection credentials stored as Vercel environment variables, never exposed to the client
NFR7: No credentials committed to source control
NFR8: Supabase access restricted via row-level security or API key scoping - no public read/write access to raw data
NFR9: Dashboard deployed with basic auth or environment-gated access to prevent unauthorized viewing of business data
NFR10: Impact Partner API integration handles rate limits, authentication token refresh, and transient network failures with retry logic
NFR11: Snowflake integration handles connection timeouts and query failures gracefully, with clear error reporting in pipeline status
NFR12: Resend email API integration handles delivery failures and logs send status for each Monday email
NFR13: All external service failures surface clearly in pipeline status rather than failing silently
NFR14: Monday morning email delivers successfully every week - no silent failures
NFR15: If the data pipeline fails, system retries automatically and alerts the admin if retry fails
NFR16: Historical data remains available even if the current day's pipeline run fails
NFR17: System recovers gracefully from partial pipeline failures (e.g., Impact API succeeds but Snowflake fails - surface partial data with clear indication of what's missing)

### Additional Requirements

- AR1: Project initialization using `create-next-app@latest` with Next.js 16.2.4 (--yes flag for defaults: TypeScript, Tailwind CSS, ESLint, App Router, Turbopack)
- AR2: pnpm as the package manager
- AR3: Supabase schema setup: `daily_metrics`, `pipeline_runs`, `subscribers` tables and `weekly_summary` view
- AR4: Auth middleware using env-var password with Next.js middleware + session cookie
- AR5: CRON_SECRET header verification for cron endpoint protection
- AR6: Vercel cron with single daily job; day-of-week check in code for conditional Monday email delivery
- AR7: Snowflake connectivity via REST API (SQL API), not JS SDK, due to serverless constraints
- AR8: Satori (`@vercel/og`) for server-side image generation (email attachment); `html-to-image`/`dom-to-image-more` for client-side export
- AR9: TanStack Query for data fetching and caching on the frontend
- AR10: Recharts for charting (line/area for trends, bar for sport breakdown, table for top events)
- AR11: `date-fns` with `America/New_York` timezone handling for shared week boundary utility
- AR12: Exponential backoff retry wrapper (3 retries: 1s, 2s, 4s) for all external API calls
- AR13: Vercel Git Integration for CI/CD (push to main = deploy)
- AR14: `.env.example` template for required environment variables
- AR15: Direct Supabase client queries from browser (anon key + RLS) for dashboard reads; service role key for server-side writes
- AR16: Consistent API response format: `{ data: T, error: null }` for success, `{ data: null, error: { message, code } }` for errors
- AR17: Starter template noted: Architecture specifies `create-next-app` as Epic 1 Story 1

### UX Design Requirements

N/A - No UX Design document exists for this project.

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR1 | Epic 1 | Pull data from Impact Partner API |
| FR2 | Epic 1 | Query Snowflake for face value, gross profit, tickets |
| FR3 | Epic 1 | Reconcile both sources at date level |
| FR4 | Epic 1 | Aggregate into weekly summaries (Mon-Sun) |
| FR5 | Epic 1 | Store processed data persistently |
| FR6 | Epic 1 | Daily automated pipeline by 7am ET |
| FR7 | Epic 1 | Manual data refresh trigger |
| FR8 | Epic 2 | KPI cards with WoW comparison |
| FR9 | Epic 2 | Weekly trend chart |
| FR10 | Epic 2 | Tickets by sport breakdown |
| FR11 | Epic 2 | GTV by sport breakdown |
| FR12 | Epic 2 | Top 5 events by GTV |
| FR13 | Epic 2 | Historical week selection |
| FR14 | Epic 2 | Current week in-progress view |
| FR15 | Epic 3 | One-click composite image export |
| FR16 | Epic 3 | Talk track download |
| FR17 | Epic 3 | Talk track content structure |
| FR18 | Epic 3 | AI narrative summary (2-4 sentences) |
| FR19 | Epic 3 | Full AI talk track generation |
| FR20 | Epic 3 | WoW trend analysis for key drivers |
| FR21 | Epic 3 | Historical context for comparative analysis |
| FR22 | Epic 4 | Automated Monday email by 7am ET |
| FR23 | Epic 4 | Email includes KPIs with WoW deltas |
| FR24 | Epic 4 | Email includes AI narrative summary |
| FR25 | Epic 4 | Email includes dashboard image attachment |
| FR26 | Epic 4 | Email includes link to dashboard |
| FR27 | Epic 4 | Add email subscribers |
| FR28 | Epic 4 | Remove email subscribers |
| FR29 | Epic 1 | Configure Impact Partner API credentials |
| FR30 | Epic 1 | Configure Snowflake connection |
| FR31 | Epic 1 | Configure daily refresh schedule |
| FR32 | Epic 1 | Configure Monday email schedule |
| FR33 | Epic 2 | Pipeline run status visibility |

## Epic List

### Epic 1: Data Pipeline & Project Foundation
The system automatically pulls ticket sales data from Ticketmaster and Snowflake daily, reconciles both sources, and stores processed weekly data — giving Adam a reliable, automated data backbone for all downstream features.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR29, FR30, FR31, FR32

### Epic 2: Dashboard & Performance Monitoring
Adam can open a live dashboard to view ticket sales KPIs, weekly trends, sport breakdowns, and top events — with the ability to view any historical week or the current in-progress week for mid-week checks.
**FRs covered:** FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR33

### Epic 3: Export & AI-Powered Presentation
Adam can generate WBR presentation materials with one click — a slide-ready composite image and a complete AI-generated talk track with headline summary, KPI callouts, key drivers, and forward-looking analysis.
**FRs covered:** FR15, FR16, FR17, FR18, FR19, FR20, FR21

### Epic 4: Automated Monday Email Delivery
Every Monday morning, an email arrives with headline KPIs, an AI-generated narrative summary, and the dashboard slide image attached — delivered automatically to Adam and any subscribed stakeholders with zero manual effort.
**FRs covered:** FR22, FR23, FR24, FR25, FR26, FR27, FR28

## Epic 1: Data Pipeline & Project Foundation

The system automatically pulls ticket sales data from Ticketmaster and Snowflake daily, reconciles both sources, and stores processed weekly data — giving Adam a reliable, automated data backbone for all downstream features.

### Story 1.1: Project Scaffold with Auth-Protected App Shell

As an admin,
I want a secured Next.js application with database schema and authentication,
So that I have a foundation to build all features on with no unauthorized access to business data.

**Acceptance Criteria:**

**Given** the project does not yet exist
**When** the developer runs `npx create-next-app@latest impact-monitor --yes` and switches to pnpm
**Then** a Next.js 16.2.4 project is created with TypeScript, Tailwind CSS, ESLint, App Router, and Turbopack
**And** `.env.example` documents all required environment variables (Supabase URL, anon key, service role key, TM API credentials, Snowflake credentials, Resend API key, CRON_SECRET, AUTH_PASSWORD)

**Given** the Supabase project is provisioned
**When** the schema SQL is applied
**Then** `daily_metrics`, `pipeline_runs`, and `subscribers` tables exist with the column definitions from the architecture document
**And** a `weekly_summary` SQL view aggregates `daily_metrics` by Monday-Sunday week boundaries
**And** Row Level Security is enabled with read-only access via anon key and full access via service role key

**Given** the app is deployed
**When** an unauthenticated user visits any page except `/login` and `/api/auth/*` and `/api/cron/*`
**Then** they are redirected to the login page

**Given** a user is on the login page
**When** they enter the correct `AUTH_PASSWORD`
**Then** a session cookie is set and they are redirected to the dashboard
**And** the password is verified server-side, never exposed to the client

**Given** a cron endpoint is called
**When** the request does not include a valid `CRON_SECRET` header
**Then** the request is rejected with a 401 response

**Given** the Supabase clients are configured
**When** the browser client is initialized
**Then** it uses the anon key for read-only access
**And** server-side routes use the service role key for write operations

### Story 1.2: Ticketmaster Impact Partner API Client

As an admin,
I want the system to pull ticket sales data from the Ticketmaster Impact Partner API,
So that order, GTV, event, and sport category data flows into the system automatically.

**Acceptance Criteria:**

**Given** valid Impact Partner API credentials are configured in environment variables
**When** the Ticketmaster client is invoked for a date range
**Then** it retrieves ticket sales data including orders, GTV, event details, and sport categories
**And** stores each day's data as rows in `daily_metrics` with `source = 'tm_api'`

**Given** the API returns a rate limit or transient error
**When** a request fails
**Then** the client retries up to 3 times with exponential backoff (1s, 2s, 4s)
**And** surfaces a clear error if all retries fail

**Given** the API authentication token has expired
**When** a request returns an auth error
**Then** the client refreshes the token and retries the request

**Given** the API call succeeds
**When** data is stored in `daily_metrics`
**Then** existing rows for the same date and source are upserted (not duplicated)

### Story 1.3: Snowflake REST API Client

As an admin,
I want the system to query Snowflake for face value, gross profit, and tickets purchased,
So that internal financial metrics complement the Ticketmaster sales data.

**Acceptance Criteria:**

**Given** valid Snowflake credentials are configured in environment variables
**When** the Snowflake client is invoked for a date range
**Then** it queries `PFI_ECOSYSTEM_DAILY_ACTIVITY` via the Snowflake REST API (SQL API)
**And** retrieves face value, gross profit, and tickets purchased per date
**And** stores each day's data as rows in `daily_metrics` with `source = 'snowflake'`

**Given** the Snowflake query times out or fails
**When** a request fails
**Then** the client retries up to 3 times with exponential backoff (1s, 2s, 4s)
**And** surfaces a clear error with detail if all retries fail

**Given** the query succeeds
**When** data is stored in `daily_metrics`
**Then** existing rows for the same date and source are upserted (not duplicated)

**Given** the Snowflake REST API is used
**When** the client runs in a Vercel serverless function
**Then** no native Snowflake SDK dependencies are required (HTTP-only)

### Story 1.4: Data Reconciliation & Weekly Aggregation

As an admin,
I want Ticketmaster and Snowflake data reconciled at the date level with Monday-Sunday weekly summaries,
So that I have a single trustworthy dataset for reporting.

**Acceptance Criteria:**

**Given** both Ticketmaster and Snowflake data exist in `daily_metrics` for overlapping dates
**When** reconciliation runs
**Then** the system merges both sources at the date level without a shared join key (matching by `metric_date`)
**And** produces reconciled rows combining TM fields (orders, GTV, event details, sport) with Snowflake fields (face value, gross profit, tickets purchased)

**Given** the shared week boundary utility is implemented
**When** `getWeekStart(date)` is called
**Then** it returns the Monday 00:00:00 ET for the week containing that date
**And** `getWeekEnd(date)` returns Sunday 23:59:59 ET
**And** `getCurrentWeek()` returns the current week's Monday
**And** `isMonday()` returns true only on Mondays
**And** all functions use `date-fns` with `America/New_York` timezone

**Given** reconciled daily data exists
**When** the `weekly_summary` view is queried
**Then** it returns weekly aggregates (total tickets, orders, GTV, face value, gross profit) grouped by Monday-Sunday boundaries
**And** includes week-over-week deltas for comparison

### Story 1.5: Pipeline Orchestration & Automated Scheduling

As an admin,
I want the full data pipeline to run automatically every day by 7am ET with status visibility,
So that data is always fresh and I know immediately if something goes wrong.

**Acceptance Criteria:**

**Given** the daily cron trigger fires
**When** the pipeline orchestrator runs
**Then** it executes stages sequentially: Ticketmaster pull -> Snowflake pull -> reconciliation -> store
**And** logs each stage's status (running, success, failed) to `pipeline_runs` with timestamps and error details

**Given** one pipeline stage fails (e.g., Snowflake times out but Ticketmaster succeeds)
**When** the orchestrator encounters a stage failure
**Then** it continues processing remaining stages where possible
**And** logs the run as `partial` status with clear indication of which stage failed and why
**And** historical data from previous runs remains available

**Given** a pipeline run fails completely after retries
**When** all retry attempts are exhausted
**Then** the system alerts the admin (via pipeline status visible in the app)
**And** the failure does not silently go unnoticed

**Given** Vercel cron is configured in `vercel.json`
**When** the daily job triggers
**Then** it runs once per day targeting the 7am ET window
**And** the cron endpoint verifies `CRON_SECRET` before executing

**Given** the admin wants to validate data during setup
**When** they call the manual refresh endpoint (`/api/admin/refresh`)
**Then** the full pipeline executes on demand
**And** returns the pipeline run status upon completion

**Given** the pipeline completes within performance bounds
**When** both data sources are queried, reconciled, and stored
**Then** the full refresh completes within 2 minutes

## Epic 2: Dashboard & Performance Monitoring

Adam can open a live dashboard to view ticket sales KPIs, weekly trends, sport breakdowns, and top events — with the ability to view any historical week or the current in-progress week for mid-week checks.

### Story 2.1: KPI Cards with Week-over-Week Comparison

As a user,
I want to see headline KPI cards showing Total Tickets Sold, Total Orders, Total GTV, and Avg Order Value with week-over-week deltas,
So that I can instantly gauge this week's ticket sales performance relative to last week.

**Acceptance Criteria:**

**Given** the dashboard page loads
**When** weekly data exists in Supabase
**Then** four KPI cards display: Total Tickets Sold, Total Orders, Total Revenue/GTV, and Avg Order Value
**And** each card shows the current value and a WoW percentage change (positive/negative indicator)
**And** data is fetched via TanStack Query hooks querying Supabase directly (anon key + RLS)

**Given** the dashboard page loads
**When** data is being fetched
**Then** skeleton placeholders (Tailwind `animate-pulse`) display in place of KPI cards
**And** the full dashboard loads within 3 seconds on a standard broadband connection

**Given** the user clicks the week selector
**When** they choose a historical week
**Then** all KPI cards update to reflect that week's data with WoW comparison against the prior week
**And** the update renders within 1 second

**Given** the user selects the current (in-progress) week
**When** the dashboard renders
**Then** KPI cards show week-to-date values based on available daily data
**And** the display clearly indicates the week is in progress

**Given** the week selector is available
**When** the user views the list of weeks
**Then** all historical weeks with data are available for selection
**And** the current week is the default selection

### Story 2.2: Weekly Trend Chart & Sport Breakdowns

As a user,
I want to see weekly trends over time and breakdowns by sport,
So that I can identify patterns and understand which sports are driving performance.

**Acceptance Criteria:**

**Given** the dashboard is displaying a selected week
**When** weekly trend data is available
**Then** a line/area chart shows tickets sold and GTV plotted over multiple weeks
**And** the chart uses Recharts with clear axis labels, legends, and tooltips
**And** the selected week is visually highlighted on the chart

**Given** the dashboard is displaying a selected week
**When** sport-level data exists
**Then** a bar chart shows tickets sold by sport with counts and percentage of total
**And** a separate bar chart shows GTV by sport with dollar amounts

**Given** the user switches to a different week via the week selector
**When** the charts re-render
**Then** sport breakdown charts update to reflect the newly selected week's data
**And** the trend chart adjusts the highlighted week indicator

### Story 2.3: Top Events Table & Pipeline Status

As a user,
I want to see the top-performing events and know whether the data pipeline ran successfully,
So that I can identify marquee events driving GTV and trust that the data is current.

**Acceptance Criteria:**

**Given** the dashboard is displaying a selected week
**When** event-level data exists
**Then** a table shows the top 5 events ranked by GTV
**And** each row includes the sport, event name, and dollar amount

**Given** the user switches to a different week
**When** the top events table re-renders
**Then** it displays the top 5 events for the newly selected week

**Given** the dashboard loads
**When** `pipeline_runs` data is queried
**Then** a status indicator displays the most recent pipeline run's result (success, partial, or failed)
**And** includes the timestamp of the last successful run
**And** if the last run failed or was partial, a clear message indicates what went wrong

## Epic 3: Export & AI-Powered Presentation

Adam can generate WBR presentation materials with one click — a slide-ready composite image and a complete AI-generated talk track with headline summary, KPI callouts, key drivers, and forward-looking analysis.

### Story 3.1: One-Click Dashboard Image Export

As a user,
I want to export the dashboard as a single composite image with one click,
So that I can drop it directly into the WBR slide deck without screenshotting.

**Acceptance Criteria:**

**Given** the dashboard is displaying data for a selected week
**When** the user clicks the export image button
**Then** a composite PNG image is generated capturing the full dashboard layout (KPI cards, trend chart, sport breakdowns, top events)
**And** the image downloads automatically to the user's device

**Given** the export button is clicked
**When** the image is being generated
**Then** the button shows a loading state to indicate processing
**And** the image generates and downloads within 5 seconds

**Given** the exported image is opened
**When** viewed at presentation resolution
**Then** the image is slide-ready — clean layout, readable text, appropriate dimensions for a standard slide deck
**And** the image is generated client-side using `html-to-image` or `dom-to-image-more` (no server round-trip)

### Story 3.2: AI Narrative & Talk Track Generation

As a user,
I want to generate an AI-powered narrative summary and a full talk track for the selected week,
So that I have a ready-to-use verbal update script for the WBR meeting without manually writing analysis.

**Acceptance Criteria:**

**Given** the user clicks the talk track download button
**When** weekly data and prior week data are available
**Then** the system calls the Claude API to generate a full talk track script
**And** the talk track includes: headline summary, KPI callouts with WoW deltas, key drivers analysis (demand shifts, sport mix changes, marquee events, inventory gaps), context/takeaway, and forward-looking focus areas
**And** the talk track downloads as a text file

**Given** weekly data is available
**When** the AI narrative generator is invoked
**Then** it produces a 2-4 sentence summary of the week's performance suitable for email delivery
**And** the summary matches the analytical depth of manually written WBR scripts

**Given** the AI is generating analysis
**When** historical weekly data exists in Supabase
**Then** the prompt includes historical context (prior weeks' data) to enable meaningful week-over-week comparative analysis
**And** the AI identifies key drivers by comparing sport mix, event performance, and volume trends

**Given** the AI is generating content
**When** the Claude API call is in progress
**Then** the download button shows a loading state
**And** errors from the API surface as a clear message to the user (not a silent failure)

## Epic 4: Automated Monday Email Delivery

Every Monday morning, an email arrives with headline KPIs, an AI-generated narrative summary, and the dashboard slide image attached — delivered automatically to Adam and any subscribed stakeholders with zero manual effort.

### Story 4.1: Monday Email with KPIs, Narrative & Image Attachment

As a user,
I want to receive an automated email every Monday morning with headline KPIs, an AI narrative summary, and the dashboard image attached,
So that my WBR prep is waiting in my inbox with zero effort.

**Acceptance Criteria:**

**Given** the daily cron job fires on a Monday
**When** the pipeline orchestrator detects it is Monday via the `isMonday()` utility
**Then** it triggers the Monday email flow after the data pipeline completes

**Given** the Monday email flow is triggered
**When** the server-side image generator runs
**Then** it produces a composite dashboard PNG using Satori (`@vercel/og`) rendering the same KPI cards, charts, and tables as the web dashboard

**Given** the Monday email is composed
**When** the email is sent via Resend
**Then** the email body includes headline KPIs with WoW deltas (tickets sold, orders, GTV, avg order value)
**And** the email body includes the 2-4 sentence AI-generated narrative summary
**And** the composite dashboard image is included as an attachment
**And** the email includes a link to the full dashboard

**Given** the Resend API encounters a delivery failure
**When** a send attempt fails
**Then** the system retries up to 3 times with exponential backoff
**And** logs the send status (success or failure) to `pipeline_runs`
**And** a failed email delivery surfaces clearly in pipeline status — no silent failures

**Given** the Monday email is delivered
**When** the recipient opens it
**Then** the subject line includes the week number and headline KPIs (e.g., "Week 17: 252 tickets sold (-50% WoW), $33.0K GTV (-60% WoW)")

### Story 4.2: Email Subscriber Management

As an admin,
I want to add and remove email addresses from the subscriber list,
So that stakeholders can receive the Monday email without me forwarding it manually.

**Acceptance Criteria:**

**Given** the admin is on the dashboard
**When** they open the subscriber management UI
**Then** they see a list of all current subscribers with their email addresses

**Given** the admin enters a valid email address
**When** they click add
**Then** the email is added to the `subscribers` table via the `/api/admin/subscribers` POST endpoint
**And** the new subscriber appears in the list immediately

**Given** the admin wants to remove a subscriber
**When** they click remove next to an email address
**Then** the email is deleted from the `subscribers` table via the `/api/admin/subscribers` DELETE endpoint
**And** the subscriber disappears from the list immediately

**Given** the Monday email is triggered
**When** the subscriber list is queried
**Then** the email is sent to all addresses in the `subscribers` table
