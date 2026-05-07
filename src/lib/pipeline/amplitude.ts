import { createServerClient } from '../supabase/server';
import { retryWithBackoff } from '../utils/retry';

const TABS = ['FOR_YOU', 'SHOP', 'GAMES', 'SCORES', 'TICKETS'] as const;
type Tab = (typeof TABS)[number];

interface SegmentationResponse {
  data: {
    series: number[][];
    seriesLabels: [number, string][];
    xValues: string[];
  };
}

function getBasicAuthHeader(): string {
  const key = process.env.AMPLITUDE_API_KEY!;
  const secret = process.env.AMPLITUDE_SECRET_KEY!;
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

function formatAmplitudeDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

async function fetchTabBreakdown(
  startDate: string,
  endDate: string
): Promise<SegmentationResponse> {
  const url = new URL('https://amplitude.com/api/2/events/segmentation');
  url.searchParams.set(
    'e',
    JSON.stringify({
      event_type: 'home_tab_navigation_click',
      group_by: [{ type: 'event', value: 'tab_selected' }],
    })
  );
  url.searchParams.set('start', startDate);
  url.searchParams.set('end', endDate);
  url.searchParams.set('m', 'uniques');
  url.searchParams.set('i', '1');

  const res = await fetch(url.toString(), {
    headers: { Authorization: getBasicAuthHeader() },
  });
  if (!res.ok) {
    throw new Error(`Amplitude API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

interface TicketingDailyRow {
  metric_date: string;
  tab_uniques_for_you: number | null;
  tab_uniques_shop: number | null;
  tab_uniques_games: number | null;
  tab_uniques_scores: number | null;
  tab_uniques_tickets: number | null;
  pulled_at: string;
}

function transformResponse(resp: SegmentationResponse): TicketingDailyRow[] {
  const { series, seriesLabels, xValues } = resp.data;
  const labelToValuesByDate: Record<string, Record<Tab, number | null>> = {};
  const pulledAt = new Date().toISOString();

  for (let i = 0; i < xValues.length; i++) {
    const date = xValues[i];
    labelToValuesByDate[date] = {
      FOR_YOU: null,
      SHOP: null,
      GAMES: null,
      SCORES: null,
      TICKETS: null,
    };
  }

  for (let s = 0; s < seriesLabels.length; s++) {
    const label = seriesLabels[s][1] as Tab;
    if (!TABS.includes(label)) continue;
    const row = series[s];
    for (let i = 0; i < xValues.length; i++) {
      labelToValuesByDate[xValues[i]][label] = row[i];
    }
  }

  return xValues.map((date) => {
    const v = labelToValuesByDate[date];
    return {
      metric_date: date,
      tab_uniques_for_you: v.FOR_YOU,
      tab_uniques_shop: v.SHOP,
      tab_uniques_games: v.GAMES,
      tab_uniques_scores: v.SCORES,
      tab_uniques_tickets: v.TICKETS,
      pulled_at: pulledAt,
    };
  });
}

export async function pullAmplitudeData(lookbackDays = 30): Promise<void> {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - lookbackDays);

  const resp = await retryWithBackoff(() =>
    fetchTabBreakdown(formatAmplitudeDate(start), formatAmplitudeDate(end))
  );

  const rows = transformResponse(resp);
  if (rows.length === 0) return;

  const supabase = createServerClient();
  const { error } = await supabase
    .from('amplitude_ticketing_daily')
    .upsert(rows, { onConflict: 'metric_date' });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

export { transformResponse, formatAmplitudeDate };
export type { TicketingDailyRow, SegmentationResponse };
