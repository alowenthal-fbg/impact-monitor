'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { WeeklyKPIs } from './use-weekly-data';

function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function useYtdData(enabled: boolean) {
  const currentYear = new Date().getFullYear();
  const ytdStart = `${currentYear}-01-01`;
  const today = new Date().toISOString().split('T')[0];

  // Prior year same range
  const priorYtdStart = `${currentYear - 1}-01-01`;
  const priorToday = new Date(new Date().setFullYear(currentYear - 1)).toISOString().split('T')[0];

  return useQuery<WeeklyKPIs>({
    queryKey: ['ytd-summary', currentYear],
    enabled,
    queryFn: async () => {
      const supabase = createClient();

      // Current YTD: all weekly_summary rows with week_start in this year up to today
      const { data: currentRows, error: currentError } = await supabase
        .from('weekly_summary')
        .select('total_tickets, total_orders, total_gtv, total_gross_profit')
        .gte('week_start', ytdStart)
        .lte('week_start', today);

      if (currentError) throw currentError;

      // Prior year YTD
      const { data: priorRows, error: priorError } = await supabase
        .from('weekly_summary')
        .select('total_tickets, total_orders, total_gtv, total_gross_profit')
        .gte('week_start', priorYtdStart)
        .lte('week_start', priorToday);

      if (priorError) throw priorError;

      const sum = (rows: typeof currentRows, field: 'total_tickets' | 'total_orders' | 'total_gtv' | 'total_gross_profit') =>
        (rows ?? []).reduce((acc, r) => acc + (r[field] ?? 0), 0);

      const totalTickets = sum(currentRows, 'total_tickets');
      const totalOrders = sum(currentRows, 'total_orders');
      const totalGtv = sum(currentRows, 'total_gtv');
      const totalGrossProfit = sum(currentRows, 'total_gross_profit');
      const avgOrderValue = totalOrders > 0 ? totalGtv / totalOrders : 0;

      const prevTickets = sum(priorRows, 'total_tickets');
      const prevOrders = sum(priorRows, 'total_orders');
      const prevGtv = sum(priorRows, 'total_gtv');
      const prevAvg = prevOrders > 0 ? prevGtv / prevOrders : 0;

      return {
        totalTickets,
        totalOrders,
        totalGtv,
        avgOrderValue,
        totalGrossProfit,
        ticketsWow: calcDelta(totalTickets, prevTickets),
        ordersWow: calcDelta(totalOrders, prevOrders),
        gtvWow: calcDelta(totalGtv, prevGtv),
        avgOrderValueWow: calcDelta(avgOrderValue, prevAvg),
        grossProfitWow: calcDelta(totalGrossProfit, sum(priorRows, 'total_gross_profit')),
        prevTickets: prevTickets || null,
        prevOrders: prevOrders || null,
        prevGtv: prevGtv || null,
        prevAvgOrderValue: prevAvg || null,
        isCurrentWeek: false,
      };
    },
  });
}
