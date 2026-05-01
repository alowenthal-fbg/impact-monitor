---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
releaseMode: phased
inputDocuments: []
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - Impact Monitor

**Author:** Adam
**Date:** 2026-04-29

## Executive Summary

Impact Monitor automates weekly business review preparation for the Fanatics App Ticketing team. The product pulls ticket sales data from two sources — the Ticketmaster Impact Partner API (orders, GTV, event details, sport categories) and Snowflake's `PFI_ECOSYSTEM_DAILY_ACTIVITY` table (face value, gross profit, tickets purchased) — and reconciles them at the date level using Monday–Sunday week boundaries.

The primary user is the Ticketing PM who currently spends ~30 minutes each week downloading reports, uploading CSVs into a vibe-coded dashboard, screenshotting charts to build a slide, then feeding that slide to ChatGPT for narrative analysis. Impact Monitor eliminates this entire manual workflow.

The product delivers three outputs: (1) a live web dashboard for on-demand performance monitoring, (2) a one-click exportable composite image for the WBR slide deck, and (3) a downloadable talk track with AI-generated week-over-week analysis. An automated Monday morning email delivers the headline KPIs, a 2-4 sentence narrative summary, and the slide image as an attachment — with subscriber support so other stakeholders can receive it too.

Impact Monitor is not a dashboard you go check — it's an automated delivery system. The data already exists across two sources; the problem is the manual assembly, analysis, and presentation. By automating the full pipeline from data pull to presentation-ready output, the product reduces WBR prep from a multi-step manual process to zero touches. Monday morning, the email is waiting — KPIs, narrative, slide attachment, done.

## Project Classification

- **Type:** Web application (dashboard + export + automated delivery)
- **Domain:** Internal business intelligence / reporting
- **Complexity:** Medium (dual data sources requiring date-level reconciliation without a join key)
- **Context:** Greenfield — replacing a manual workflow, not extending existing codebase

## Success Criteria

### User Success

- WBR prep time drops from ~30 minutes/week to effectively zero — open email, grab attachment, read summary, done
- Monday morning email arrives by 7am ET with KPIs, narrative summary, and slide image attached
- AI-generated 2-4 sentence summary matches the quality and analytical depth of the manually written scripts (validated by comparing against historical examples)
- Dashboard data refreshes daily by 7am ET for ad-hoc performance checks throughout the week
- One-click image export produces a slide-ready composite matching the current visual format
- Talk track download provides a complete verbal update script ready for the WBR meeting

### Business Success

- Complete elimination of the manual download → upload → screenshot → ChatGPT workflow
- Stakeholders self-serve by subscribing to the Monday email, reducing ad-hoc requests
- Reliable, consistent reporting cadence — no missed weeks due to PM being out or busy

### Technical Success

- Data pipeline pulls from both Impact Partner API and Snowflake `PFI_ECOSYSTEM_DAILY_ACTIVITY` daily by 7am ET
- Date-level reconciliation produces consistent, trustworthy numbers using Monday–Sunday week boundaries
- Automated email delivery is reliable — no silent failures
- Dashboard loads in under 3 seconds for daily quick-checks

### Measurable Outcomes

- Weekly prep time: 30 min → 0 min (target: < 2 min for any manual review)
- Data freshness: updated daily by 7am ET
- Email delivery: 100% reliability on Monday mornings
- AI summary quality: PM approves without edits >80% of weeks

## User Journeys

### Journey 1: Adam's Monday Morning — The Zero-Touch WBR Prep (Primary, Happy Path)

It's Monday at 6:45am. Adam opens his inbox on his phone before even getting out of bed. There's an email from Impact Monitor: "Week 17: 252 tickets sold (-50% WoW), $33.0K GTV (-60% WoW)." The subject line alone tells him it was a rough week. He reads the 2-4 sentence summary in the email body — it calls out the demand pullback and flags the Knicks inventory gap as a likely driver. The slide image is attached.

