import { createServerClient } from '@/lib/supabase/server';
import type { DailyMetric } from '@/lib/supabase/types';

/**
 * Reconciles Ticketmaster and Snowflake data for the given date range.
 * Creates reconciled rows in daily_metrics combining both sources.
 */
export async function reconcileDailyMetrics(
  startDate: string,
  endDate: string
): Promise<{ reconciledCount: number }> {
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

  // Group TM data by metric_date + event_name for matching
  const tmByKey = new Map<string, DailyMetric>();
  tmData?.forEach((row) => {
    const key = `${row.metric_date}|${row.event_name ?? ''}`;
    tmByKey.set(key, row);
  });

  // Group Snowflake data by metric_date (Snowflake rows have no event_name)
  const sfByDate = new Map<string, DailyMetric>();
  sfData?.forEach((row) => sfByDate.set(row.metric_date, row));

  // Get all unique dates from both sources
  const allDates = new Set<string>();
  tmData?.forEach((row) => allDates.add(row.metric_date));
  sfData?.forEach((row) => allDates.add(row.metric_date));

  // Create reconciled rows
  const reconciledRows: Partial<DailyMetric>[] = [];

  for (const date of allDates) {
    const sfRow = sfByDate.get(date);

    // Find all TM rows for this date
    const tmRowsForDate = (tmData ?? []).filter((r) => r.metric_date === date);

    if (tmRowsForDate.length > 0) {
      // Create a reconciled row per TM event, enriching with Snowflake data
      for (const tmRow of tmRowsForDate) {
        reconciledRows.push({
          metric_date: date,
          orders: tmRow.orders ?? null,
          gtv: tmRow.gtv ?? null,
          sport: tmRow.sport ?? null,
          event_name: tmRow.event_name ?? null,
          face_value: sfRow?.face_value ?? null,
          gross_profit: sfRow?.gross_profit ?? null,
          tickets_sold: sfRow?.tickets_sold ?? null,
          source: 'reconciled',
        });
      }
    } else if (sfRow) {
      // Only Snowflake data exists for this date
      reconciledRows.push({
        metric_date: date,
        orders: null,
        gtv: null,
        sport: null,
        event_name: null,
        face_value: sfRow.face_value ?? null,
        gross_profit: sfRow.gross_profit ?? null,
        tickets_sold: sfRow.tickets_sold ?? null,
        source: 'reconciled',
      });
    }
  }

  if (reconciledRows.length === 0) {
    return { reconciledCount: 0 };
  }

  // Upsert reconciled rows
  const { error: upsertError } = await supabase
    .from('daily_metrics')
    .upsert(reconciledRows, {
      onConflict: 'metric_date,event_name,source',
    });

  if (upsertError) {
    throw new Error(`Failed to upsert reconciled data: ${upsertError.message}`);
  }

  return { reconciledCount: reconciledRows.length };
}
