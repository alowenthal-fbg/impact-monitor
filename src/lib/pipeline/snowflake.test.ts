import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transformRows, type SnowflakeApiResponse } from './snowflake';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockUpsert = vi.fn();
vi.mock('../supabase/server', () => ({
  createServerClient: () => ({
    from: () => ({ upsert: mockUpsert }),
  }),
}));

vi.stubEnv('SNOWFLAKE_ACCOUNT', 'VYB11067.us-east-1');
vi.stubEnv('SNOWFLAKE_USER', 'testuser');
vi.stubEnv('SNOWFLAKE_PASSWORD', 'testpass');
vi.stubEnv('SNOWFLAKE_DATABASE', 'FDE');
vi.stubEnv('SNOWFLAKE_WAREHOUSE', 'FDE_LOYALTY_ANALYST_LG_WH');

const sampleResponse: SnowflakeApiResponse = {
  resultSetMetaData: {
    rowType: [
      { name: 'METRIC_DATE', type: 'date', nullable: false },
      { name: 'FACE_VALUE', type: 'fixed', nullable: true },
      { name: 'GROSS_PROFIT', type: 'fixed', nullable: true },
      { name: 'TICKETS_PURCHASED', type: 'fixed', nullable: true },
    ],
  },
  data: [
    ['2026-04-20', '1250.00', '450.00', '10'],
    ['2026-04-21', '2300.50', '820.25', '18'],
  ],
  statementHandle: 'stmt-123',
};

function mockSuccessResponse(data: SnowflakeApiResponse = sampleResponse) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

describe('transformRows', () => {
  it('maps Snowflake rows to daily metric format', () => {
    const rows = transformRows(sampleResponse.data!);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      metric_date: '2026-04-20',
      face_value: 1250.0,
      gross_profit: 450.0,
      tickets_sold: 10,
      orders: null,
      gtv: null,
      sport: null,
      event_name: null,
      source: 'snowflake',
    });
    expect(rows[1]).toMatchObject({
      metric_date: '2026-04-21',
      face_value: 2300.5,
      gross_profit: 820.25,
      tickets_sold: 18,
    });
  });

  it('returns empty array for empty data', () => {
    expect(transformRows([])).toEqual([]);
  });

  it('handles null values in rows', () => {
    const rows = transformRows([['2026-04-20', null as unknown as string, null as unknown as string, null as unknown as string]]);
    expect(rows[0]).toMatchObject({
      face_value: null,
      gross_profit: null,
      tickets_sold: null,
    });
  });
});

describe('fetchSnowflakeData', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({ error: null });
    vi.resetModules();
  });

  it('fetches data and upserts to supabase', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse());

    const { fetchSnowflakeData } = await import('./snowflake');
    await fetchSnowflakeData({ startDate: '2026-04-20', endDate: '2026-04-26' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('snowflakecomputing.com/api/v2/statements');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body).warehouse).toBe('FDE_LOYALTY_ANALYST_LG_WH');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [rows, upsertOpts] = mockUpsert.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe('snowflake');
    expect(upsertOpts).toEqual({ onConflict: 'metric_date,event_name,source' });
  });

  it('skips upsert when no data returned', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSuccessResponse({ ...sampleResponse, data: [] })
    );

    const { fetchSnowflakeData } = await import('./snowflake');
    await fetchSnowflakeData({ startDate: '2026-04-20', endDate: '2026-04-26' });

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('throws on auth failure without retrying', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ code: '390144', message: 'Incorrect username or password' }),
    });

    const { fetchSnowflakeData } = await import('./snowflake');
    await expect(
      fetchSnowflakeData({ startDate: '2026-04-20', endDate: '2026-04-26' })
    ).rejects.toThrow('Snowflake auth failed');

    // Auth errors should not be retried — only 1 fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 rate limit', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ code: '429', message: 'Too Many Requests' }),
      })
      .mockResolvedValueOnce(mockSuccessResponse());

    const { fetchSnowflakeData } = await import('./snowflake');
    await fetchSnowflakeData({ startDate: '2026-04-20', endDate: '2026-04-26' });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 server error', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal Server Error' }),
      })
      .mockResolvedValueOnce(mockSuccessResponse());

    const { fetchSnowflakeData } = await import('./snowflake');
    await fetchSnowflakeData({ startDate: '2026-04-20', endDate: '2026-04-26' });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('throws on max retries exhausted', { timeout: 15000 }, async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server error' }),
    });

    const { fetchSnowflakeData } = await import('./snowflake');
    await expect(
      fetchSnowflakeData({ startDate: '2026-04-20', endDate: '2026-04-26' })
    ).rejects.toThrow('Snowflake API error (500)');
  });

  it('throws on permanent query error (bad SQL)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () =>
        Promise.resolve({
          code: '002003',
          message: "Object 'PFI_ECOSYSTEM_DAILY_ACTIVITY' does not exist.",
        }),
    });

    const { fetchSnowflakeData } = await import('./snowflake');
    await expect(
      fetchSnowflakeData({ startDate: '2026-04-20', endDate: '2026-04-26' })
    ).rejects.toThrow('Snowflake query failed (002003)');
  });

  it('polls for async query results', async () => {
    // Initial POST returns handle without data
    mockFetch.mockResolvedValueOnce(
      mockSuccessResponse({
        statementHandle: 'stmt-async',
        statementStatusUrl: '/api/v2/statements/stmt-async',
        message: 'Statement executed successfully.',
        code: '090001',
      })
    );
    // Poll returns data
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(sampleResponse));

    const { fetchSnowflakeData } = await import('./snowflake');
    await fetchSnowflakeData({ startDate: '2026-04-20', endDate: '2026-04-26' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('throws on supabase upsert error', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse());
    mockUpsert.mockResolvedValueOnce({ error: { message: 'duplicate key' } });

    const { fetchSnowflakeData } = await import('./snowflake');
    await expect(
      fetchSnowflakeData({ startDate: '2026-04-20', endDate: '2026-04-26' })
    ).rejects.toThrow('Failed to store Snowflake data in Supabase');
  });
});
