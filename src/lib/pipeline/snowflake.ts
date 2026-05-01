import { retryWithBackoff, NonRetryableError } from '../utils/retry';
import { createServerClient } from '../supabase/server';

interface SnowflakeQueryParams {
  startDate: string;
  endDate: string;
}

interface SnowflakeApiResponse {
  resultSetMetaData?: {
    rowType: Array<{
      name: string;
      type: string;
      nullable: boolean;
      scale?: number;
      precision?: number;
    }>;
  };
  data?: string[][];
  statementHandle?: string;
  statementStatusUrl?: string;
  message?: string;
  code?: string;
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

function buildAuthHeader(): string {
  const username = process.env.SNOWFLAKE_USER!;
  const password = process.env.SNOWFLAKE_PASSWORD!;
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function buildApiUrl(): string {
  const account = process.env.SNOWFLAKE_ACCOUNT!;
  return `https://${account}.snowflakecomputing.com/api/v2/statements`;
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

async function executeQuery(
  startDate: string,
  endDate: string
): Promise<SnowflakeApiResponse> {
  const authHeader = buildAuthHeader();
  const url = buildApiUrl();

  const sql = `
    SELECT
      metric_date,
      face_value,
      gross_profit,
      tickets_purchased
    FROM FDE.FANAPP.REPORTING.PFI_ECOSYSTEM_DAILY_ACTIVITY
    WHERE metric_date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY metric_date ASC
  `;

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

  // If async execution — poll for results
  if (json.statementHandle && !json.data) {
    return pollStatement(json.statementHandle, authHeader);
  }

  return json;
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
  const response = await retryWithBackoff(() => executeQuery(startDate, endDate));

  const metrics = transformRows(response.data ?? []);
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
export { executeQuery, transformRows, pollStatement };
export type { SnowflakeApiResponse, SnowflakeDailyMetric, SnowflakeQueryParams };
