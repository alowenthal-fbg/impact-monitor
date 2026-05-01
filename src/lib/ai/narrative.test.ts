import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { generateNarrative, type WeekData } from './narrative';

describe('generateNarrative', () => {
  const weekData: WeekData = {
    weekStart: '2026-04-21',
    totalTickets: 1500,
    totalOrders: 800,
    totalGtv: 75000,
    totalFaceValue: 60000,
    totalGrossProfit: 15000,
  };

  const prevWeekData: WeekData = {
    weekStart: '2026-04-14',
    totalTickets: 1200,
    totalOrders: 700,
    totalGtv: 65000,
    totalFaceValue: 55000,
    totalGrossProfit: 12000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns narrative text from Claude response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'This week saw strong performance with 1,500 tickets sold.' }],
    });

    const result = await generateNarrative(weekData, prevWeekData);
    expect(result).toBe('This week saw strong performance with 1,500 tickets sold.');
  });

  it('passes correct model to API', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Summary text.' }],
    });

    await generateNarrative(weekData, prevWeekData);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
      })
    );
  });

  it('handles null previous week data', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'First week summary.' }],
    });

    const result = await generateNarrative(weekData, null);
    expect(result).toBe('First week summary.');

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('No prior week data available');
  });

  it('throws if no text content in response', async () => {
    mockCreate.mockResolvedValue({
      content: [],
    });

    await expect(generateNarrative(weekData, prevWeekData)).rejects.toThrow(
      'No text response from Claude API'
    );
  });
});
