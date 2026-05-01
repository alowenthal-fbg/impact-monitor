'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface SportData {
  sport: string;
  tickets: number;
  gtv: number;
  ticketPercentage: number;
}

export function useDailyData(weekStart: string, weekEnd: string) {
  return useQuery<SportData[]>({
    queryKey: ['daily-metrics', 'sport-breakdown', weekStart, weekEnd],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('daily_metrics')
        .select('sport, tickets_sold, gtv')
        .eq('source', 'reconciled')
        .gte('metric_date', weekStart)
        .lte('metric_date', weekEnd)
        .not('sport', 'is', null);

      if (error) throw error;

      const sportMap: Record<string, { sport: string; tickets: number; gtv: number }> = {};
      for (const row of data ?? []) {
        const sport = row.sport || 'Unknown';
        if (!sportMap[sport]) {
          sportMap[sport] = { sport, tickets: 0, gtv: 0 };
        }
        sportMap[sport].tickets += row.tickets_sold || 0;
        sportMap[sport].gtv += row.gtv || 0;
      }

      const sportData = Object.values(sportMap);
      const totalTickets = sportData.reduce((sum, s) => sum + s.tickets, 0);

      return sportData
        .map((s) => ({
          ...s,
          ticketPercentage: totalTickets > 0 ? (s.tickets / totalTickets) * 100 : 0,
        }))
        .sort((a, b) => b.tickets - a.tickets);
    },
  });
}
