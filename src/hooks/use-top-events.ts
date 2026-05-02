'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface TopEvent {
  sport: string;
  event_name: string;
  gtv: number;
}

export function useTopEvents(weekStart: string, weekEnd: string) {
  return useQuery<TopEvent[]>({
    queryKey: ['top-events', weekStart, weekEnd],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('daily_metrics')
        .select('sport, event_name, gtv')
        .eq('source', 'tm_api')
        .gte('metric_date', weekStart)
        .lte('metric_date', weekEnd)
        .not('event_name', 'is', null);

      if (error) throw error;

      const eventMap: Record<string, TopEvent> = {};
      for (const row of data ?? []) {
        const key = `${row.sport}::${row.event_name}`;
        if (!eventMap[key]) {
          eventMap[key] = {
            sport: row.sport || 'Unknown',
            event_name: row.event_name,
            gtv: 0,
          };
        }
        eventMap[key].gtv += row.gtv || 0;
      }

      return Object.values(eventMap)
        .sort((a, b) => b.gtv - a.gtv)
        .slice(0, 5);
    },
  });
}
