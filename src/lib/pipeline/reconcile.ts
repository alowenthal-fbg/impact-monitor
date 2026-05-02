import { createServerClient } from '@/lib/supabase/server';
import type { DailyMetric } from '@/lib/supabase/types';

/**
 * Reconciles Ticketmaster and Snowflake data for the given date range.
 *
 * TM (Impact) provides event-level detail: orders, gtv, tickets_sold, face_value, sport, event_name.
 * Snowflake provides date-level aggregates: face_value, gross_profit, tickets_sold (no event breakdown).
 *
 * Strategy:
 * - For each TM event row, carry forward all TM fields as-is.
 * - Allocate Snowflake's date-level gross_profit proportionally across events
 *   based on each event's share of the day's total TM face_value.
 * - If only Snowflake data exists for a date (no TM events), create a single
 *   reconciled row with Snowflake aggregates.
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

  // Group TM rows by date
  const tmByDate = new Map<string, DailyMetric[]>();
  tmData?.forEach((row) => {
    const existing = tmByDate.get(row.metric_date) ?? [];
    existing.push(row);
    tmByDate.set(row.metric_date, existing);
  });

  // Group Snowflake data by date
  const sfByDate = new Map<string, DailyMetric>();
  sfData?.forEach((row) => sfByDate.set(row.metric_date, row));

  // Get all unique dates
  const allDates = new Set<string>();
  tmData?.forEach((row) => allDates.add(row.metric_date));
  sfData?.forEach((row) => allDates.add(row.metric_date));

  const reconciledRows: Partial<DailyMetric>[] = [];

  for (const date of allDates) {
    const sfRow = sfByDate.get(date);
    const tmRows = tmByDate.get(date) ?? [];

    if (tmRows.length > 0) {
      // Calculate day's total face value for proportional allocation
      const dayTotalFace = tmRows.reduce((sum, r) => sum + (r.face_value ?? 0), 0);
      const sfGrossProfit = sfRow?.gross_profit ?? null;

      for (const tmRow of tmRows) {
        // Allocate Snowflake gross_profit proportionally by face_value share
        let allocatedGrossProfit: number | null = null;
        if (sfGrossProfit != null && dayTotalFace > 0) {
          const share = (tmRow.face_value ?? 0) / dayTotalFace;
          allocatedGrossProfit = Math.round(sfGrossProfit * share * 100) / 100;
        }

        reconciledRows.push({
          metric_date: date,
          event_name: tmRow.event_name ?? null,
          sport: tmRow.sport ?? null,
          orders: tmRow.orders ?? null,
          gtv: tmRow.gtv ?? null,
          tickets_sold: tmRow.tickets_sold ?? null,
          face_value: tmRow.face_value ?? null,
          gross_profit: allocatedGrossProfit,
          source: 'reconciled',
        });
      }
    } else if (sfRow) {
      // Only Snowflake data — single aggregate row for the date
      reconciledRows.push({
        metric_date: date,
        event_name: null,
        sport: null,
        orders: null,
        gtv: null,
        tickets_sold: sfRow.tickets_sold ?? null,
        face_value: sfRow.face_value ?? null,
        gross_profit: sfRow.gross_profit ?? null,
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
