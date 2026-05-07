'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface TicketingDailyPoint {
  metric_date: string;
  tab_uniques_tickets: number;
}

export interface TabShareRow {
  tab: string;
  uniques: number;
}

interface TicketingEngagement {
  dailyTickets: TicketingDailyPoint[];
  tabShareL30: TabShareRow[];
}

const TAB_LABELS: Record<string, string> = {
  for_you: 'For You',
  shop: 'Shop',
  games: 'Games',
  scores: 'Scores',
  tickets: 'Tickets',
};

export function useTicketingEngagement() {
  return useQuery<TicketingEngagement>({
    queryKey: ['amplitude-ticketing-daily'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('amplitude_ticketing_daily')
        .select(
          'metric_date, tab_uniques_for_you, tab_uniques_shop, tab_uniques_games, tab_uniques_scores, tab_uniques_tickets'
        )
        .order('metric_date', { ascending: true });

      if (error) throw error;
      const rows = data ?? [];

      const dailyTickets: TicketingDailyPoint[] = rows.map((r) => ({
        metric_date: r.metric_date.split('T')[0],
        tab_uniques_tickets: r.tab_uniques_tickets ?? 0,
      }));

      // L30 share: sum unique-day counts across the 30 most recent days.
      // Note: Amplitude reports *daily* uniques, so summing days over-counts
      // users who come back on multiple days. That's consistent with how
      // Dylan's dashboard presents these numbers, and it's the right shape
      // for a comparative bar chart — just read it as "unique-day visits".
      const last30 = rows.slice(-30);
      const keys = ['for_you', 'shop', 'games', 'scores', 'tickets'] as const;
      const tabShareL30: TabShareRow[] = keys.map((k) => {
        const total = last30.reduce(
          (sum, r) => sum + ((r as Record<string, number | null>)[`tab_uniques_${k}`] ?? 0),
          0
        );
        return { tab: TAB_LABELS[k], uniques: total };
      });
      tabShareL30.sort((a, b) => b.uniques - a.uniques);

      return { dailyTickets, tabShareL30 };
    },
  });
}
