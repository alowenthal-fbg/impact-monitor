import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { generateTalkTrack, type SportBreakdown, type TopEvent } from './talk-track';
import type { WeekData } from './narrative';

describe('generateTalkTrack', () => {
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

  const sportData: SportBreakdown[] = [
    { sport: 'NFL', tickets: 800, gtv: 40000, percentOfTotal: 53.3 },
    { sport: 'NBA', tickets: 500, gtv: 25000, percentOfTotal: 33.3 },
    { sport: 'MLB', tickets: 200, gtv: 10000, percentOfTotal: 13.3 },
  ];

  const topEvents: TopEvent[] = [
    { sport: 'NFL', eventName: 'Super Bowl', gtv: 20000 },
    { sport: 'NBA', eventName: 'Finals G7', gtv: 15000 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns talk track text from Claude response', async () => {
    const talkTrackText = 'This was a strong week for the business...';
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: talkTrackText }],
    });

    const result = await generateTalkTrack(weekData, prevWeekData, sportData, topEvents);
    expect(result).toBe(talkTrackText);
  });

  it('includes sport breakdown and top events in prompt', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Talk track.' }],
    });

    await generateTalkTrack(weekData, prevWeekData, sportData, topEvents);

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('NFL');
    expect(prompt).toContain('Super Bowl');
    expect(prompt).toContain('Finals G7');
    expect(prompt).toContain('53.3%');
  });

  it('includes WoW deltas with correct signs', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Talk track.' }],
    });

    await generateTalkTrack(weekData, prevWeekData, sportData, topEvents);

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('+25.0% WoW'); // tickets: (1500-1200)/1200 = 25%
    expect(prompt).toContain('+15.4% WoW'); // GTV: (75000-65000)/65000 ≈ 15.4%
  });

  it('uses max_tokens 1500 for comprehensive output', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Talk track.' }],
    });

    await generateTalkTrack(weekData, prevWeekData, sportData, topEvents);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 1500 })
    );
  });

  it('handles null previous week gracefully', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'First week talk track.' }],
    });

    const result = await generateTalkTrack(weekData, null, sportData, topEvents);
    expect(result).toBe('First week talk track.');

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('No prior week data available');
  });
});
