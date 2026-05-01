import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useTopEvents } from './use-top-events';

const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useTopEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns top 5 events sorted by GTV descending', async () => {
    const mockData = [
      { sport: 'NFL', event_name: 'Super Bowl', gtv: 5000 },
      { sport: 'NFL', event_name: 'Super Bowl', gtv: 3000 },
      { sport: 'NBA', event_name: 'Finals G7', gtv: 4000 },
      { sport: 'MLB', event_name: 'World Series', gtv: 2000 },
      { sport: 'NHL', event_name: 'Stanley Cup', gtv: 1500 },
      { sport: 'MLS', event_name: 'MLS Cup', gtv: 1000 },
      { sport: 'NCAA', event_name: 'March Madness', gtv: 500 },
    ];

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(
      () => useTopEvents('2026-04-21', '2026-04-27'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(5);
    // Super Bowl aggregated: 5000 + 3000 = 8000, should be first
    expect(result.current.data![0].event_name).toBe('Super Bowl');
    expect(result.current.data![0].gtv).toBe(8000);
    // Finals G7 second
    expect(result.current.data![1].event_name).toBe('Finals G7');
    expect(result.current.data![1].gtv).toBe(4000);
  });

  it('returns empty array when no data', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(
      () => useTopEvents('2026-04-21', '2026-04-27'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it('throws on supabase error', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    });

    const { result } = renderHook(
      () => useTopEvents('2026-04-21', '2026-04-27'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ message: 'DB error' });
  });
});