By the time Adam sits down at his desk, he drags the image into the WBR slide deck. He clicks through to the app to skim the full talk track, tweaks one sentence to add color about a conversation he had with the Ticketmaster team, and downloads it. He's ready for the WBR. Total time: under 2 minutes. Last week this took 30.

### Journey 2: Adam's Mid-Week Check — Something Feels Off (Primary, Edge Case)

It's Wednesday afternoon. Adam hears from a colleague that Knicks playoff tickets are showing zero inventory in the app. He opens Impact Monitor to check the current week's numbers so far. The dashboard shows the week-to-date is tracking well below the prior week's pace. He spots that basketball GTV is unusually low. He screenshots the current state to share in a Slack thread with the CRM team, flagging that they should pull back on promoting Knicks games until inventory is available.

Later, the data refreshes Thursday morning and he checks again — still soft. By the time Monday's email arrives, the narrative already captures this story. No surprises.

### Journey 3: Adam's VP Gets the Email — Passive Stakeholder (Subscriber)

Adam's VP, who runs the weekly business review, has been subscribed to the Monday email. She opens it at 7:15am, scans the KPIs and the 2-4 sentence summary. She already knows the headline before Adam presents. During the WBR, she asks a pointed follow-up: "You mentioned the Knicks inventory issue — how many other events had zero inventory this week?" Adam makes a mental note — that's a question for the chatbot in v2.

### Journey 4: Adam Sets Up the System — First-Time Configuration (Admin/Setup)

Adam deploys Impact Monitor and needs to configure it. He connects the Impact Partner API using his existing credentials from `~/.tm_credentials`. He configures the Snowflake connection to pull from `PFI_ECOSYSTEM_DAILY_ACTIVITY`. He sets the week boundary to Monday–Sunday, confirms the 7am ET refresh schedule, and adds his email plus his VP's email to the subscriber list. He triggers a manual refresh to verify the data looks right, compares a few weeks against the existing vibe-coded app to validate the numbers match, and marks the system as live.

### Journey Requirements Summary

| Capability | Journeys |
|---|---|
| Automated daily data pipeline (Impact API + Snowflake) | 1, 2, 4 |
| Monday email with KPIs, summary, image attachment | 1, 3 |
| AI-generated 2-4 sentence narrative summary | 1, 3 |
| AI-generated full talk track | 1 |
| One-click composite image export | 1 |
| Live dashboard with week-to-date data | 2 |
| Daily refresh by 7am ET | 1, 2 |
| Email subscriber management | 3, 4 |
| Data source configuration | 4 |
| Manual refresh trigger for validation | 4 |
| Week boundary configuration (Mon–Sun) | 4 |

## Web App Specific Requirements

### Project-Type Overview

Impact Monitor is a single-page application (React) deployed on Vercel's free tier. It serves a single primary user with daily batch data refreshes — no real-time requirements, no SEO, no accessibility mandates. The architecture prioritizes simplicity and zero-cost hosting over scalability.

### Technical Architecture Considerations

- **Frontend:** React SPA (Vite or Next.js static export)
- **Backend:** Vercel serverless functions for API routes and data pipeline
- **Hosting:** Vercel free tier — covers SPA, serverless functions, and cron jobs
- **Database:** Supabase (free tier Postgres) for storing processed weekly data, subscriber list, and pipeline state
- **Email:** Resend (free tier, 3,000 emails/month) for Monday morning automated emails with image attachments
- **Scheduled Jobs:** Vercel cron — daily 7am ET refresh + Monday morning email trigger
- **Browser Support:** Chrome and Safari (latest versions)
- **Authentication:** None required — single-user internal tool (consider basic auth or environment-gated access if deploying publicly on Vercel)

### Data Pipeline Architecture

- **Daily at 7am ET:** Vercel cron triggers a serverless function that:
  1. Pulls latest data from Impact Partner API (using credentials from environment variables)
  2. Queries Snowflake `PFI_ECOSYSTEM_DAILY_ACTIVITY` for face value, gross profit, tickets purchased
  3. Reconciles both sources at the date level using Monday–Sunday week boundaries
  4. Stores processed weekly aggregates in Supabase
