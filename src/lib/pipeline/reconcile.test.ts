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

  it('merges TM and Snowflake data by date', async () => {
    const tmChain = setupChain([
      { metric_date: '2026-04-28', orders: 5, gtv: 500, sport: 'NBA', event_name: 'Lakers vs Celtics', source: 'tm_api' },
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
        gross_profit: 100,
        tickets_sold: 10,
        source: 'reconciled',
      })],
      { onConflict: 'metric_date,event_name,source' }
    );
  });

  it('handles TM-only data (Snowflake missing)', async () => {
    const tmChain = setupChain([
      { metric_date: '2026-04-29', orders: 3, gtv: 300, sport: 'MLB', event_name: 'Yankees vs Mets', source: 'tm_api' },
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
        face_value: null,
        gross_profit: null,
        tickets_sold: null,
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
      { metric_date: '2026-04-28', orders: 5, gtv: 500, sport: 'NBA', event_name: 'Game 1', source: 'tm_api' },
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

  it('handles multiple TM events on same date', async () => {
    const tmChain = setupChain([
      { metric_date: '2026-04-28', orders: 5, gtv: 500, sport: 'NBA', event_name: 'Lakers vs Celtics', source: 'tm_api' },
      { metric_date: '2026-04-28', orders: 3, gtv: 300, sport: 'NHL', event_name: 'Rangers vs Bruins', source: 'tm_api' },
    ]);
    const sfChain = setupChain([
      { metric_date: '2026-04-28', face_value: 600, gross_profit: 150, tickets_sold: 15, source: 'snowflake' },
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
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ event_name: 'Lakers vs Celtics', source: 'reconciled' }),
        expect.objectContaining({ event_name: 'Rangers vs Bruins', source: 'reconciled' }),
      ]),
      { onConflict: 'metric_date,event_name,source' }
    );
  });
});
