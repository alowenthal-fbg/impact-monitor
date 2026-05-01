import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transformOrders, type TmOrder } from './ticketmaster';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock supabase server client
const mockUpsert = vi.fn();
vi.mock('../supabase/server', () => ({
  createServerClient: () => ({
    from: () => ({ upsert: mockUpsert }),
  }),
}));

// Set env vars
vi.stubEnv('TM_API_KEY', 'test-key');
vi.stubEnv('TM_API_SECRET', 'test-secret');

function mockTokenResponse() {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ access_token: 'test-token', expires_in: 3600 }),
  };
}

function mockOrdersResponse(orders: TmOrder[], page = 1, totalPages = 1) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ orders, page, total_pages: totalPages }),
  };
}

const sampleOrders: TmOrder[] = [
  {
    order_date: '2026-04-20',
    event_name: 'Lakers vs Celtics',
    sport: 'Basketball',
    ticket_quantity: 2,
    total_amount: 150.0,
    face_value: 120.0,
  },
  {
    order_date: '2026-04-20',
    event_name: 'Lakers vs Celtics',
    sport: 'Basketball',
    ticket_quantity: 4,
    total_amount: 300.0,
    face_value: 240.0,
  },
  {
    order_date: '2026-04-21',
    event_name: 'Yankees vs Red Sox',
    sport: 'Baseball',
    ticket_quantity: 3,
    total_amount: 225.0,
    face_value: 180.0,
  },
];

describe('transformOrders', () => {
  it('groups orders by date+event and aggregates', () => {
    const rows = transformOrders(sampleOrders);
    expect(rows).toHaveLength(2);

    const lakers = rows.find((r) => r.event_name === 'Lakers vs Celtics');
    expect(lakers).toMatchObject({
      metric_date: '2026-04-20',
      tickets_sold: 6,
      orders: 2,
      gtv: 450.0,
      face_value: 360.0,
      sport: 'Basketball',
      source: 'tm_api',
      gross_profit: null,
    });

    const yankees = rows.find((r) => r.event_name === 'Yankees vs Red Sox');
    expect(yankees).toMatchObject({
      metric_date: '2026-04-21',
      tickets_sold: 3,
      orders: 1,
      gtv: 225.0,
      face_value: 180.0,
      sport: 'Baseball',
      source: 'tm_api',
    });
  });

  it('returns empty array for no orders', () => {
    expect(transformOrders([])).toEqual([]);
  });
});

describe('pullTicketmasterData', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({ error: null });
    // Reset cached token by re-importing
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches orders and upserts to supabase', async () => {
    mockFetch
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValueOnce(mockOrdersResponse(sampleOrders));

    const { pullTicketmasterData } = await import('./ticketmaster');
    await pullTicketmasterData('2026-04-20', '2026-04-21');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [rows, options] = mockUpsert.mock.calls[0];
    expect(rows).toHaveLength(2);
    expect(options).toEqual({ onConflict: 'metric_date,event_name,source' });
  });

  it('refreshes token on 401 and retries', async () => {
    const unauthorizedResponse = { ok: false, status: 401, text: () => Promise.resolve('Unauthorized') };

    mockFetch
      // First token
      .mockResolvedValueOnce(mockTokenResponse())
      // 401 on orders
      .mockResolvedValueOnce(unauthorizedResponse)
      // Refresh token
      .mockResolvedValueOnce(mockTokenResponse())
      // Successful orders
      .mockResolvedValueOnce(mockOrdersResponse(sampleOrders));

    const { pullTicketmasterData } = await import('./ticketmaster');
    await pullTicketmasterData('2026-04-20', '2026-04-21');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 rate limit via retryWithBackoff', async () => {
    const rateLimitResponse = { ok: false, status: 429, text: () => Promise.resolve('Rate limited') };

    mockFetch
      // Token for attempt 1
      .mockResolvedValueOnce(mockTokenResponse())
      // 429 on orders (attempt 1)
      .mockResolvedValueOnce(rateLimitResponse)
      // Token for attempt 2 (retry)
      .mockResolvedValueOnce(mockTokenResponse())
      // Success on retry
      .mockResolvedValueOnce(mockOrdersResponse(sampleOrders));

    const { pullTicketmasterData } = await import('./ticketmaster');
    await pullTicketmasterData('2026-04-20', '2026-04-21');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('throws after max retries exhausted', { timeout: 15000 }, async () => {
    const serverError = { ok: false, status: 500, text: () => Promise.resolve('Server error') };

    // Token is cached after first call, so retries only hit orders endpoint
    mockFetch
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValue(serverError);

    const { pullTicketmasterData } = await import('./ticketmaster');
    await expect(pullTicketmasterData('2026-04-20', '2026-04-21')).rejects.toThrow('TM API error: 500');
  });

  it('skips upsert when no orders returned', async () => {
    mockFetch
      .mockResolvedValueOnce(mockTokenResponse())
      .mockResolvedValueOnce(mockOrdersResponse([]));

    const { pullTicketmasterData } = await import('./ticketmaster');
    await pullTicketmasterData('2026-04-20', '2026-04-21');

    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
