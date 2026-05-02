import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runFullPipeline } from './orchestrator';

// Mock dependencies
vi.mock('@/lib/pipeline/ticketmaster', () => ({
  pullTicketmasterData: vi.fn(),
}));

vi.mock('@/lib/pipeline/snowflake', () => ({
  fetchSnowflakeData: vi.fn(),
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
import { fetchSnowflakeData } from '@/lib/pipeline/snowflake';

const mockPullTM = vi.mocked(pullTicketmasterData);
const mockFetchSF = vi.mocked(fetchSnowflakeData);

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

  it('returns success when both stages pass', async () => {
    mockPullTM.mockResolvedValue(undefined);
    mockFetchSF.mockResolvedValue(undefined);

    const result = await runFullPipeline();

    expect(result.overallStatus).toBe('success');
    expect(result.stages.tmPull.success).toBe(true);
    expect(result.stages.snowflakePull.success).toBe(true);
    expect(result.runId).toBe('run-123');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns partial when TM fails but Snowflake succeeds', async () => {
    mockPullTM.mockRejectedValue(new Error('TM API down'));
    mockFetchSF.mockResolvedValue(undefined);

    const result = await runFullPipeline();

    expect(result.overallStatus).toBe('partial');
    expect(result.stages.tmPull.success).toBe(false);
    expect(result.stages.tmPull.error).toBe('TM API down');
    expect(result.stages.snowflakePull.success).toBe(true);
  });

  it('returns partial when Snowflake fails but TM succeeds', async () => {
    mockPullTM.mockResolvedValue(undefined);
    mockFetchSF.mockRejectedValue(new Error('Snowflake timeout'));

    const result = await runFullPipeline();

    expect(result.overallStatus).toBe('partial');
    expect(result.stages.tmPull.success).toBe(true);
    expect(result.stages.snowflakePull.success).toBe(false);
    expect(result.stages.snowflakePull.error).toBe('Snowflake timeout');
  });

  it('returns failed when both sources fail', async () => {
    mockPullTM.mockRejectedValue(new Error('TM fail'));
    mockFetchSF.mockRejectedValue(new Error('SF fail'));

    const result = await runFullPipeline();

    expect(result.overallStatus).toBe('failed');
    expect(result.stages.tmPull.success).toBe(false);
    expect(result.stages.snowflakePull.success).toBe(false);
  });

  it('throws when pipeline run initialization fails', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB down' } });

    await expect(runFullPipeline()).rejects.toThrow('Failed to initialize pipeline run: DB down');
  });

  it('includes timing data per stage', async () => {
    mockPullTM.mockResolvedValue(undefined);
    mockFetchSF.mockResolvedValue(undefined);

    const result = await runFullPipeline();

    expect(result.stages.tmPull.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.stages.snowflakePull.durationMs).toBeGreaterThanOrEqual(0);
  });
});
