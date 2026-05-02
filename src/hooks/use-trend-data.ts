'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface TrendDataPoint {
  week_start: string;
  total_tickets: number;
  total_gtv: number;
  total_orders: number;
}

export interface MonthlyTrendDataPoint {
  month: string;
  total_tickets: number;
  total_gtv: number;
  total_orders: number;
}

export function useTrendData() {
  return useQuery<TrendDataPoint[]>({
    queryKey: ['weekly-summary', 'trend'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('weekly_summary')
        .select('week_start, total_tickets, total_gtv, total_orders')
        .order('week_start', { ascending: true });

      if (error) throw error;
      return (data ?? []).map((row) => ({
        week_start: row.week_start.split('T')[0],
        total_tickets: row.total_tickets ?? 0,
        total_gtv: row.total_gtv ?? 0,
        total_orders: row.total_orders ?? 0,
      }));
    },
  });
}

export function aggregateMonthly(weeklyData: TrendDataPoint[]): MonthlyTrendDataPoint[] {
  const monthMap = new Map<string, MonthlyTrendDataPoint>();

  for (const week of weeklyData) {
    // Use yyyy-MM as the month key from the week_start date
    const month = week.week_start.slice(0, 7);
    const existing = monthMap.get(month);
    if (existing) {
      existing.total_tickets += week.total_tickets;
      existing.total_gtv += week.total_gtv;
      existing.total_orders += week.total_orders;
    } else {
      monthMap.set(month, {
        month,
        total_tickets: week.total_tickets,
        total_gtv: week.total_gtv,
        total_orders: week.total_orders,
      });
    }
  }

  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}
