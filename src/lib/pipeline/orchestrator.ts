import { createServerClient } from '@/lib/supabase/server';
import { pullTicketmasterData } from '@/lib/pipeline/ticketmaster';
import { fetchSnowflakeData } from '@/lib/pipeline/snowflake';
import { reconcileDailyMetrics } from '@/lib/pipeline/reconcile';
import { format, subDays } from 'date-fns';

export interface StageResult {
  success: boolean;
  error?: string;
  durationMs?: number;
}

export interface PipelineResult {
  overallStatus: 'success' | 'partial' | 'failed';
  stages: {
    tmPull: StageResult;
    snowflakePull: StageResult;
    reconciliation: StageResult;
  };
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

async function runStage(
  name: string,
  fn: () => Promise<void>
): Promise<StageResult> {
  const start = Date.now();
  try {
    await fn();
    return { success: true, durationMs: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      durationMs: Date.now() - start,
    };
  }
}

export async function runFullPipeline(): Promise<PipelineResult> {
  const supabase = createServerClient();
  const startedAt = new Date().toISOString();
  const pipelineStart = Date.now();

  // Date range: last 14 days to handle late-arriving data
  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), 14), 'yyyy-MM-dd');

  // Initialize pipeline run record
  const { data: run, error: runError } = await supabase
    .from('pipeline_runs')
    .insert({ started_at: startedAt, stage: 'full_pipeline', status: 'running' })
    .select()
    .single();

  if (runError || !run) {
    throw new Error(`Failed to initialize pipeline run: ${runError?.message}`);
  }

  // Stage 1: Ticketmaster pull
  const tmPull = await runStage('tm_pull', () =>
    pullTicketmasterData(startDate, endDate)
  );

  // Log TM stage
  await supabase.from('pipeline_runs').insert({
    started_at: startedAt,
    stage: 'tm_pull',
    status: tmPull.success ? 'success' : 'failed',
    error_message: tmPull.error || null,
    completed_at: new Date().toISOString(),
  });

  // Stage 2: Snowflake pull
  const snowflakePull = await runStage('snowflake_pull', () =>
    fetchSnowflakeData({ startDate, endDate })
  );

  // Log Snowflake stage
  await supabase.from('pipeline_runs').insert({
    started_at: startedAt,
    stage: 'snowflake_pull',
    status: snowflakePull.success ? 'success' : 'failed',
    error_message: snowflakePull.error || null,
    completed_at: new Date().toISOString(),
  });

  // Stage 3: Reconciliation (only if at least one source succeeded)
  let reconciliation: StageResult;
  if (tmPull.success || snowflakePull.success) {
    reconciliation = await runStage('reconciliation', () =>
      reconcileDailyMetrics(startDate, endDate).then(() => undefined)
    );
  } else {
    reconciliation = { success: false, error: 'Skipped: no source data available', durationMs: 0 };
  }

  // Log reconciliation stage
  await supabase.from('pipeline_runs').insert({
    started_at: startedAt,
    stage: 'reconciliation',
    status: reconciliation.success ? 'success' : 'failed',
    error_message: reconciliation.error || null,
    completed_at: new Date().toISOString(),
  });

  // Determine overall status
  const stages = { tmPull, snowflakePull, reconciliation };
  const allSuccess = Object.values(stages).every((s) => s.success);
  const allFailed = Object.values(stages).every((s) => !s.success);
  const overallStatus = allSuccess ? 'success' : allFailed ? 'failed' : 'partial';

  const completedAt = new Date().toISOString();

  // Update main pipeline run record
  await supabase
    .from('pipeline_runs')
    .update({ status: overallStatus, completed_at: completedAt })
    .eq('id', run.id);

  return {
    overallStatus,
    stages,
    runId: run.id,
    startedAt,
    completedAt,
    durationMs: Date.now() - pipelineStart,
  };
}
