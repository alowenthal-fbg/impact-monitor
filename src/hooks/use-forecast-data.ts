'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { format, startOfWeek } from 'date-fns';

export interface ForecastWeekPoint {
  week_start: string;
  total_tickets: number;
  total_orders: number;
  total_gtv: number;
}

export interface ForecastMonthPoint {
  month: string;
  total_tickets: number;
  total_orders: number;
  total_gtv: number;
}

export function useForecastData() {
  return useQuery<ForecastWeekPoint[]>({
    queryKey: ['forecast', 'weekly'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('forecast_metrics')
        .select('metric_date, tickets_sold, orders, gtv')
        .order('metric_date', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Aggregate by week (Monday start)
      const weekMap = new Map<string, ForecastWeekPoint>();
      for (const row of data) {
        const date = new Date(row.metric_date + 'T00:00:00');
        const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');

        const existing = weekMap.get(weekStart);
        if (existing) {
          existing.total_tickets += row.tickets_sold ?? 0;
          existing.total_orders += row.orders ?? 0;
          existing.total_gtv += Number(row.gtv ?? 0);
        } else {
          weekMap.set(weekStart, {
            week_start: weekStart,
            total_tickets: row.tickets_sold ?? 0,
            total_orders: row.orders ?? 0,
            total_gtv: Number(row.gtv ?? 0),
          });
        }
      }

      return Array.from(weekMap.values()).sort((a, b) => a.week_start.localeCompare(b.week_start));
    },
  });
}

export function aggregateForecastMonthly(weeklyData: ForecastWeekPoint[]): ForecastMonthPoint[] {
  const monthMap = new Map<string, ForecastMonthPoint>();

  for (const week of weeklyData) {
    const month = week.week_start.slice(0, 7);
    const existing = monthMap.get(month);
    if (existing) {
      existing.total_tickets += week.total_tickets;
      existing.total_orders += week.total_orders;
      existing.total_gtv += week.total_gtv;
    } else {
      monthMap.set(month, {
        month,
        total_tickets: week.total_tickets,
        total_orders: week.total_orders,
        total_gtv: week.total_gtv,
      });
    }
  }

  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}