- **Monday at 7am ET:** Additional cron triggers:
  1. Generates composite dashboard image (server-side rendering or headless screenshot)
  2. Generates AI narrative summary (2-4 sentences) and full talk track via LLM API
  3. Sends email via Resend with KPIs in body, narrative summary, and image attachment
  4. Delivers to all subscribers in the subscriber list

### Implementation Considerations

- Ticketmaster API credentials stored as Vercel environment variables (migrated from `~/.tm_credentials`)
- Snowflake connection via serverless function — may need the Snowflake JavaScript SDK or a REST API approach to avoid native driver issues in serverless environments
- Image generation for email attachment: consider using a headless browser (Puppeteer on Vercel) or a canvas-based rendering library to capture the dashboard composite
- AI narrative generation: Claude API or OpenAI API for the talk track and email summary — needs access to historical week data for WoW comparison
- Supabase row-level data keeps the frontend simple — React app just fetches pre-processed JSON from Supabase, no client-side data crunching

## Product Scope & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — deliver the complete WBR automation pipeline end-to-end. The product is useful the moment it replaces the manual workflow, even if it lacks advanced features.

**Resource Requirements:** Solo developer (Adam) with Claude Code. Favor proven libraries, minimal custom infrastructure, and managed services (Vercel, Supabase, Resend) to avoid ops overhead.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Journey 1: Zero-touch Monday WBR prep (email + image + talk track)
- Journey 2: Mid-week dashboard check (daily refresh)
- Journey 4: Initial system setup and configuration

**Must-Have Capabilities:**
- Automated daily data pipeline — Impact Partner API + Snowflake → Supabase, refreshed by 7am ET
- Date-level reconciliation using Monday–Sunday week boundaries
- Live React dashboard with KPI cards, weekly trend chart, tickets/GTV by sport, top 5 events by GTV
- One-click composite image export (slide-ready)
- AI-generated full talk track (downloadable)
- Automated Monday morning email with headline KPIs, 2-4 sentence AI narrative, and slide image attachment
- Email subscriber management (add/remove recipients)
- Manual refresh trigger for data validation during setup

### Phase 2: Enhancement (Post-MVP)

- Conversational data interface (chatbot) — ask questions about the data ("Why did GTV drop this week?", "Which sport drove the most growth?")
- Monthly reporting view and MBR automation
- Anomaly detection — flag unusual WoW swings automatically
- Inventory monitoring alerts (flag low-inventory high-demand events)

### Phase 3: Vision (Future)

- Proactive insights pushed via Slack or email ("Knicks playoff game has zero inventory — flagging for CRM")
- Predictive forecasting based on seasonal patterns and event calendar
- Multi-stakeholder dashboards with role-based views
- Direct Google Slides integration (auto-update the slide deck)

### Risk Mitigation Strategy

**Technical Risks:**
- *Snowflake in serverless:* Snowflake JS SDK in Vercel serverless functions may have cold-start or timeout issues. Mitigation: test early, fall back to Snowflake REST API if needed.
- *Image generation:* Server-side composite image generation on Vercel's free tier may hit memory/time limits. Mitigation: start with client-side canvas rendering + download button; add server-side generation for email attachment as a fast-follow if needed.
- *AI narrative quality:* LLM-generated summaries may miss nuance or misread the data. Mitigation: provide rich historical context and past script examples as few-shot prompts; build in a "review before send" option initially.

**Resource Risks:**
- Solo developer — no redundancy. Mitigation: keep architecture simple, use managed services, avoid custom infrastructure. If any single component proves too complex, simplify or defer it.
- Vercel free tier limits — 100GB bandwidth, 100K serverless invocations/month. For single-user usage, this is more than sufficient. Monitor and upgrade only if needed.

## Functional Requirements

### Data Pipeline & Ingestion

