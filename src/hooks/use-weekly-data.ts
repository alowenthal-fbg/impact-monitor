'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { WeeklySummary } from '@/lib/supabase/types';

export interface WeeklyKPIs {
  totalTickets: number;
  totalOrders: number;
  totalGtv: number;
  avgOrderValue: number;
  ticketsWow: number | null;
  ordersWow: number | null;
  gtvWow: number | null;
  avgOrderValueWow: number | null;
  isCurrentWeek: boolean;
}

function calcWow(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function useWeeklyData(weekStart: string, currentWeekStart: string) {
  return useQuery<WeeklyKPIs>({
    queryKey: ['weekly-summary', weekStart],
    queryFn: async () => {
      const supabase = createClient();

      // Fetch selected week
      const { data: current, error: currentError } = await supabase
        .from('weekly_summary')
        .select('*')
        .eq('week_start', weekStart)
        .single();

      if (currentError) throw currentError;

      // Fetch previous week for WoW comparison
      const prevWeekDate = new Date(weekStart + 'T00:00:00');
      prevWeekDate.setDate(prevWeekDate.getDate() - 7);
      const prevWeekStr = prevWeekDate.toISOString().split('T')[0];

      const { data: previous } = await supabase
        .from('weekly_summary')
        .select('*')
        .eq('week_start', prevWeekStr)
        .single();

      const cur = current as WeeklySummary;
      const prev = previous as WeeklySummary | null;

      const totalOrders = cur.total_orders ?? 0;
      const totalGtv = cur.total_gtv ?? 0;
      const avgOrderValue = totalOrders > 0 ? totalGtv / totalOrders : 0;

      const prevOrders = prev?.total_orders ?? 0;
      const prevGtv = prev?.total_gtv ?? 0;
      const prevAvg = prevOrders > 0 ? prevGtv / prevOrders : 0;

      return {
        totalTickets: cur.total_tickets ?? 0,
        totalOrders,
        totalGtv,
        avgOrderValue,
        ticketsWow: calcWow(cur.total_tickets, prev?.total_tickets ?? null),
        ordersWow: calcWow(cur.total_orders, prev?.total_orders ?? null),
        gtvWow: calcWow(cur.total_gtv, prev?.total_gtv ?? null),
        avgOrderValueWow: calcWow(avgOrderValue, prevAvg || null),
        isCurrentWeek: weekStart === currentWeekStart,
      };
    },
  });
}

export function useAvailableWeeks() {
  return useQuery<string[]>({
    queryKey: ['available-weeks'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('weekly_summary')
        .select('week_start')
        .order('week_start', { ascending: false });

      if (error) throw error;
      return (data as WeeklySummary[]).map((r) => r.week_start);
    },
  });
}
