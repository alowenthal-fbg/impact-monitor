import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { generateTalkTrack, type SportBreakdown, type TopEvent, type LiveWeekContext } from './talk-track';
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

  describe('live-week branch', () => {
    const liveContext: LiveWeekContext = {
      daysWithData: 3,
      daysRemaining: 4,
      actualsThroughToday: { tickets: 600, orders: 300, gtv: 30000 },
      paceProjection: {
        tickets: 1800,
        orders: 900,
        gtv: 85000,
        paceRatio: 1.15,
      },
      commercialForecast: {
        tickets: 1700,
        orders: 850,
        gtv: 80000,
        hasForecast: true,
      },
      dayOfWeekStats: [
        { dayLabel: 'Mon', dayIndex: 0, actualTickets: 200, actualGtv: 10000, baselineTickets: 180, baselineGtv: 9000, hasActualData: true },
        { dayLabel: 'Tue', dayIndex: 1, actualTickets: 220, actualGtv: 11000, baselineTickets: 190, baselineGtv: 9500, hasActualData: true },
        { dayLabel: 'Wed', dayIndex: 2, actualTickets: 180, actualGtv: 9000, baselineTickets: 170, baselineGtv: 8500, hasActualData: true },
        { dayLabel: 'Thu', dayIndex: 3, actualTickets: null, actualGtv: null, baselineTickets: 200, baselineGtv: 10000, hasActualData: false },
        { dayLabel: 'Fri', dayIndex: 4, actualTickets: null, actualGtv: null, baselineTickets: 280, baselineGtv: 14000, hasActualData: false },
        { dayLabel: 'Sat', dayIndex: 5, actualTickets: null, actualGtv: null, baselineTickets: 350, baselineGtv: 18000, hasActualData: false },
        { dayLabel: 'Sun', dayIndex: 6, actualTickets: null, actualGtv: null, baselineTickets: 300, baselineGtv: 15000, hasActualData: false },
      ],
      bestBaselineDay: { dayLabel: 'Sat', gtv: 18000 },
      worstBaselineDay: { dayLabel: 'Wed', gtv: 8500 },
    };

    it('uses the mid-week prompt when liveContext is passed', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Mid-week update.' }],
      });

      await generateTalkTrack(weekData, prevWeekData, sportData, topEvents, liveContext);

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('mid-week');
      expect(prompt).toContain('3 of 7');
      expect(prompt).toContain('still in progress');
    });

    it('includes pace projection and forecast comparison', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Mid-week update.' }],
      });

      await generateTalkTrack(weekData, prevWeekData, sportData, topEvents, liveContext);

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      // Pace is 15% ahead of baseline
      expect(prompt).toMatch(/15(\.0)?% ahead of/);
      // Projected GTV $85K
      expect(prompt).toContain('$85.0K');
      // Forecast reference
      expect(prompt).toContain('$80.0K');
    });

    it('identifies best and worst baseline days of the week', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Mid-week update.' }],
      });

      await generateTalkTrack(weekData, prevWeekData, sportData, topEvents, liveContext);

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('Sat is the strongest day');
      expect(prompt).toContain('Wed is the weakest');
    });

    it('marks days without data as not yet reported', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Mid-week update.' }],
      });

      await generateTalkTrack(weekData, prevWeekData, sportData, topEvents, liveContext);

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('Thu: not yet reported');
      expect(prompt).toContain('Sat: not yet reported');
    });

    it('handles missing commercial forecast', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Mid-week update.' }],
      });

      const noForecastCtx: LiveWeekContext = {
        ...liveContext,
        commercialForecast: { tickets: 0, orders: 0, gtv: 0, hasForecast: false },
      };

      await generateTalkTrack(weekData, prevWeekData, sportData, topEvents, noForecastCtx);

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('No commercial forecast available');
    });

    it('uses max_tokens 2000 for live-week prompts', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Mid-week update.' }],
      });

      await generateTalkTrack(weekData, prevWeekData, sportData, topEvents, liveContext);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 2000 })
      );
    });

    it('defaults to completed-week prompt when liveContext is null', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Completed.' }],
      });

      await generateTalkTrack(weekData, prevWeekData, sportData, topEvents, null);

      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('Weekly Business Review (WBR)');
      expect(prompt).not.toContain('mid-week');
    });
  });
});
