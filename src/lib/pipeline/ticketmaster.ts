import { createServerClient } from '../supabase/server';
import { retryWithBackoff, NonRetryableError } from '../utils/retry';

const REPORT_NAME = 'ticketmaster_order_listing_fee_discount';

function getAccountSid(): string {
  return process.env.TM_ACCOUNT_SID!;
}

function getBasicAuthHeader(): string {
  const accountSid = getAccountSid();
  const authToken = process.env.TM_AUTH_TOKEN!;
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

function buildReportUrl(startDate: string, endDate: string): string {
  const sid = getAccountSid();
  const url = new URL(
    `https://api.impact.com/Mediapartners/${sid}/ReportExport/${REPORT_NAME}.json`
  );
  url.searchParams.set('START_DATE', startDate);
  url.searchParams.set('END_DATE', endDate);
  url.searchParams.set('CAMPAIGN', 'Ticketmaster');
  // Include all relevant superstatuses
  url.searchParams.append('SUPERSTATUS_MS', 'APPROVED');
  url.searchParams.append('SUPERSTATUS_MS', 'NA');
  url.searchParams.append('SUPERSTATUS_MS', 'PENDING');
  return url.toString();
}

interface JobResponse {
  Status: string;
  QueuedUri?: string;
  ResultUri?: string;
}

interface JobStatusResponse {
  Status: string;
  StatusMessage?: string;
  RecordsProcessed?: string;
  ResultUri?: string;
  FailedDate?: string;
}

async function submitReport(startDate: string, endDate: string): Promise<string> {
  const url = buildReportUrl(startDate, endDate);
  const res = await fetch(url, {
    headers: { Authorization: getBasicAuthHeader() },
  });

  if (res.status === 401) {
    throw new NonRetryableError('Impact auth failed: invalid Account SID or Auth Token');
  }

  if (res.status === 429 || res.status >= 500) {
    throw new Error(`Impact API error: ${res.status}`);
  }

  if (!res.ok) {
    throw new NonRetryableError(`Impact API error: ${res.status} ${await res.text()}`);
  }

  const data: JobResponse = await res.json();

  if (!data.ResultUri) {
    throw new Error('Impact API did not return a ResultUri');
  }

  return data.ResultUri;
}

async function pollForCompletion(resultUri: string): Promise<string> {
  const sid = getAccountSid();
  // The ResultUri is relative, e.g. /Mediapartners/{SID}/Jobs/{id}/Download.json
  // We need the status URI (without /Download) to poll
  const statusUri = resultUri.replace('/Download', '');
  const statusUrl = `https://api.impact.com${statusUri}`;
  const maxPolls = 30;

  for (let attempt = 0; attempt < maxPolls; attempt++) {
    const res = await fetch(statusUrl, {
      headers: { Authorization: getBasicAuthHeader() },
    });

    if (!res.ok) {
      throw new Error(`Impact job poll failed: ${res.status}`);
    }

    const status: JobStatusResponse = await res.json();

    if (status.Status === 'COMPLETED') {
      return `https://api.impact.com${resultUri}`;
    }

    if (status.Status === 'FAILED') {
      throw new Error(`Impact report job failed: ${status.StatusMessage || 'unknown reason'}`);
    }

    // Still QUEUED or RUNNING — wait 2s
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('Impact report job timed out after 60 seconds');
}

async function downloadCsv(downloadUrl: string): Promise<string> {
  const res = await fetch(downloadUrl, {
    headers: { Authorization: getBasicAuthHeader() },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Impact CSV download failed: ${res.status}`);
  }

  return res.text();
}

interface ImpactOrder {
  actionDate: string;
  eventName: string;
  category: string;
  orders: number;
  tickets: number;
  gtv: number;
  face: number;
  commission: number;
}

function parseCsv(csv: string): ImpactOrder[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',');
  const colIndex = (name: string) => headers.indexOf(name);

  const iActionDate = colIndex('Action_Date');
  const iEventName = colIndex('event_name');
  const iCategory = colIndex('sub_category');
  const iOrders = colIndex('Orders');
  const iTickets = colIndex('Tickets');
  const iGtv = colIndex('GTV');
  const iFace = colIndex('Face');
  const iCommission = colIndex('Commission');

  const results: ImpactOrder[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < headers.length) continue;

    results.push({
      actionDate: cols[iActionDate],
      eventName: cols[iEventName] || '',
      category: cols[iCategory] || '',
      orders: parseInt(cols[iOrders], 10) || 0,
      tickets: parseInt(cols[iTickets], 10) || 0,
      gtv: parseFloat(cols[iGtv]) || 0,
      face: parseFloat(cols[iFace]) || 0,
      commission: parseFloat(cols[iCommission]) || 0,
    });
  }

  return results;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
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

function transformOrders(orders: ImpactOrder[]): DailyMetricRow[] {
  const grouped = new Map<string, DailyMetricRow>();

  for (const order of orders) {
    // Action_Date is like "2026-04-30T23:27:59-0400", extract date portion
    const metricDate = order.actionDate.slice(0, 10);
    const key = `${metricDate}|${order.eventName}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.tickets_sold += order.tickets;
      existing.orders += order.orders;
      existing.gtv += order.gtv;
      existing.face_value = (existing.face_value ?? 0) + order.face;
    } else {
      grouped.set(key, {
        metric_date: metricDate,
        event_name: order.eventName,
        sport: order.category,
        tickets_sold: order.tickets,
        orders: order.orders,
        gtv: order.gtv,
        face_value: order.face,
        gross_profit: null,
        source: 'tm_api',
      });
    }
  }

  return Array.from(grouped.values());
}

async function fetchOrders(startDate: string, endDate: string): Promise<ImpactOrder[]> {
  const resultUri = await submitReport(startDate, endDate);
  const downloadUrl = await pollForCompletion(resultUri);
  const csv = await downloadCsv(downloadUrl);
  return parseCsv(csv);
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
export { fetchOrders, transformOrders, parseCsv, parseCsvLine, submitReport, pollForCompletion, downloadCsv };
export type { ImpactOrder, DailyMetricRow };
