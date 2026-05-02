'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { format, startOfYear, addDays, endOfYear } from 'date-fns';
import { getWeekStart } from '@/lib/utils/week';

export interface SportWeeklyData {
  week_start: string; // yyyy-MM-dd
  [sport: string]: number | string;
}

export interface SportSeasonalityResult {
  data: SportWeeklyData[];
  sports: string[];
}

export function useSportSeasonality() {
  return useQuery<SportSeasonalityResult>({
    queryKey: ['sport-seasonality'],
    queryFn: async () => {
      // Build the full year of weeks (Monday-based)
      const jan1 = startOfYear(new Date());
      const dec31 = endOfYear(new Date());
      const firstMonday = getWeekStart(jan1);
      const lastMonday = getWeekStart(dec31);
      const yearStart = format(firstMonday, 'yyyy-MM-dd');

      // Generate all Monday dates for the full calendar year
      const allWeeks: string[] = [];
      let cursor = firstMonday;
      while (cursor <= lastMonday) {
        allWeeks.push(format(cursor, 'yyyy-MM-dd'));
        cursor = addDays(cursor, 7);
      }

      // Paginate to fetch all rows (Supabase caps at 1000 per request)
      const supabase = createClient();
      const pageSize = 1000;
      let allRows: { metric_date: string; sport: string | null; tickets_sold: number | null }[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: page, error } = await supabase
          .from('daily_metrics')
          .select('metric_date, sport, tickets_sold')
          .eq('source', 'tm_api')
          .gte('metric_date', yearStart)
          .not('sport', 'is', null)
          .order('metric_date', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        allRows = allRows.concat(page ?? []);
        hasMore = (page?.length ?? 0) === pageSize;
        from += pageSize;
      }

      // Aggregate tickets by sport + week (Monday-based)
      const weekSportMap: Record<string, Record<string, number>> = {};
      const sportSet = new Set<string>();

      for (const row of allRows) {
        const sport = row.sport || 'Unknown';
        const date = new Date(row.metric_date + 'T00:00:00');
        const day = date.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const monday = new Date(date);
        monday.setDate(date.getDate() + mondayOffset);
        const weekStart = format(monday, 'yyyy-MM-dd');

        sportSet.add(sport);
        if (!weekSportMap[weekStart]) weekSportMap[weekStart] = {};
        weekSportMap[weekStart][sport] = (weekSportMap[weekStart][sport] || 0) + (row.tickets_sold || 0);
      }

      const sports = Array.from(sportSet).sort();

      // Fill all weeks, using 0 for weeks with no data
      const chartData: SportWeeklyData[] = allWeeks.map((week) => {
        const entry: SportWeeklyData = { week_start: week };
        for (const sport of sports) {
          entry[sport] = weekSportMap[week]?.[sport] || 0;
        }
        return entry;
      });

      return { data: chartData, sports };
    },
  });
}
