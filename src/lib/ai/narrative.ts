import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface WeekData {
  weekStart: string;
  totalTickets: number;
  totalOrders: number;
  totalGtv: number;
  totalFaceValue: number;
  totalGrossProfit: number;
}

export async function generateNarrative(
  weekData: WeekData,
  prevWeekData: WeekData | null
): Promise<string> {
  const wowTickets = prevWeekData && prevWeekData.totalTickets > 0
    ? ((weekData.totalTickets - prevWeekData.totalTickets) / prevWeekData.totalTickets * 100).toFixed(1)
    : null;
  const wowGtv = prevWeekData && prevWeekData.totalGtv > 0
    ? ((weekData.totalGtv - prevWeekData.totalGtv) / prevWeekData.totalGtv * 100).toFixed(1)
    : null;

  const prompt = `You are an analytics lead writing a brief email summary for a Weekly Business Review.

Current week (${weekData.weekStart}):
- Tickets sold: ${weekData.totalTickets.toLocaleString()}${wowTickets ? ` (${wowTickets}% WoW)` : ''}
- Orders: ${weekData.totalOrders.toLocaleString()}
- GTV: $${(weekData.totalGtv / 1000).toFixed(1)}K${wowGtv ? ` (${wowGtv}% WoW)` : ''}
- Face value: $${(weekData.totalFaceValue / 1000).toFixed(1)}K
- Gross profit: $${(weekData.totalGrossProfit / 1000).toFixed(1)}K

Previous week: ${prevWeekData ? `${prevWeekData.totalTickets.toLocaleString()} tickets, $${(prevWeekData.totalGtv / 1000).toFixed(1)}K GTV` : 'No prior week data available'}

Write a 2-4 sentence summary suitable for an email. Focus on the headline performance (tickets, GTV), note the week-over-week trend (up/down), and provide context if the change is significant. Keep the tone professional but conversational. Do not use markdown formatting.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude API');
  }

  return textContent.text.trim();
}
