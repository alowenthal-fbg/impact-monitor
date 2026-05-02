import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileDailyMetrics } from './reconcile';

// Mock Supabase client
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    from: mockFrom,
  }),
}));

function setupChain(data: unknown[] | null, error: { message: string } | null = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({ data, error }),
  };
  return chain;
}

describe('reconcileDailyMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges TM and Snowflake data, keeping TM fields and allocating gross_profit', async () => {
    const tmChain = setupChain([
      { metric_date: '2026-04-28', orders: 5, gtv: 500, sport: 'NBA', event_name: 'Lakers vs Celtics', face_value: 400, tickets_sold: 10, source: 'tm_api' },
    ]);
    const sfChain = setupChain([
      { metric_date: '2026-04-28', face_value: 400, gross_profit: 100, tickets_sold: 10, source: 'snowflake' },
    ]);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return tmChain;
      if (callCount === 2) return sfChain;
      return { upsert: mockUpsert.mockResolvedValue({ error: null }) };
    });

    const result = await reconcileDailyMetrics('2026-04-28', '2026-04-28');

    expect(result.reconciledCount).toBe(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({
        metric_date: '2026-04-28',
        orders: 5,
        gtv: 500,
        sport: 'NBA',
        event_name: 'Lakers vs Celtics',
        face_value: 400,
        tickets_sold: 10,
        gross_profit: 100,
        source: 'reconciled',
      })],
      { onConflict: 'metric_date,event_name,source' }
    );
  });

  it('handles TM-only data (Snowflake missing) — gross_profit null', async () => {
    const tmChain = setupChain([
      { metric_date: '2026-04-29', orders: 3, gtv: 300, sport: 'MLB', event_name: 'Yankees vs Mets', face_value: 250, tickets_sold: 6, source: 'tm_api' },
    ]);
    const sfChain = setupChain([]);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return tmChain;
      if (callCount === 2) return sfChain;
      return { upsert: mockUpsert.mockResolvedValue({ error: null }) };
    });

    const result = await reconcileDailyMetrics('2026-04-29', '2026-04-29');

    expect(result.reconciledCount).toBe(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({
        metric_date: '2026-04-29',
        orders: 3,
        gtv: 300,
        tickets_sold: 6,
        face_value: 250,
        gross_profit: null,
        source: 'reconciled',
      })],
      { onConflict: 'metric_date,event_name,source' }
    );
  });

  it('handles Snowflake-only data (TM missing)', async () => {
    const tmChain = setupChain([]);
    const sfChain = setupChain([
      { metric_date: '2026-04-30', face_value: 200, gross_profit: 50, tickets_sold: 5, source: 'snowflake' },
    ]);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return tmChain;
      if (callCount === 2) return sfChain;
      return { upsert: mockUpsert.mockResolvedValue({ error: null }) };
    });

    const result = await reconcileDailyMetrics('2026-04-30', '2026-04-30');

    expect(result.reconciledCount).toBe(1);
    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({
        metric_date: '2026-04-30',
        orders: null,
        gtv: null,
        sport: null,
        event_name: null,
        face_value: 200,
        gross_profit: 50,
        tickets_sold: 5,
        source: 'reconciled',
      })],
      { onConflict: 'metric_date,event_name,source' }
    );
  });

  it('returns zero count when no data exists', async () => {
    const tmChain = setupChain([]);
    const sfChain = setupChain([]);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return tmChain;
      if (callCount === 2) return sfChain;
      return { upsert: mockUpsert.mockResolvedValue({ error: null }) };
    });

    const result = await reconcileDailyMetrics('2026-04-28', '2026-04-30');

    expect(result.reconciledCount).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('throws on TM fetch error', async () => {
    const tmChain = setupChain(null, { message: 'connection refused' });
    const sfChain = setupChain([]);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return tmChain;
      return sfChain;
    });

    await expect(reconcileDailyMetrics('2026-04-28', '2026-04-28'))
      .rejects.toThrow('Failed to fetch TM data: connection refused');
  });

  it('throws on Snowflake fetch error', async () => {
    const tmChain = setupChain([]);
    const sfChain = setupChain(null, { message: 'timeout' });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return tmChain;
      return sfChain;
    });

    await expect(reconcileDailyMetrics('2026-04-28', '2026-04-28'))
      .rejects.toThrow('Failed to fetch Snowflake data: timeout');
  });

  it('throws on upsert error', async () => {
    const tmChain = setupChain([
      { metric_date: '2026-04-28', orders: 5, gtv: 500, sport: 'NBA', event_name: 'Game 1', face_value: 400, tickets_sold: 10, source: 'tm_api' },
    ]);
    const sfChain = setupChain([]);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return tmChain;
      if (callCount === 2) return sfChain;
      return { upsert: mockUpsert.mockResolvedValue({ error: { message: 'constraint violation' } }) };
    });

    await expect(reconcileDailyMetrics('2026-04-28', '2026-04-28'))
      .rejects.toThrow('Failed to upsert reconciled data: constraint violation');
  });

  it('allocates gross_profit proportionally across multiple events', async () => {
    const tmChain = setupChain([
      { metric_date: '2026-04-28', orders: 5, gtv: 500, sport: 'NBA', event_name: 'Lakers vs Celtics', face_value: 400, tickets_sold: 8, source: 'tm_api' },
      { metric_date: '2026-04-28', orders: 3, gtv: 300, sport: 'NHL', event_name: 'Rangers vs Bruins', face_value: 200, tickets_sold: 4, source: 'tm_api' },
    ]);
    const sfChain = setupChain([
      { metric_date: '2026-04-28', face_value: 600, gross_profit: 150, tickets_sold: 12, source: 'snowflake' },
    ]);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return tmChain;
      if (callCount === 2) return sfChain;
      return { upsert: mockUpsert.mockResolvedValue({ error: null }) };
    });

    const result = await reconcileDailyMetrics('2026-04-28', '2026-04-28');

    expect(result.reconciledCount).toBe(2);

    const rows = mockUpsert.mock.calls[0][0];
    const lakers = rows.find((r: Record<string, unknown>) => r.event_name === 'Lakers vs Celtics');
    const rangers = rows.find((r: Record<string, unknown>) => r.event_name === 'Rangers vs Bruins');

    // Lakers: 400/600 = 2/3 of 150 = 100
    expect(lakers).toMatchObject({
      orders: 5,
      gtv: 500,
      tickets_sold: 8,
      face_value: 400,
      gross_profit: 100,
      source: 'reconciled',
    });

    // Rangers: 200/600 = 1/3 of 150 = 50
    expect(rangers).toMatchObject({
      orders: 3,
      gtv: 300,
      tickets_sold: 4,
      face_value: 200,
      gross_profit: 50,
      source: 'reconciled',
    });
  });
});