- FR1: System can pull ticket sales data from the Impact Partner API on a scheduled basis
- FR2: System can query Snowflake `PFI_ECOSYSTEM_DAILY_ACTIVITY` for face value, gross profit, and tickets purchased on a scheduled basis
- FR3: System can reconcile Impact API and Snowflake data at the date level without a shared join key
- FR4: System can aggregate transaction-level data into weekly summaries using Monday–Sunday boundaries
- FR5: System can store processed weekly data persistently for historical access
- FR6: System can execute the data pipeline daily by 7am ET automatically
- FR7: Admin can trigger a manual data refresh on demand

### Dashboard & Visualization

- FR8: User can view headline KPI cards (Total Tickets Sold, Total Orders, Total Revenue/GTV, Avg Order Value) with week-over-week comparison and percentage change
- FR9: User can view a weekly trend chart tracking tickets sold and GTV over time
- FR10: User can view a breakdown of tickets sold by sport with counts and percentages
- FR11: User can view a breakdown of GTV by sport
- FR12: User can view the top 5 events ranked by GTV with sport, event name, and dollar amount
- FR13: User can select any historical week to view its dashboard data
- FR14: User can view the current (in-progress) week's data for mid-week checks

### Export & Presentation

- FR15: User can export a single composite image of the dashboard in a slide-ready format with one click
- FR16: User can download an AI-generated talk track script for the current week's WBR update
- FR17: The talk track includes headline summary, KPI callouts with WoW deltas, key drivers analysis, context/takeaway, and forward-looking focus areas

### AI Narrative Generation

- FR18: System can generate a 2-4 sentence narrative summary of the week's performance for email delivery
- FR19: System can generate a full talk track script matching the style and depth of the historical WBR scripts
- FR20: System can analyze week-over-week trends to identify key drivers (demand shifts, sport mix changes, marquee events, inventory gaps)
- FR21: System can reference historical weekly context to provide meaningful comparative analysis

### Automated Email Delivery

- FR22: System can send an automated email every Monday morning by 7am ET
- FR23: The Monday email includes headline KPIs with WoW deltas in the email body
- FR24: The Monday email includes the 2-4 sentence AI-generated narrative summary in the email body
- FR25: The Monday email includes the composite dashboard image as an attachment
- FR26: The Monday email includes a link to the full dashboard
- FR27: Admin can add email addresses to the subscriber list
- FR28: Admin can remove email addresses from the subscriber list

### System Configuration

- FR29: Admin can configure Impact Partner API credentials
- FR30: Admin can configure Snowflake connection details
- FR31: Admin can configure the daily refresh schedule
- FR32: Admin can configure the Monday email delivery schedule
- FR33: Admin can view the status of the most recent data pipeline run (success/failure)

## Non-Functional Requirements

### Performance

- Dashboard initial load completes within 3 seconds on a standard broadband connection
- Week selection (switching between historical weeks) renders updated data within 1 second
- Composite image export generates and downloads within 5 seconds
- Data pipeline completes full refresh (both sources + reconciliation + storage) within 2 minutes

### Security

- Impact Partner API credentials stored as Vercel environment variables, never exposed to the client
- Snowflake connection credentials stored as Vercel environment variables, never exposed to the client
- No credentials committed to source control
- Supabase access restricted via row-level security or API key scoping — no public read/write access to raw data
- Dashboard deployed with basic auth or environment-gated access to prevent unauthorized viewing of business data

### Integration

- Impact Partner API: system handles API rate limits, authentication token refresh, and transient network failures with retry logic
- Snowflake: system handles connection timeouts and query failures gracefully, with clear error reporting in pipeline status (FR33)
- Resend email API: system handles delivery failures and logs send status for each Monday email
- All external service failures surface clearly in pipeline status rather than failing silently

### Reliability

- Monday morning email delivers successfully every week — no silent failures
- If the data pipeline fails, system retries automatically and alerts the admin (via email or dashboard status indicator) if retry fails
- Historical data remains available even if the current day's pipeline run fails
- System recovers gracefully from partial pipeline failures (e.g., Impact API succeeds but Snowflake fails — surface partial data with clear indication of what's missing)
