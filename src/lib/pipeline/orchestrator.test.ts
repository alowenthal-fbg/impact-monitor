import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runFullPipeline } from './orchestrator';

// Mock dependencies
vi.mock('@/lib/pipeline/ticketmaster', () => ({
  pullTicketmasterData: vi.fn(),
}));

vi.mock('@/lib/email/send', () => ({
  sendMondayEmail: vi.fn(),
}));

vi.mock('@/lib/utils/week', () => ({
  isMonday: vi.fn(() => false),
}));

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: () => ({
    from: () => ({
      insert: mockInsert,
      update: mockUpdate,
    }),
  }),
}));

import { pullTicketmasterData } from '@/lib/pipeline/ticketmaster';

const mockPullTM = vi.mocked(pullTicketmasterData);

describe('Pipeline Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: pipeline_runs insert succeeds
    mockSingle.mockResolvedValue({ data: { id: 'run-123' }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  it('returns success when TM pull passes', async () => {
    mockPullTM.mockResolvedValue(undefined);

    const result = await runFullPipeline();

    expect(result.overallStatus).toBe('success');
    expect(result.stages.tmPull.success).toBe(true);
    expect(result.runId).toBe('run-123');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns failed when TM pull fails', async () => {
    mockPullTM.mockRejectedValue(new Error('TM API down'));

    const result = await runFullPipeline();

    expect(result.overallStatus).toBe('failed');
    expect(result.stages.tmPull.success).toBe(false);
    expect(result.stages.tmPull.error).toBe('TM API down');
  });

  it('throws when pipeline run initialization fails', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB down' } });

    await expect(runFullPipeline()).rejects.toThrow('Failed to initialize pipeline run: DB down');
  });

  it('includes timing data per stage', async () => {
    mockPullTM.mockResolvedValue(undefined);

    const result = await runFullPipeline();

    expect(result.stages.tmPull.durationMs).toBeGreaterThanOrEqual(0);
  });
});
