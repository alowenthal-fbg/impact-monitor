import Anthropic from '@anthropic-ai/sdk';
import type { WeekData } from './narrative';

const anthropic = new Anthropic({
  authToken: process.env.BEDROCK_API_TOKEN!,
  baseURL: process.env.BEDROCK_BASE_URL ?? 'https://bedrock-mantle.us-east-1.api.aws/anthropic',
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

export interface DayOfWeekStat {
  dayLabel: string; // Mon, Tue, ...
  dayIndex: number; // 0=Mon
  actualTickets: number | null; // null if day hasn't happened yet or no data
  actualGtv: number | null;
  baselineTickets: number; // 4-week avg
  baselineGtv: number;
  hasActualData: boolean;
}

export interface LiveWeekContext {
  daysWithData: number; // how many days into the week have actual data (1-7)
  daysRemaining: number; // 7 - daysWithData
  actualsThroughToday: {
    tickets: number;
    orders: number;
    gtv: number;
  };
  paceProjection: {
    // Projected week total if current pace continues
    tickets: number;
    orders: number;
    gtv: number;
    // Ratio of actual-through-today vs baseline-through-today
    paceRatio: number;
  };
  commercialForecast: {
    // Commercial team's full-week forecast (sum of daily forecasts)
    tickets: number;
    orders: number;
    gtv: number;
    hasForecast: boolean;
  };
  dayOfWeekStats: DayOfWeekStat[]; // All 7 days: baseline + actuals where available
  bestBaselineDay: { dayLabel: string; gtv: number } | null;
  worstBaselineDay: { dayLabel: string; gtv: number } | null;
}

export async function generateTalkTrack(
  weekData: WeekData,
  prevWeekData: WeekData | null,
  sportData: SportBreakdown[],
  topEvents: TopEvent[],
  liveContext: LiveWeekContext | null = null
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

  const prompt = liveContext
    ? buildLiveWeekPrompt({
        weekData,
        prevWeekData,
        sportBreakdownText,
        topEventsText,
        wowTickets,
        wowOrders,
        wowGtv,
        wowAov,
        avgOrderValue,
        fmtWow,
        liveContext,
      })
    : buildCompletedWeekPrompt({
        weekData,
        prevWeekData,
        sportBreakdownText,
        topEventsText,
        wowTickets,
        wowOrders,
        wowGtv,
        wowAov,
        avgOrderValue,
        fmtWow,
      });

  const message = await anthropic.messages.create({
    model: 'anthropic.claude-opus-4-7',
    max_tokens: liveContext ? 2000 : 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude API');
  }

  return textContent.text.trim();
}

interface PromptParts {
  weekData: WeekData;
  prevWeekData: WeekData | null;
  sportBreakdownText: string;
  topEventsText: string;
  wowTickets: string | null;
  wowOrders: string | null;
  wowGtv: string | null;
  wowAov: string | null;
  avgOrderValue: number;
  fmtWow: (val: string | null) => string;
}

function buildCompletedWeekPrompt(p: PromptParts): string {
  const { weekData, prevWeekData, sportBreakdownText, topEventsText, wowTickets, wowGtv, wowAov, avgOrderValue, fmtWow } = p;

  // Compute share-of-total stats so the prompt can feed the model ready-to-cite framing
  const totalGtv = weekData.totalGtv;
  const topEventSharesText = (() => {
    const parts = topEventsText.split('\n').filter(Boolean);
    if (parts.length === 0) return '';
    // No-op: the raw GTV per event is already in topEventsText; we pass a note
    // so the model knows to compute share-of-total itself from the data shown.
    return `(When citing a top event, convert its GTV into a share of the week's $${(totalGtv / 1000).toFixed(1)}K total — e.g. "accounted for over X% of overall GTV".)`;
  })();

  return `You are the analytics lead writing the Weekly Summary that appears when a user clicks the Weekly Summary button on the dashboard. The audience is senior commercial stakeholders who already have the KPIs in front of them on the dashboard.

**Current Week (${weekData.weekStart}):**
- Tickets sold: ${weekData.totalTickets.toLocaleString()}${fmtWow(wowTickets)}
- GTV: $${(weekData.totalGtv / 1000).toFixed(1)}K${fmtWow(wowGtv)}
- Avg Order Value: $${avgOrderValue.toFixed(2)}${fmtWow(wowAov)}

**Previous Week:**
${prevWeekData ? `- Tickets: ${prevWeekData.totalTickets.toLocaleString()}, GTV: $${(prevWeekData.totalGtv / 1000).toFixed(1)}K` : 'No prior week data available'}

**Sport Breakdown (Current Week):**
${sportBreakdownText || '  No sport data available'}

**Top 5 Events by GTV:**
${topEventsText || '  No event data available'}
${topEventSharesText}

Write the summary in exactly this structure, as plain text (no markdown, no headers, no bullet prefixes like "-" or "*"):

1. ONE opening sentence with the single most important headline stat — pick the more striking of tickets WoW or GTV crossing a threshold. Do not greet the reader. Do not say "here's the read on the week" or "this week we saw…". Just state the fact.

2. A blank line, then 2 to 3 short driver lines, each on its own line (no bullet prefix). Each line ties a sport or a specific event to a concrete share-of-total or contribution stat. Prefer share-of-total framing ("accounted for over 20% of overall GTV", "contributed 59% of ticket volume") over rank framing ("our top event", "the 5th ranked event"). Each line must add distinct information — do not restate the opener.

3. A blank line, then ONE single-sentence synthesis line — the "so what" that interprets the drivers for the business. Examples of the shape (do not copy verbatim): "The business is broadening, not trading off." "Volume growth is outpacing price, which tells us we're widening the funnel rather than trading up."

Hard rules:
- Do NOT recite KPIs that are already on the dashboard (orders count, AOV dollar, every WoW delta). Use one or two numbers in the opener only if they anchor the headline.
- Do NOT write a "Looking ahead" or "What to watch" section. A human adds that separately.
- Do NOT use filler adjectives like "solid", "healthy", "strong", "robust", "impressive" unless paired with a stat that earns the word.
- Do NOT use filler transitions like "Digging into the drivers…", "The takeaway is…", "Overall…".
- Write tight, confident, declarative sentences. Target 5-8 sentences total across all three parts.`;
}

function buildLiveWeekPrompt(p: PromptParts & { liveContext: LiveWeekContext }): string {
  const { weekData, prevWeekData, sportBreakdownText, topEventsText, wowTickets, wowGtv, avgOrderValue, fmtWow, liveContext } = p;
  const lc = liveContext;

  // Format pace vs forecast deltas
  const pct = (num: number, denom: number) => denom > 0 ? ((num - denom) / denom * 100).toFixed(1) : '—';
  const fmtPct = (val: string) => val === '—' ? '' : ` (${Number(val) > 0 ? '+' : ''}${val}% vs forecast)`;

  const paceVsForecastTickets = lc.commercialForecast.hasForecast
    ? fmtPct(pct(lc.paceProjection.tickets, lc.commercialForecast.tickets))
    : '';
  const paceVsForecastGtv = lc.commercialForecast.hasForecast
    ? fmtPct(pct(lc.paceProjection.gtv, lc.commercialForecast.gtv))
    : '';

  // Build day-of-week table
  const dayTable = lc.dayOfWeekStats
    .map((d) => {
      const actual = d.hasActualData
        ? `actual ${(d.actualTickets ?? 0).toLocaleString()} tickets / $${((d.actualGtv ?? 0) / 1000).toFixed(1)}K`
        : 'not yet reported';
      const baseline = `baseline ${Math.round(d.baselineTickets).toLocaleString()} tickets / $${(d.baselineGtv / 1000).toFixed(1)}K`;
      return `  - ${d.dayLabel}: ${actual} (${baseline})`;
    })
    .join('\n');

  const bestWorst = lc.bestBaselineDay && lc.worstBaselineDay
    ? `Historically (4-week baseline), ${lc.bestBaselineDay.dayLabel} is the strongest day ($${(lc.bestBaselineDay.gtv / 1000).toFixed(1)}K avg GTV) and ${lc.worstBaselineDay.dayLabel} is the weakest ($${(lc.worstBaselineDay.gtv / 1000).toFixed(1)}K avg GTV).`
    : '';

  const paceRatioPct = ((lc.paceProjection.paceRatio - 1) * 100).toFixed(1);
  const paceDirection = lc.paceProjection.paceRatio >= 1 ? 'ahead of' : 'behind';

  return `You are an analytics lead preparing a mid-week update script for a live (in-progress) week. The week is NOT complete — we have partial data and need to frame the narrative around trend, pace, and projection rather than final results.

**IMPORTANT CONTEXT: This week is still in progress.**
- Days of data captured so far: ${lc.daysWithData} of 7
- Days remaining: ${lc.daysRemaining}

**Actuals Through Today (partial week):**
- Tickets sold: ${lc.actualsThroughToday.tickets.toLocaleString()}
- Orders: ${lc.actualsThroughToday.orders.toLocaleString()}
- GTV: $${(lc.actualsThroughToday.gtv / 1000).toFixed(1)}K

**Pace Analysis:**
- Current pace is ${Math.abs(Number(paceRatioPct))}% ${paceDirection} the 4-week baseline through this point in the week
- Projected week landing (if current pace holds):
  - Tickets: ${Math.round(lc.paceProjection.tickets).toLocaleString()}
  - Orders: ${Math.round(lc.paceProjection.orders).toLocaleString()}
  - GTV: $${(lc.paceProjection.gtv / 1000).toFixed(1)}K${paceVsForecastGtv}

**Commercial Team Forecast (full week target):**
${lc.commercialForecast.hasForecast
  ? `- Tickets: ${lc.commercialForecast.tickets.toLocaleString()}
- Orders: ${lc.commercialForecast.orders.toLocaleString()}
- GTV: $${(lc.commercialForecast.gtv / 1000).toFixed(1)}K
- Our pace is projecting${paceVsForecastTickets} on tickets and${paceVsForecastGtv} on GTV vs. the commercial forecast.`
  : '- No commercial forecast available for this week.'}

**Day-of-Week Performance (actual vs 4-week baseline):**
${dayTable}

${bestWorst}

**Previous Completed Week (${prevWeekData?.weekStart ?? 'n/a'}) for reference:**
${prevWeekData ? `- Tickets: ${prevWeekData.totalTickets.toLocaleString()}, GTV: $${(prevWeekData.totalGtv / 1000).toFixed(1)}K` : 'No prior week data available'}

**Partial-Week KPI Snapshot (informational — do NOT compare WoW directly since the week is incomplete):**
- Tickets so far: ${weekData.totalTickets.toLocaleString()}${fmtWow(wowTickets)}
- GTV so far: $${(weekData.totalGtv / 1000).toFixed(1)}K${fmtWow(wowGtv)}
- AOV so far: $${avgOrderValue.toFixed(2)}

**Sport Breakdown (Partial Week):**
${sportBreakdownText || '  No sport data available'}

**Top Events So Far:**
${topEventsText || '  No event data available'}

Structure your mid-week update with these sections:

1. **Opening Frame** (1-2 sentences): Explicitly acknowledge this is a mid-week check-in — state where we are in the week (e.g., "${lc.daysWithData} days in with ${lc.daysRemaining} to go") and set the tone for a trend-focused update rather than a final scorecard.

2. **Pace Read** (2-3 sentences): Explain whether we are running ahead, behind, or on pace vs. the 4-week baseline through this point in the week. Cite the pace ratio and the projected landing.

3. **Forecast Confidence** (2-3 sentences): Call out whether we are tracking to meet, beat, or miss the commercial forecast. Give a confidence read — e.g., "we're pacing X% above forecast with the strongest days still ahead" or "we need a strong weekend to close the gap." If no forecast exists, skip this section.

4. **Day-of-Week Narrative** (2-3 sentences): Identify which days typically drive the week (best/worst baseline days) and whether those high-leverage days are still ahead or already behind us. This is KEY — if the big days are still coming, pace can shift meaningfully; if they're already in the bag, trajectory is more locked in.

5. **Mix & Drivers** (1-2 sentences): Briefly note what sports or events are driving the partial-week numbers.

6. **Outlook** (1-2 sentences): End with a confident read on where we think the week will land and what needs to happen to get there (or hold there).

Write in a conversational, confident tone suitable for verbal delivery to leadership. Be direct about confidence levels. Use numbers strategically but don't overload — the goal is to give the audience a clear trend read, not a data dump. Keep the total length to 12-18 sentences. Do not use markdown formatting or section headers in the output — just write the script as a flowing narrative.`;
}
