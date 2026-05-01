'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface TrendDataPoint {
  week_start: string;
  total_tickets: number;
  total_gtv: number;
}

export function useTrendData() {
  return useQuery<TrendDataPoint[]>({
    queryKey: ['weekly-summary', 'trend'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('weekly_summary')
        .select('week_start, total_tickets, total_gtv')
        .order('week_start', { ascending: true })
        .limit(12);

      if (error) throw error;
      return (data ?? []).map((row) => ({
        week_start: row.week_start.split('T')[0],
        total_tickets: row.total_tickets ?? 0,
        total_gtv: row.total_gtv ?? 0,
      }));
    },
  });
}
