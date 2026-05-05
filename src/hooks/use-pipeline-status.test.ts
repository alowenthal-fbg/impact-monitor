import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { usePipelineStatus } from './use-pipeline-status';

function buildChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  return chain;
}

let mockChain: ReturnType<typeof buildChain>;
const mockFrom = vi.fn(() => mockChain);

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

describe('usePipelineStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the most recent pipeline run', async () => {
    const mockData = {
      status: 'success',
      started_at: '2026-04-30T10:00:00Z',
      error_message: null,
    };

    mockChain = buildChain({ data: mockData, error: null });

    const { result } = renderHook(() => usePipelineStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  it('returns failed status with error message', async () => {
    const mockData = {
      status: 'failed',
      started_at: '2026-04-30T08:00:00Z',
      error_message: 'Ticketmaster API timeout',
    };

    mockChain = buildChain({ data: mockData, error: null });

    const { result } = renderHook(() => usePipelineStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe('failed');
    expect(result.current.data?.error_message).toBe('Ticketmaster API timeout');
  });

  it('throws on supabase error', async () => {
    mockChain = buildChain({ data: null, error: { message: 'Connection failed' } });

    const { result } = renderHook(() => usePipelineStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
