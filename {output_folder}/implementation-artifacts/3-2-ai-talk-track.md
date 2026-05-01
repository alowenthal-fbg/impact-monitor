# Story 3.2: AI Narrative & Talk Track Generation

Status: review

## Story

As a user,
I want to generate an AI narrative summary and full talk track,
so that I have a ready-to-use verbal update script for the WBR.

## Acceptance Criteria

1. Talk track download button calls Claude API, generates full script with: headline summary, KPI callouts with WoW deltas, key drivers analysis, context/takeaway, forward-looking focus areas. Downloads as text file.
2. AI narrative generator produces 2-4 sentence summary suitable for email (reused by Story 4.1).
3. Prompt includes historical context (prior weeks' data) for comparative analysis. AI identifies key drivers by comparing sport mix, event performance, volume trends.
4. Download button shows loading state. Errors surface as clear user message.

## Tasks / Subtasks

- [x] Task 1: Install Anthropic SDK (AC: #1)
  - [x] Run `pnpm add @anthropic-ai/sdk`
  - [x] Add `ANTHROPIC_API_KEY` to `.env.example` and `.env.local`
  - [x] Verify environment variable is not prefixed with `NEXT_PUBLIC_` (server-only)
- [x] Task 2: Create AI narrative generation utility (AC: #2, #3)
  - [x] Create `src/lib/ai/narrative.ts`
  - [x] Export `generateNarrative(weekData, prevWeekData)` function
  - [x] Implement Claude API call with prompt template for 2-4 sentence summary
  - [x] Return plain text string suitable for email body
- [x] Task 3: Create AI talk track generation utility (AC: #1, #3)
  - [x] Create `src/lib/ai/talk-track.ts`
  - [x] Export `generateTalkTrack(weekData, prevWeekData, sportData, topEvents)` function
  - [x] Implement Claude API call with comprehensive prompt template
  - [x] Structure prompt to include: headline, KPIs with WoW deltas, key drivers (sport mix, events, trends), context/takeaway, forward-looking areas
  - [x] Return full script as plain text string
- [x] Task 4: Create API route for talk track generation (AC: #1, #4)
  - [x] Create `src/app/api/export/talk-track/route.ts`
  - [x] Accept POST request with `weekStart` parameter
  - [x] Fetch weekly data, previous week data, sport breakdown, top events from Supabase
  - [x] Call `generateTalkTrack()` utility
  - [x] Return generated text as response
  - [x] Handle errors with `errorResponse()` helper
- [x] Task 5: Create talk track download button component (AC: #1, #4)
  - [x] Create `src/components/talk-track-download.tsx`
  - [x] Implement button with loading state
  - [x] On click: POST to `/api/export/talk-track` with selected week
  - [x] On success: trigger text file download with filename `talk-track-week-${weekStart}.txt`
  - [x] On error: show user-friendly error message
- [x] Task 6: Add talk track button to dashboard (AC: #1)
  - [x] Import `TalkTrackDownload` component in `src/app/page.tsx`
  - [x] Position near export image button
  - [x] Pass selected week data as prop
- [x] Task 7: Design and test Claude prompts (AC: #1, #2, #3)
  - [x] Test narrative prompt generates 2-4 sentence summaries matching WBR tone
  - [x] Test talk track prompt produces comprehensive script with all required sections
  - [x] Validate key drivers analysis identifies meaningful insights from data
  - [x] Ensure historical context improves comparative analysis quality

## Dev Notes

### Project Structure Notes

**New files created:**
```
src/
├── lib/
│   └── ai/
│       ├── narrative.ts
│       └── talk-track.ts
├── app/
│   └── api/
│       └── export/
│           └── talk-track/
│               └── route.ts
└── components/
    └── talk-track-download.tsx
```

**Modified files:**
```
src/app/page.tsx (add talk track button)
.env.example (add ANTHROPIC_API_KEY)
package.json (add @anthropic-ai/sdk)
```

### Environment Variables

```bash
# .env.example
ANTHROPIC_API_KEY=sk-ant-...
```

**CRITICAL:** Do NOT prefix with `NEXT_PUBLIC_` — this key must remain server-only.

### Anthropic SDK Setup

**Installation:**
```bash
pnpm add @anthropic-ai/sdk
```

**Model selection:** Use `claude-sonnet-4` (also known as `claude-sonnet-4-20250514`) for cost efficiency. This model provides excellent performance at lower cost than Opus.

**Cost reference (as of April 2026):**
- Sonnet 4: $3 per million input tokens, $15 per million output tokens
- Typical talk track generation: ~2000 input tokens, ~800 output tokens = $0.018 per generation

### AI Narrative Generation

```typescript
// src/lib/ai/narrative.ts
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
  const wowTickets = prevWeekData
    ? ((weekData.totalTickets - prevWeekData.totalTickets) / prevWeekData.totalTickets * 100).toFixed(1)
    : null;
  const wowGtv = prevWeekData
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
```

### AI Talk Track Generation

```typescript
// src/lib/ai/talk-track.ts
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
  const wowTickets = prevWeekData
    ? ((weekData.totalTickets - prevWeekData.totalTickets) / prevWeekData.totalTickets * 100).toFixed(1)
    : null;
  const wowOrders = prevWeekData
    ? ((weekData.totalOrders - prevWeekData.totalOrders) / prevWeekData.totalOrders * 100).toFixed(1)
    : null;
  const wowGtv = prevWeekData
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

  const prompt = `You are an analytics lead preparing a verbal update script for a Weekly Business Review (WBR). Write a complete talk track that matches the style and depth of the historical WBR scripts provided to you.

**Current Week (${weekData.weekStart}):**
- Tickets sold: ${weekData.totalTickets.toLocaleString()}${wowTickets ? ` (${wowTickets > 0 ? '+' : ''}${wowTickets}% WoW)` : ''}
- Orders: ${weekData.totalOrders.toLocaleString()}${wowOrders ? ` (${wowOrders > 0 ? '+' : ''}${wowOrders}% WoW)` : ''}
- GTV: $${(weekData.totalGtv / 1000).toFixed(1)}K${wowGtv ? ` (${wowGtv > 0 ? '+' : ''}${wowGtv}% WoW)` : ''}
- Avg Order Value: $${avgOrderValue.toFixed(2)}${wowAov ? ` (${wowAov > 0 ? '+' : ''}${wowAov}% WoW)` : ''}

**Previous Week:**
${prevWeekData ? `- Tickets: ${prevWeekData.totalTickets.toLocaleString()}, Orders: ${prevWeekData.totalOrders.toLocaleString()}, GTV: $${(prevWeekData.totalGtv / 1000).toFixed(1)}K` : 'No prior week data available'}

**Sport Breakdown (Current Week):**
${sportBreakdownText}

**Top 5 Events by GTV:**
${topEventsText}

Structure your talk track with these sections:

1. **Headline Summary** (1-2 sentences): High-level performance snapshot with key WoW trend
2. **KPI Callouts** (3-4 sentences): Specific numbers for tickets, orders, GTV, AOV with context
3. **Key Drivers** (2-3 sentences): Analyze what drove the results — sport mix changes, marquee events, demand shifts, inventory gaps
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
```

### API Route for Talk Track Generation

```typescript
// src/app/api/export/talk-track/route.ts
import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateTalkTrack } from '@/lib/ai/talk-track';
import { successResponse, errorResponse } from '@/lib/utils/api';
import type { WeekData, SportBreakdown, TopEvent } from '@/lib/ai/talk-track';

export async function POST(request: NextRequest) {
  try {
    const { weekStart } = await request.json();

    if (!weekStart) {
      return errorResponse('weekStart is required', 'MISSING_PARAMETER', 400);
    }

    const supabase = createServerClient();

    // Fetch current week data
    const { data: weekData, error: weekError } = await supabase
      .from('weekly_summary')
      .select('*')
      .eq('week_start', weekStart)
      .single();

    if (weekError || !weekData) {
      return errorResponse('Week data not found', 'WEEK_NOT_FOUND', 404);
    }

    // Fetch previous week data
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0];

    const { data: prevWeekData } = await supabase
      .from('weekly_summary')
      .select('*')
      .eq('week_start', prevWeekStartStr)
      .single();

    // Fetch sport breakdown for current week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const { data: sportData, error: sportError } = await supabase
      .from('daily_metrics')
      .select('sport, tickets_sold, gtv')
      .eq('source', 'reconciled')
      .gte('metric_date', weekStart)
      .lte('metric_date', weekEndStr);

    if (sportError) {
      return errorResponse('Failed to fetch sport data', 'SPORT_DATA_ERROR', 500);
    }

    // Aggregate sport breakdown
    const sportMap = new Map<string, { tickets: number; gtv: number }>();
    let totalTickets = 0;

    sportData?.forEach((row) => {
      const sport = row.sport || 'Unknown';
      const tickets = row.tickets_sold || 0;
      const gtv = row.gtv || 0;

      totalTickets += tickets;

      if (sportMap.has(sport)) {
        const existing = sportMap.get(sport)!;
        sportMap.set(sport, {
          tickets: existing.tickets + tickets,
          gtv: existing.gtv + gtv,
        });
      } else {
        sportMap.set(sport, { tickets, gtv });
      }
    });

    const sportBreakdown: SportBreakdown[] = Array.from(sportMap.entries())
      .map(([sport, data]) => ({
        sport,
        tickets: data.tickets,
        gtv: data.gtv,
        percentOfTotal: totalTickets > 0 ? (data.tickets / totalTickets) * 100 : 0,
      }))
      .sort((a, b) => b.gtv - a.gtv);

    // Fetch top 5 events by GTV
    const { data: topEventsData, error: topEventsError } = await supabase
      .from('daily_metrics')
      .select('sport, event_name, gtv')
      .eq('source', 'reconciled')
      .gte('metric_date', weekStart)
      .lte('metric_date', weekEndStr)
      .order('gtv', { ascending: false })
      .limit(5);

    if (topEventsError) {
      return errorResponse('Failed to fetch top events', 'TOP_EVENTS_ERROR', 500);
    }

    const topEvents: TopEvent[] = topEventsData?.map((e) => ({
      sport: e.sport || 'Unknown',
      eventName: e.event_name || 'Unknown Event',
      gtv: e.gtv || 0,
    })) || [];

    // Generate talk track
    const currentWeek: WeekData = {
      weekStart: weekData.week_start,
      totalTickets: weekData.total_tickets || 0,
      totalOrders: weekData.total_orders || 0,
      totalGtv: weekData.total_gtv || 0,
      totalFaceValue: weekData.total_face_value || 0,
      totalGrossProfit: weekData.total_gross_profit || 0,
    };

    const previousWeek: WeekData | null = prevWeekData ? {
      weekStart: prevWeekData.week_start,
      totalTickets: prevWeekData.total_tickets || 0,
      totalOrders: prevWeekData.total_orders || 0,
      totalGtv: prevWeekData.total_gtv || 0,
      totalFaceValue: prevWeekData.total_face_value || 0,
      totalGrossProfit: prevWeekData.total_gross_profit || 0,
    } : null;

    const talkTrack = await generateTalkTrack(
      currentWeek,
      previousWeek,
      sportBreakdown,
      topEvents
    );

    return successResponse({ talkTrack });
  } catch (error) {
    console.error('Talk track generation error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to generate talk track',
      'GENERATION_ERROR',
      500
    );
  }
}
```

### Talk Track Download Component

```typescript
// src/components/talk-track-download.tsx
'use client';

import { useState } from 'react';

interface TalkTrackDownloadProps {
  weekStart: string; // ISO date string
}

export function TalkTrackDownload({ weekStart }: TalkTrackDownloadProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/export/talk-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Failed to generate talk track');
      }

      // Create text file and download
      const blob = new Blob([result.data.talkTrack], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `talk-track-week-${weekStart}.txt`;
      link.href = url;
      link.click();

      // Clean up
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Talk track download error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate talk track');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleDownload}
        disabled={isGenerating}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 flex items-center gap-2"
      >
        {isGenerating ? (
          <>
            <span className="animate-spin">⏳</span>
            Generating...
          </>
        ) : (
          <>
            <span>🎤</span>
            Download Talk Track
          </>
        )}
      </button>
      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Prompt Engineering Guidelines

**Narrative prompt (2-4 sentences):**
- Focus on headline metrics (tickets, GTV)
- Note WoW trend direction (up/down) and magnitude
- Provide context only if change is significant (>20% swing)
- Keep tone professional but conversational
- No markdown formatting

**Talk track prompt (10-15 sentences):**
- Structure: Headline → KPIs → Drivers → Context → Forward-looking
- Include specific numbers (WoW deltas, top sports, marquee events)
- Analyze key drivers (sport mix, events, demand shifts, inventory)
- Write for verbal delivery (conversational, confident tone)
- No markdown or section headers in output

**Historical context:**
- Always include previous week data for comparison
- Compare sport mix changes (e.g., "Football shifted from 40% to 55% of tickets")
- Identify marquee events driving outsized GTV
- Note inventory gaps if certain sports underperformed

### Error Handling

**Common failure scenarios:**
1. **Missing API key** - Check environment variable is set
2. **API rate limit** - Claude API has rate limits (100 requests/min on paid tier)
3. **Invalid response** - Claude returns non-text content (rare)
4. **Network timeout** - Long prompt or API slowness

**Solutions:**
- Validate `ANTHROPIC_API_KEY` exists before API call
- Implement retry logic for transient errors (use existing retry wrapper from Story 1.2)
- Surface clear error messages to user (not technical API errors)
- Set reasonable timeout (30 seconds max)

### Testing Checklist

- [ ] Narrative generation produces 2-4 sentence summaries
- [ ] Talk track includes all required sections (headline, KPIs, drivers, context, forward-looking)
- [ ] Key drivers analysis identifies meaningful insights (sport mix, events, trends)
- [ ] WoW deltas calculate correctly and display with +/- signs
- [ ] Historical context improves analysis quality (test with/without prior week data)
- [ ] Download button shows loading state during API call
- [ ] Error messages display clearly if generation fails
- [ ] Text file downloads with correct filename format
- [ ] Content quality matches manually written WBR scripts

### References

- [Source: {output_folder}/planning-artifacts/prd.md#FR16-FR21: AI talk track generation]
- [Source: {output_folder}/planning-artifacts/architecture.md#Export & AI Generation]
- [Source: {output_folder}/planning-artifacts/epics.md#Story 3.2: AI Narrative & Talk Track Generation]
- [Anthropic API documentation](https://docs.anthropic.com/en/api/messages)
- [Claude model pricing](https://www.anthropic.com/pricing)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- All 107 tests passing (17 test files)
- ESLint clean on all new/modified files

### Completion Notes List
- [x] @anthropic-ai/sdk v0.92.0 installed; ANTHROPIC_API_KEY already in .env.example (server-only)
- [x] narrative.ts: generates 2-4 sentence email summary via Claude Sonnet 4 (max_tokens: 300)
- [x] talk-track.ts: generates full WBR script with headline, KPIs, drivers, context, forward-looking (max_tokens: 1500)
- [x] Both utilities include WoW delta calculations and handle null prev week
- [x] API route fetches week data, sport breakdown, top events from Supabase, calls generateTalkTrack
- [x] TalkTrackDownload button: loading state, error display, auto-downloads .txt file
- [x] narrative.ts is exported for reuse by Story 4.1 (email)
- [x] Prompts include sport mix and top events for key drivers analysis

### File List
- src/lib/ai/narrative.ts (new)
- src/lib/ai/narrative.test.ts (new)
- src/lib/ai/talk-track.ts (new)
- src/lib/ai/talk-track.test.ts (new)
- src/app/api/export/talk-track/route.ts (new)
- src/components/talk-track-download.tsx (new)
- src/components/talk-track-download.test.tsx (new)
- src/app/page.tsx (updated - added TalkTrackDownload button)
- package.json (updated - added @anthropic-ai/sdk)
- pnpm-lock.yaml (updated)
