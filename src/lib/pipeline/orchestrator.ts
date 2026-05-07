import { createServerClient } from '@/lib/supabase/server';
import { pullTicketmasterData } from '@/lib/pipeline/ticketmaster';
import { pullAmplitudeData } from '@/lib/pipeline/amplitude';
import { sendMondayEmail } from '@/lib/email/send';
import { isMonday } from '@/lib/utils/week';
import { format, startOfYear } from 'date-fns';
import type { WeekData } from '@/lib/ai/narrative';

export interface StageResult {
  success: boolean;
  error?: string;
  durationMs?: number;
}

export interface PipelineResult {
  overallStatus: 'success' | 'failed';
  stages: {
    tmPull: StageResult;
    amplitudePull: StageResult;
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

  // Date range: YTD (full year-to-date for complete historical data)
  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(startOfYear(new Date()), 'yyyy-MM-dd');

  // Initialize pipeline run record
  const { data: run, error: runError } = await supabase
    .from('pipeline_runs')
    .insert({ started_at: startedAt, stage: 'full_pipeline', status: 'running' })
    .select()
    .single();

  if (runError || !run) {
    throw new Error(`Failed to initialize pipeline run: ${runError?.message}`);
  }

  // Stage 1: Ticketmaster (Impact) pull
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

  // Stage 2: Amplitude ticketing-traffic pull (non-fatal — tab-traffic is a
  // secondary signal, so a failure shouldn't mark the whole pipeline as failed)
  const amplitudePull = await runStage('amplitude_pull', () =>
    pullAmplitudeData(30)
  );

  await supabase.from('pipeline_runs').insert({
    started_at: startedAt,
    stage: 'amplitude_pull',
    status: amplitudePull.success ? 'success' : 'failed',
    error_message: amplitudePull.error || null,
    completed_at: new Date().toISOString(),
  });

  // Determine overall status — only tm_pull is load-bearing for commercial reporting
  const overallStatus = tmPull.success ? 'success' : 'failed';

  const completedAt = new Date().toISOString();

  // Update main pipeline run record
  await supabase
    .from('pipeline_runs')
    .update({ status: overallStatus, completed_at: completedAt })
    .eq('id', run.id);

  // Monday email stage — only on Mondays, after pipeline stages complete
  if (isMonday()) {
    await supabase.from('pipeline_runs').insert({
      started_at: new Date().toISOString(),
      stage: 'monday_email',
      status: 'running',
    });

    try {
      const { data: weekRows } = await supabase
        .from('weekly_summary')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(2);

      if (weekRows && weekRows.length > 0) {
        const toWeekData = (row: typeof weekRows[0]): WeekData => ({
          weekStart: row.week_start,
          totalTickets: row.total_tickets ?? 0,
          totalOrders: row.total_orders ?? 0,
          totalGtv: row.total_gtv ?? 0,
          totalFaceValue: row.total_face_value ?? 0,
          totalGrossProfit: row.total_gross_profit ?? 0,
        });

        await sendMondayEmail(
          toWeekData(weekRows[0]),
          weekRows.length > 1 ? toWeekData(weekRows[1]) : null
        );

        await supabase.from('pipeline_runs').insert({
          started_at: startedAt,
          stage: 'monday_email',
          status: 'success',
          completed_at: new Date().toISOString(),
        });
      } else {
        await supabase.from('pipeline_runs').insert({
          started_at: startedAt,
          stage: 'monday_email',
          status: 'failed',
          error_message: 'No weekly data available for email',
          completed_at: new Date().toISOString(),
        });
      }
    } catch (emailError) {
      const errorMessage = emailError instanceof Error ? emailError.message : 'Email send failed';
      console.error('Monday email failed:', errorMessage);
      await supabase.from('pipeline_runs').insert({
        started_at: startedAt,
        stage: 'monday_email',
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      });
      // Email failure does not fail the overall pipeline
    }
  }

  return {
    overallStatus,
    stages: { tmPull, amplitudePull },
    runId: run.id,
    startedAt,
    completedAt,
    durationMs: Date.now() - pipelineStart,
  };
}
