'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { format, subWeeks, startOfWeek, addDays, differenceInDays } from 'date-fns';

interface ForecastRow {
  metric_date: string;
  tickets_sold: number | null;
  orders: number | null;
  gtv: number | null;
}

export interface DayPacePoint {
  dayIndex: number; // 0=Mon, 1=Tue, ... 6=Sun
  dayLabel: string;
  actual: number | null;
  baseline: number;
  baselineMin: number;
  baselineMax: number;
  projected: number | null;
  forecast: number | null; // Commercial team forecast
}

export interface WeekPaceData {
  tickets: DayPacePoint[];
  orders: DayPacePoint[];
  gtv: DayPacePoint[];
  currentDayIndex: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface DailyRow {
  metric_date: string;
  tickets_sold: number | null;
  orders: number | null;
  gtv: number | null;
}

export function useWeekPace(currentWeekStart: string) {
  return useQuery<WeekPaceData | null>({
    queryKey: ['week-pace', currentWeekStart],
    queryFn: async () => {
      const supabase = createClient();

      // Fetch last 4 completed weeks + current week daily data
      const fourWeeksAgo = format(subWeeks(new Date(currentWeekStart + 'T00:00:00'), 4), 'yyyy-MM-dd');
      const weekEnd = format(addDays(new Date(currentWeekStart + 'T00:00:00'), 6), 'yyyy-MM-dd');

      const [metricsResult, forecastResult] = await Promise.all([
        supabase
          .from('daily_metrics')
          .select('metric_date, tickets_sold, orders, gtv')
          .eq('source', 'tm_api')
          .gte('metric_date', fourWeeksAgo)
          .order('metric_date', { ascending: true }),
        supabase
          .from('forecast_metrics')
          .select('metric_date, tickets_sold, orders, gtv')
          .gte('metric_date', currentWeekStart)
          .lte('metric_date', weekEnd)
          .order('metric_date', { ascending: true }),
      ]);

      const { data, error } = metricsResult;
      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Build forecast lookup for current week
      const forecastByDay: { tickets: number; orders: number; gtv: number }[] = Array.from(
        { length: 7 },
        () => ({ tickets: 0, orders: 0, gtv: 0 })
      );
      if (forecastResult.data) {
        for (const row of forecastResult.data as ForecastRow[]) {
          const date = new Date(row.metric_date + 'T00:00:00');
          const dayIdx = differenceInDays(date, new Date(currentWeekStart + 'T00:00:00'));
          if (dayIdx >= 0 && dayIdx < 7) {
            forecastByDay[dayIdx].tickets += row.tickets_sold ?? 0;
            forecastByDay[dayIdx].orders += row.orders ?? 0;
            forecastByDay[dayIdx].gtv += Number(row.gtv ?? 0);
          }
        }
      }

      const rows = data as DailyRow[];

      // Group by week start (Monday)
      const weekBuckets = new Map<string, DailyRow[]>();
      for (const row of rows) {
        const date = new Date(row.metric_date + 'T00:00:00');
        const weekMon = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        if (!weekBuckets.has(weekMon)) weekBuckets.set(weekMon, []);
        weekBuckets.get(weekMon)!.push(row);
      }

      // Separate current week from baseline weeks
      const currentWeekRows = weekBuckets.get(currentWeekStart) ?? [];
      const baselineWeekKeys = [...weekBuckets.keys()].filter((k) => k < currentWeekStart);

      if (baselineWeekKeys.length === 0) return null;

      // Build day-of-week stats from baseline weeks
      type DayStats = { tickets: number[]; orders: number[]; gtv: number[] };
      const dayStats: DayStats[] = Array.from({ length: 7 }, () => ({
        tickets: [],
        orders: [],
        gtv: [],
      }));

      for (const weekKey of baselineWeekKeys) {
        const weekRows = weekBuckets.get(weekKey)!;
        // Aggregate per day within this week (multiple events per day)
        const dayTotals: { tickets: number; orders: number; gtv: number }[] = Array.from(
          { length: 7 },
          () => ({ tickets: 0, orders: 0, gtv: 0 })
        );

        for (const row of weekRows) {
          const date = new Date(row.metric_date + 'T00:00:00');
          const dayIdx = differenceInDays(date, new Date(weekKey + 'T00:00:00'));
          if (dayIdx >= 0 && dayIdx < 7) {
            dayTotals[dayIdx].tickets += row.tickets_sold ?? 0;
            dayTotals[dayIdx].orders += row.orders ?? 0;
            dayTotals[dayIdx].gtv += Number(row.gtv ?? 0);
          }
        }

        for (let d = 0; d < 7; d++) {
          dayStats[d].tickets.push(dayTotals[d].tickets);
          dayStats[d].orders.push(dayTotals[d].orders);
          dayStats[d].gtv.push(dayTotals[d].gtv);
        }
      }

      // Aggregate current week actuals per day
      const currentDayTotals: { tickets: number; orders: number; gtv: number }[] = Array.from(
        { length: 7 },
        () => ({ tickets: 0, orders: 0, gtv: 0 })
      );
      for (const row of currentWeekRows) {
        const date = new Date(row.metric_date + 'T00:00:00');
        const dayIdx = differenceInDays(date, new Date(currentWeekStart + 'T00:00:00'));
        if (dayIdx >= 0 && dayIdx < 7) {
          currentDayTotals[dayIdx].tickets += row.tickets_sold ?? 0;
          currentDayTotals[dayIdx].orders += row.orders ?? 0;
          currentDayTotals[dayIdx].gtv += Number(row.gtv ?? 0);
        }
      }

      // Determine current day index (how far into the week we are)
      const today = new Date();
      const weekStartDate = new Date(currentWeekStart + 'T00:00:00');
      const currentDayIndex = Math.min(differenceInDays(today, weekStartDate), 6);

      // Helper to compute average/min/max
      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const min = (arr: number[]) => arr.length ? Math.min(...arr) : 0;
      const max = (arr: number[]) => arr.length ? Math.max(...arr) : 0;

      // Check if we have forecast data
      const hasForecast = forecastByDay.some(
        (d) => d.tickets > 0 || d.orders > 0 || d.gtv > 0
      );

      // Build pace points for each metric
      function buildPacePoints(metric: 'tickets' | 'orders' | 'gtv'): DayPacePoint[] {
        // Calculate cumulative baseline and actuals
        let cumulativeActual = 0;
        let cumulativeBaseline = 0;
        let cumulativeForecast = 0;

        return DAY_LABELS.map((label, i) => {
          const values = dayStats[i][metric];
          const dayAvg = avg(values);
          cumulativeBaseline += dayAvg;
          cumulativeForecast += forecastByDay[i][metric];

          const hasActual = i <= currentDayIndex && currentDayTotals[i][metric] > 0;
          if (hasActual || (i <= currentDayIndex && i === 0)) {
            cumulativeActual += currentDayTotals[i][metric];
          }

          // Cumulative min/max (approximate - sum of daily mins/maxes)
          const cumulativeMin = dayStats.slice(0, i + 1).reduce((s, d) => s + min(d[metric]), 0);
          const cumulativeMax = dayStats.slice(0, i + 1).reduce((s, d) => s + max(d[metric]), 0);

          // Project remaining days based on pace ratio
          let projected: number | null = null;
          if (i > currentDayIndex && currentDayIndex >= 0) {
            // Use the ratio of actual-to-baseline through current day to project
            const baselineThroughToday = dayStats
              .slice(0, currentDayIndex + 1)
              .reduce((s, d) => s + avg(d[metric]), 0);
            const actualThroughToday = currentDayTotals
              .slice(0, currentDayIndex + 1)
              .reduce((s, d) => s + d[metric], 0);
            const paceRatio = baselineThroughToday > 0 ? actualThroughToday / baselineThroughToday : 1;
            projected = cumulativeBaseline * paceRatio;
          }

          return {
            dayIndex: i,
            dayLabel: label,
            actual: i <= currentDayIndex ? cumulativeActual : null,
            baseline: Math.round(cumulativeBaseline),
            baselineMin: Math.round(cumulativeMin),
            baselineMax: Math.round(cumulativeMax),
            projected,
            forecast: hasForecast ? Math.round(cumulativeForecast) : null,
          };
        });
      }

      return {
        tickets: buildPacePoints('tickets'),
        orders: buildPacePoints('orders'),
        gtv: buildPacePoints('gtv'),
        currentDayIndex,
      };
    },
  });
}
