# Story 1.5: Pipeline Orchestration & Automated Scheduling

Status: ready-for-dev

## Story

As an admin,
I want the full data pipeline to run automatically every day by 7am ET with status visibility,
so that data is always fresh and I know immediately if something goes wrong.

## Acceptance Criteria

1. Daily cron triggers pipeline orchestrator which executes sequentially: TM pull → Snowflake pull → reconciliation → store. Logs each stage status to pipeline_runs table.
2. On stage failure, continues remaining stages where possible, logs as 'partial' with detail of which stage failed. Historical data preserved.
3. On complete failure after retries, alerts admin via pipeline_runs status (visible in app).
4. Vercel cron configured in vercel.json, runs once/day targeting 7am ET, verifies CRON_SECRET before executing.
5. Manual refresh endpoint /api/admin/refresh executes full pipeline on demand, returns status.
6. Full refresh completes within 2 minutes.

## Tasks / Subtasks

- [ ] Task 1: Create pipeline orchestrator (AC: #1, #2, #3)
  - [ ] Create `src/lib/pipeline/orchestrator.ts`
  - [ ] Implement `runFullPipeline()` function with stage sequencing
  - [ ] Log each stage start/completion to `pipeline_runs` table
  - [ ] Handle partial failures: continue remaining stages, mark run as 'partial'
  - [ ] Handle complete failures: log as 'failed' with error details
  - [ ] Return summary object with per-stage results
- [ ] Task 2: Create cron endpoint (AC: #4)
  - [ ] Create `src/app/api/cron/daily-refresh/route.ts`
  - [ ] Verify CRON_SECRET via Authorization header (handled by proxy.ts)
  - [ ] Call `runFullPipeline()` from orchestrator
  - [ ] Return 200 with execution summary on success
  - [ ] Return 500 with error details on failure
- [ ] Task 3: Create manual refresh endpoint (AC: #5)
  - [ ] Create `src/app/api/admin/refresh/route.ts`
  - [ ] Protect with session auth (handled by proxy.ts)
  - [ ] Call `runFullPipeline()` from orchestrator
  - [ ] Return execution summary with per-stage status
- [ ] Task 4: Update Vercel cron configuration (AC: #4)
  - [ ] Update `vercel.json` cron path to `/api/cron/daily-refresh`
  - [ ] Set schedule to `"0 12 * * *"` (12 UTC ≈ 7-8am ET)
  - [ ] Document Hobby tier constraints (±59min precision)
- [ ] Task 5: Verify performance (AC: #6)
  - [ ] Test full pipeline execution time
  - [ ] Ensure completion within 2 minutes
  - [ ] Log timing metrics per stage

## Dev Notes

### Pipeline Orchestrator Architecture

The orchestrator at `src/lib/pipeline/orchestrator.ts` is the central coordinator that:
1. Executes stages sequentially in order: TM pull → Snowflake pull → reconciliation → store
2. Logs each stage to `pipeline_runs` table with status tracking
3. Handles failures gracefully: partial (some stages failed) vs complete (all failed)
4. Returns structured results for API consumption

**Key design principles:**
- Each stage function returns `{ success: boolean, error?: string }` for uniform handling
- Orchestrator catches stage errors and continues where possible
- Historical data never deleted — only appended to
- Pipeline runs logged with stage granularity for debugging

### Stage Functions (from previous stories)

```typescript
// Story 1.2: Ticketmaster data pull
import { pullTicketmasterData } from '@/lib/pipeline/ticketmaster';

// Story 1.3: Snowflake data pull
import { pullSnowflakeData } from '@/lib/pipeline/snowflake';

// Story 1.4: Reconciliation
import { reconcileData } from '@/lib/pipeline/reconcile';
```

### Orchestrator Implementation Pattern

```typescript
// src/lib/pipeline/orchestrator.ts
import { createServerClient } from '@/lib/supabase/server';
import { pullTicketmasterData } from '@/lib/pipeline/ticketmaster';
import { pullSnowflakeData } from '@/lib/pipeline/snowflake';
import { reconcileData } from '@/lib/pipeline/reconcile';

interface StageResult {
  success: boolean;
  error?: string;
}

interface PipelineResult {
  overallStatus: 'success' | 'partial' | 'failed';
  stages: {
    tmPull: StageResult;
    snowflakePull: StageResult;
    reconciliation: StageResult;
  };
  runId: string;
  startedAt: string;
  completedAt: string;
}

export async function runFullPipeline(): Promise<PipelineResult> {
  const supabase = createServerClient();
  const startTime = new Date().toISOString();

  // Initialize pipeline run record
  const { data: run, error: runError } = await supabase
    .from('pipeline_runs')
    .insert({
      started_at: startTime,
      stage: 'initialization',
      status: 'running'
    })
    .select()
    .single();

  if (runError || !run) {
    throw new Error(`Failed to initialize pipeline run: ${runError?.message}`);
  }

  const results: PipelineResult = {
    overallStatus: 'success',
    stages: {
      tmPull: { success: false },
      snowflakePull: { success: false },
      reconciliation: { success: false }
    },
    runId: run.id,
    startedAt: startTime,
    completedAt: ''
  };

  // Stage 1: Ticketmaster pull
  try {
    await supabase.from('pipeline_runs').update({
      stage: 'tm_pull',
      status: 'running'
    }).eq('id', run.id);

    const tmResult = await pullTicketmasterData();
    results.stages.tmPull = tmResult;

    await supabase.from('pipeline_runs').insert({
      started_at: startTime,
      stage: 'tm_pull',
      status: tmResult.success ? 'success' : 'failed',
      error_message: tmResult.error,
      completed_at: new Date().toISOString()
    });
  } catch (err) {
    results.stages.tmPull = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }

  // Stage 2: Snowflake pull
  try {
    await supabase.from('pipeline_runs').update({
      stage: 'snowflake_pull',
      status: 'running'
    }).eq('id', run.id);

    const sfResult = await pullSnowflakeData();
    results.stages.snowflakePull = sfResult;

    await supabase.from('pipeline_runs').insert({
      started_at: startTime,
      stage: 'snowflake_pull',
      status: sfResult.success ? 'success' : 'failed',
      error_message: sfResult.error,
      completed_at: new Date().toISOString()
    });
  } catch (err) {
    results.stages.snowflakePull = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }

  // Stage 3: Reconciliation (only if at least one source succeeded)
  if (results.stages.tmPull.success || results.stages.snowflakePull.success) {
    try {
      await supabase.from('pipeline_runs').update({
        stage: 'reconciliation',
        status: 'running'
      }).eq('id', run.id);

      const reconcileResult = await reconcileData();
      results.stages.reconciliation = reconcileResult;

      await supabase.from('pipeline_runs').insert({
        started_at: startTime,
        stage: 'reconciliation',
        status: reconcileResult.success ? 'success' : 'failed',
        error_message: reconcileResult.error,
        completed_at: new Date().toISOString()
      });
    } catch (err) {
      results.stages.reconciliation = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  } else {
    results.stages.reconciliation = {
      success: false,
      error: 'Skipped: no source data available'
    };
  }

  // Determine overall status
  const allSuccess = Object.values(results.stages).every(s => s.success);
  const allFailed = Object.values(results.stages).every(s => !s.success);

  results.overallStatus = allSuccess ? 'success' : allFailed ? 'failed' : 'partial';
  results.completedAt = new Date().toISOString();

  // Update final pipeline run record
  await supabase.from('pipeline_runs').update({
    status: results.overallStatus,
    completed_at: results.completedAt
  }).eq('id', run.id);

  return results;
}
```

### Cron Endpoint Implementation

```typescript
// src/app/api/cron/daily-refresh/route.ts
import { NextRequest } from 'next/server';
import { runFullPipeline } from '@/lib/pipeline/orchestrator';
import { successResponse, errorResponse } from '@/lib/utils/api';

export async function GET(request: NextRequest) {
  try {
    // CRON_SECRET verification handled by proxy.ts
    const result = await runFullPipeline();

    return successResponse({
      message: 'Pipeline completed',
      result
    });
  } catch (error) {
    console.error('Pipeline execution failed:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Pipeline execution failed',
      'PIPELINE_ERROR',
      500
    );
  }
}
```

### Manual Refresh Endpoint Implementation

```typescript
// src/app/api/admin/refresh/route.ts
import { NextRequest } from 'next/server';
import { runFullPipeline } from '@/lib/pipeline/orchestrator';
import { successResponse, errorResponse } from '@/lib/utils/api';

export async function POST(request: NextRequest) {
  try {
    // Session auth verification handled by proxy.ts
    const result = await runFullPipeline();

    return successResponse({
      message: 'Manual refresh completed',
      result
    });
  } catch (error) {
    console.error('Manual refresh failed:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Manual refresh failed',
      'REFRESH_ERROR',
      500
    );
  }
}
```

### Vercel Cron Configuration

```json
// vercel.json (updated from Story 1.1 stub)
{
  "crons": [{
    "path": "/api/cron/daily-refresh",
    "schedule": "0 12 * * *"
  }]
}
```

**Schedule details:**
- `0 12 * * *` = 12:00 UTC daily
- 12:00 UTC ≈ 7:00am ET (standard time) or 8:00am ET (daylight time)
- Hobby tier: ±59 min precision (runs between 12:00-12:59 UTC)
- Minimum frequency: once per day

**CRON_SECRET verification:**
- Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` header
- Verification handled by `proxy.ts` (from Story 1.1)
- No additional auth logic needed in route handler

### Error Handling & Resilience

**Partial failure behavior:**
1. If TM API fails but Snowflake succeeds → mark as 'partial', continue to reconciliation
2. If Snowflake fails but TM succeeds → mark as 'partial', continue to reconciliation
3. If both sources fail → mark as 'failed', skip reconciliation
4. If reconciliation fails → mark as 'partial', preserve source data

**Historical data preservation:**
- Never delete existing `daily_metrics` rows
- New data appended with latest `created_at` timestamp
- Reconciliation creates new 'reconciled' source rows, doesn't modify TM or Snowflake rows
- Pipeline run history in `pipeline_runs` table never deleted

**Visibility for admins:**
- Pipeline status visible via `pipeline_runs` table queries
- Future story (admin dashboard) will surface latest run status in UI
- Manual refresh endpoint allows immediate retry after fixing issues

### Performance Targets (AC #6)

**2-minute completion target:**
- TM API pull: ~30 seconds (10 events × 3s each, with retry logic)
- Snowflake query: ~30 seconds (single query with 30-day lookback)
- Reconciliation: ~5 seconds (in-memory matching logic)
- Database writes: ~10 seconds (batch inserts)
- Buffer: ~45 seconds for retries/overhead

**Performance monitoring:**
- Log stage timing in pipeline_runs records
- Monitor via Vercel function logs
- If approaching 2-minute limit: consider parallel source pulls in future iteration

### Project Structure (files created in this story)

```
impact-monitor/
├── vercel.json (updated)
└── src/
    ├── app/
    │   └── api/
    │       ├── cron/
    │       │   └── daily-refresh/
    │       │       └── route.ts
    │       └── admin/
    │           └── refresh/
    │               └── route.ts
    └── lib/
        └── pipeline/
            └── orchestrator.ts
```

### Critical Conventions

- **File naming:** kebab-case for all files
- **Function naming:** camelCase (e.g., `runFullPipeline`, not `run_full_pipeline`)
- **Type naming:** PascalCase (e.g., `PipelineResult`, `StageResult`)
- **No barrel files:** Import directly from source files
- **Error handling:** Always return `{ success, error? }` from stage functions
- **Logging:** Use pipeline_runs table, not console.log for production tracking
- **Date handling:** ISO 8601 strings for timestamps

### Testing Strategy

**Manual testing:**
1. Call `/api/admin/refresh` POST endpoint (requires session cookie)
2. Verify pipeline_runs table shows all stages logged
3. Verify daily_metrics table populated with data from all sources
4. Test partial failure: temporarily break one source, verify pipeline continues
5. Test complete failure: break all sources, verify 'failed' status logged

**Cron testing:**
1. Deploy to Vercel with cron configured
2. Wait for scheduled execution (or trigger via Vercel dashboard)
3. Verify CRON_SECRET validation (test with wrong secret → 401)
4. Check Vercel function logs for execution confirmation

### References

- [Source: {output_folder}/planning-artifacts/epics.md#Epic 1: Core Data Pipeline - Story 1.5]
- [Source: {output_folder}/planning-artifacts/architecture.md#Data Pipeline Architecture]
- [Source: {output_folder}/planning-artifacts/architecture.md#Error Handling & Resilience]
- [Source: {output_folder}/planning-artifacts/prd.md#Non-Functional Requirements - Performance]
- [Source: {output_folder}/implementation-artifacts/1-1-project-scaffold-auth.md#Auth Proxy Pattern]
- [Source: {output_folder}/implementation-artifacts/1-1-project-scaffold-auth.md#Vercel Cron Configuration]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
