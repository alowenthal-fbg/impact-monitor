import { retryWithBackoff, NonRetryableError } from '../utils/retry';
import { createServerClient } from '../supabase/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface SnowflakeQueryParams {
  startDate: string;
  endDate: string;
}

interface SnowflakeDailyMetric {
  metric_date: string;
  face_value: number | null;
  gross_profit: number | null;
  tickets_sold: number | null;
  orders: null;
  gtv: null;
  sport: null;
  event_name: null;
  source: 'snowflake';
}

const QUERY_TEMPLATE = `
SELECT
  AMPLITUDE_EVENT_DATE as metric_date,
  SUM(TICKETS_FACE_VALUE) as face_value,
  SUM(TICKETS_GROSS_PROFIT) as gross_profit,
  SUM(TICKETS_PURCHASED) as tickets_purchased
FROM FANAPP.REPORTING.FANAPP_METRICS_DAILY_ALL_V2
WHERE AMPLITUDE_EVENT_DATE BETWEEN ':startDate' AND ':endDate'
GROUP BY AMPLITUDE_EVENT_DATE
ORDER BY AMPLITUDE_EVENT_DATE ASC
`;

function buildSql(startDate: string, endDate: string): string {
  // Validate date format to prevent injection
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new NonRetryableError('Invalid date format: expected YYYY-MM-DD');
  }
  return QUERY_TEMPLATE.replace(':startDate', startDate).replace(':endDate', endDate);
}

// --- SQL API path (for production with service account credentials) ---

interface SnowflakeApiResponse {
  resultSetMetaData?: {
    rowType: Array<{
      name: string;
      type: string;
      nullable: boolean;
    }>;
  };
  data?: string[][];
  statementHandle?: string;
  statementStatusUrl?: string;
  message?: string;
  code?: string;
}

async function pollStatement(
  statementHandle: string,
  authHeader: string
): Promise<SnowflakeApiResponse> {
  const account = process.env.SNOWFLAKE_ACCOUNT!;
  const url = `https://${account}.snowflakecomputing.com/api/v2/statements/${statementHandle}`;
  const maxPolls = 10;

  for (let attempt = 0; attempt < maxPolls; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: authHeader },
    });
    const json: SnowflakeApiResponse = await res.json();

    if (json.data) {
      return json;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('Snowflake query timeout: statement did not complete within 20 seconds');
}

async function executeQueryViaApi(
  startDate: string,
  endDate: string
): Promise<string[][]> {
  const username = process.env.SNOWFLAKE_USER!;
  const password = process.env.SNOWFLAKE_PASSWORD!;
  const account = process.env.SNOWFLAKE_ACCOUNT!;
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const url = `https://${account}.snowflakecomputing.com/api/v2/statements`;

  const sql = buildSql(startDate, endDate);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      statement: sql,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
      database: process.env.SNOWFLAKE_DATABASE!,
      role: 'LOYALTY_ANALYST',
      timeout: 60,
    }),
  });

  const json: SnowflakeApiResponse = await res.json();

  if (res.status === 401) {
    throw new NonRetryableError(`Snowflake auth failed: ${json.message || 'Invalid credentials'}`);
  }

  if (res.status === 429 || res.status >= 500) {
    throw new Error(`Snowflake API error (${res.status}): ${json.message || 'Server error'}`);
  }

  if (!res.ok) {
    throw new NonRetryableError(`Snowflake query failed (${json.code}): ${json.message}`);
  }

  if (json.statementHandle && !json.data) {
    const polled = await pollStatement(json.statementHandle, authHeader);
    return polled.data ?? [];
  }

  return json.data ?? [];
}

// --- CLI path (for local dev with SSO auth) ---

function parseCsvOutput(csv: string): string[][] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  // Skip header row, parse data rows
  return lines.slice(1).map((line) => line.split(','));
}

async function executeQueryViaCli(
  startDate: string,
  endDate: string
): Promise<string[][]> {
  const sql = buildSql(startDate, endDate);

  try {
    const { stdout } = await execFileAsync('snow', [
      'sql', '-q', sql, '--format', 'CSV',
    ], { timeout: 60_000 });

    return parseCsvOutput(stdout);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Authentication') || message.includes('auth')) {
      throw new NonRetryableError(`Snowflake CLI auth failed: ${message}`);
    }
    throw new Error(`Snowflake CLI error: ${message}`);
  }
}

// --- Shared logic ---

function useCliMode(): boolean {
  // Use CLI when SQL API credentials are not configured
  return !process.env.SNOWFLAKE_USER || !process.env.SNOWFLAKE_PASSWORD;
}

async function executeQuery(startDate: string, endDate: string): Promise<string[][]> {
  if (useCliMode()) {
    return executeQueryViaCli(startDate, endDate);
  }
  return executeQueryViaApi(startDate, endDate);
}

function transformRows(data: string[][]): SnowflakeDailyMetric[] {
  return data.map((row) => ({
    metric_date: row[0],
    face_value: row[1] != null ? parseFloat(row[1]) : null,
    gross_profit: row[2] != null ? parseFloat(row[2]) : null,
    tickets_sold: row[3] != null ? parseInt(row[3], 10) : null,
    orders: null,
    gtv: null,
    sport: null,
    event_name: null,
    source: 'snowflake' as const,
  }));
}

export async function fetchSnowflakeData({
  startDate,
  endDate,
}: SnowflakeQueryParams): Promise<void> {
  const data = await retryWithBackoff(() => executeQuery(startDate, endDate));

  const metrics = transformRows(data);
  if (metrics.length === 0) return;

  const supabase = createServerClient();
  const { error } = await supabase
    .from('daily_metrics')
    .upsert(metrics, { onConflict: 'metric_date,event_name,source' });

  if (error) {
    throw new Error(`Failed to store Snowflake data in Supabase: ${error.message}`);
  }
}

// Exported for testing
export { executeQuery, executeQueryViaApi, executeQueryViaCli, transformRows, parseCsvOutput, pollStatement, buildSql, useCliMode };
export type { SnowflakeApiResponse, SnowflakeDailyMetric, SnowflakeQueryParams };
