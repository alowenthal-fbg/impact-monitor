import { createServerClient } from '../supabase/server';
import { retryWithBackoff } from '../utils/retry';

const TOKEN_ENDPOINT = 'https://auth.ticketmaster.com/oauth/token';
const SALES_ENDPOINT = 'https://app.ticketmaster.com/impact/v2/orders';

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (cachedToken && !forceRefresh && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken.accessToken;
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.TM_API_KEY!,
      client_secret: process.env.TM_API_SECRET!,
    }),
  });

  if (!res.ok) {
    throw new Error(`TM auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

interface TmOrder {
  order_date: string;
  event_name: string;
  sport: string;
  ticket_quantity: number;
  total_amount: number;
  face_value: number;
}

interface TmApiResponse {
  orders: TmOrder[];
  page: number;
  total_pages: number;
}

async function fetchOrders(startDate: string, endDate: string): Promise<TmOrder[]> {
  const allOrders: TmOrder[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const token = await getAccessToken();
    const url = new URL(SALES_ENDPOINT);
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    url.searchParams.set('page', String(page));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      // Token expired — refresh and retry this page
      await getAccessToken(true);
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      throw new Error(`TM API error: ${res.status}`);
    }

    if (!res.ok) {
      throw new Error(`TM API permanent error: ${res.status} ${await res.text()}`);
    }

    const data: TmApiResponse = await res.json();
    allOrders.push(...data.orders);
    totalPages = data.total_pages;
    page++;
  }

  return allOrders;
}

interface DailyMetricRow {
  metric_date: string;
  event_name: string;
  sport: string;
  tickets_sold: number;
  orders: number;
  gtv: number;
  face_value: number | null;
  gross_profit: null;
  source: 'tm_api';
}

function transformOrders(orders: TmOrder[]): DailyMetricRow[] {
  const grouped = new Map<string, DailyMetricRow>();

  for (const order of orders) {
    const key = `${order.order_date}|${order.event_name}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.tickets_sold += order.ticket_quantity;
      existing.orders += 1;
      existing.gtv += order.total_amount;
      if (order.face_value != null) {
        existing.face_value = (existing.face_value ?? 0) + order.face_value;
      }
    } else {
      grouped.set(key, {
        metric_date: order.order_date,
        event_name: order.event_name,
        sport: order.sport,
        tickets_sold: order.ticket_quantity,
        orders: 1,
        gtv: order.total_amount,
        face_value: order.face_value != null ? order.face_value : null,
        gross_profit: null,
        source: 'tm_api',
      });
    }
  }

  return Array.from(grouped.values());
}

export async function pullTicketmasterData(startDate: string, endDate: string): Promise<void> {
  const orders = await retryWithBackoff(() => fetchOrders(startDate, endDate));
  if (orders.length === 0) return;

  const rows = transformOrders(orders);
  const supabase = createServerClient();

  const { error } = await supabase
    .from('daily_metrics')
    .upsert(rows, { onConflict: 'metric_date,event_name,source' });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
}

// Exported for testing
export { getAccessToken, fetchOrders, transformOrders };
export type { TmOrder, DailyMetricRow };
