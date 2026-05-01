import Anthropic from '@anthropic-ai/sdk';
import type { WeekData } from './narrative';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface SportBreakdown {
  sport: string;
  tickets: number;
  gtv: number;
  percentOfTotal: number;
}

export interface TopEvent {
  sport: string;
  eventName: string;
  gtv: number;
}

export async function generateTalkTrack(
  weekData: WeekData,
  prevWeekData: WeekData | null,
  sportData: SportBreakdown[],
  topEvents: TopEvent[]
): Promise<string> {
  const wowTickets = prevWeekData && prevWeekData.totalTickets > 0
    ? ((weekData.totalTickets - prevWeekData.totalTickets) / prevWeekData.totalTickets * 100).toFixed(1)
    : null;
  const wowOrders = prevWeekData && prevWeekData.totalOrders > 0
    ? ((weekData.totalOrders - prevWeekData.totalOrders) / prevWeekData.totalOrders * 100).toFixed(1)
    : null;
  const wowGtv = prevWeekData && prevWeekData.totalGtv > 0
    ? ((weekData.totalGtv - prevWeekData.totalGtv) / prevWeekData.totalGtv * 100).toFixed(1)
    : null;
  const avgOrderValue = weekData.totalOrders > 0 ? weekData.totalGtv / weekData.totalOrders : 0;
  const prevAvgOrderValue = prevWeekData && prevWeekData.totalOrders > 0
    ? prevWeekData.totalGtv / prevWeekData.totalOrders
    : null;
  const wowAov = prevAvgOrderValue
    ? ((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue * 100).toFixed(1)
    : null;

  const sportBreakdownText = sportData
    .map((s) => `  - ${s.sport}: ${s.tickets.toLocaleString()} tickets (${s.percentOfTotal.toFixed(1)}%), $${(s.gtv / 1000).toFixed(1)}K GTV`)
    .join('\n');

  const topEventsText = topEvents
    .map((e, i) => `  ${i + 1}. ${e.eventName} (${e.sport}): $${(e.gtv / 1000).toFixed(1)}K`)
    .join('\n');

  const fmtWow = (val: string | null) => val ? ` (${Number(val) > 0 ? '+' : ''}${val}% WoW)` : '';

  const prompt = `You are an analytics lead preparing a verbal update script for a Weekly Business Review (WBR).

**Current Week (${weekData.weekStart}):**
- Tickets sold: ${weekData.totalTickets.toLocaleString()}${fmtWow(wowTickets)}
- Orders: ${weekData.totalOrders.toLocaleString()}${fmtWow(wowOrders)}
- GTV: $${(weekData.totalGtv / 1000).toFixed(1)}K${fmtWow(wowGtv)}
- Avg Order Value: $${avgOrderValue.toFixed(2)}${fmtWow(wowAov)}

**Previous Week:**
${prevWeekData ? `- Tickets: ${prevWeekData.totalTickets.toLocaleString()}, Orders: ${prevWeekData.totalOrders.toLocaleString()}, GTV: $${(prevWeekData.totalGtv / 1000).toFixed(1)}K` : 'No prior week data available'}

**Sport Breakdown (Current Week):**
${sportBreakdownText || '  No sport data available'}

**Top 5 Events by GTV:**
${topEventsText || '  No event data available'}

Structure your talk track with these sections:

1. **Headline Summary** (1-2 sentences): High-level performance snapshot with key WoW trend
2. **KPI Callouts** (3-4 sentences): Specific numbers for tickets, orders, GTV, AOV with context
3. **Key Drivers** (2-3 sentences): Analyze what drove the results — sport mix changes, marquee events, demand shifts
4. **Context & Takeaway** (1-2 sentences): What this means for the business
5. **Forward-Looking** (1-2 sentences): What to watch for next week

Write in a conversational, confident tone suitable for verbal delivery. Use numbers strategically (cite WoW deltas, top sports, marquee events). Keep the total length to 10-15 sentences. Do not use markdown formatting or section headers in the output — just write the script as a flowing narrative.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude API');
  }

  return textContent.text.trim();
}
