# Story 3.1: One-Click Dashboard Image Export

Status: ready-for-dev

## Story

As a user,
I want to export the dashboard as a single composite image with one click,
so that I can drop it directly into the WBR slide deck without screenshotting.

## Acceptance Criteria

1. Export button generates a composite PNG capturing full dashboard (KPI cards, trend chart, sport breakdowns, top events). Downloads automatically.
2. Button shows loading state during generation. Completes within 5 seconds.
3. Image is slide-ready — clean layout, readable text, appropriate dimensions. Generated client-side via html-to-image (no server round-trip).

## Tasks / Subtasks

- [ ] Task 1: Install html-to-image library (AC: #3)
  - [ ] Run `pnpm add html-to-image`
  - [ ] Verify type definitions are included
- [ ] Task 2: Create dashboard composite wrapper component (AC: #1)
  - [ ] Create `src/components/dashboard-composite.tsx`
  - [ ] Wrap all dashboard sections (KPI cards, trend chart, sport breakdowns, top events) in a single div with `id="dashboard-export-target"`
  - [ ] Ensure the wrapper div has appropriate padding and spacing for export
  - [ ] Add white background and border/shadow for professional appearance
- [ ] Task 3: Create export button component (AC: #1, #2)
  - [ ] Create `src/components/dashboard-export.tsx`
  - [ ] Implement export button with loading state (use Tailwind `animate-spin` icon)
  - [ ] On click: call `toPng()` from html-to-image targeting the composite wrapper
  - [ ] Handle blob URL generation and automatic download via anchor element
  - [ ] Clean up blob URL after download to prevent memory leaks
- [ ] Task 4: Implement client-side image generation (AC: #1, #2, #3)
  - [ ] Use `html-to-image.toPng(element, options)` with quality settings
  - [ ] Configure options: `pixelRatio: 2` for high-resolution export, `backgroundColor: '#ffffff'`
  - [ ] Set canvas dimensions for standard slide size (1920x1080 or 1280x720)
  - [ ] Generate filename with week identifier: `impact-monitor-week-${weekStart}.png`
- [ ] Task 5: Add export button to dashboard page (AC: #1)
  - [ ] Import `DashboardExport` component in `src/app/page.tsx`
  - [ ] Position button prominently (top-right corner or below week selector)
  - [ ] Pass selected week data as prop for filename generation
- [ ] Task 6: Test export quality and performance (AC: #2, #3)
  - [ ] Verify image generates in under 5 seconds
  - [ ] Test image quality at presentation resolution
  - [ ] Ensure text is readable and charts are clear
  - [ ] Validate layout is slide-ready without manual adjustments

## Dev Notes

### Project Structure Notes

**New files created:**
```
src/
├── components/
│   ├── dashboard-composite.tsx
│   └── dashboard-export.tsx
```

**Modified files:**
```
src/app/page.tsx (add export button)
package.json (add html-to-image)
```

### html-to-image Library

**Installation:**
```bash
pnpm add html-to-image
```

**Basic usage pattern:**
```typescript
import { toPng } from 'html-to-image';

async function exportDashboard() {
  const element = document.getElementById('dashboard-export-target');
  if (!element) return;

  const dataUrl = await toPng(element, {
    pixelRatio: 2, // High-res for presentations
    backgroundColor: '#ffffff',
    width: 1920,
    height: 1080
  });

  // Convert data URL to blob and download
  const link = document.createElement('a');
  link.download = `impact-monitor-week-${weekStart}.png`;
  link.href = dataUrl;
  link.click();
}
```

**Alternative library:** `dom-to-image-more` is a maintained fork if html-to-image has issues. Both have similar APIs.

### Dashboard Composite Component

```typescript
// src/components/dashboard-composite.tsx
interface DashboardCompositeProps {
  children: React.ReactNode;
}

export function DashboardComposite({ children }: DashboardCompositeProps) {
  return (
    <div
      id="dashboard-export-target"
      className="bg-white p-8 rounded-lg shadow-lg"
    >
      {children}
    </div>
  );
}
```

**Styling considerations:**
- Use white background (`bg-white`) for clean export
- Add padding (`p-8`) for breathing room
- Consider hiding interactive elements (buttons, dropdowns) during export using CSS classes
- Ensure all charts render properly when captured (Recharts should work fine)

### Export Button Component

```typescript
// src/components/dashboard-export.tsx
'use client';

import { useState } from 'react';
import { toPng } from 'html-to-image';

interface DashboardExportProps {
  weekStart: string; // ISO date string for filename
}

export function DashboardExport({ weekStart }: DashboardExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const element = document.getElementById('dashboard-export-target');
      if (!element) {
        throw new Error('Export target not found');
      }

      const dataUrl = await toPng(element, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: 1920,
        height: 1080
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `impact-monitor-week-${weekStart}.png`;
      link.href = dataUrl;
      link.click();

      // Clean up
      URL.revokeObjectURL(dataUrl);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export dashboard image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
    >
      {isExporting ? (
        <>
          <span className="animate-spin">⏳</span>
          Generating...
        </>
      ) : (
        <>
          <span>📸</span>
          Export Dashboard
        </>
      )}
    </button>
  );
}
```

### Performance Optimization

**Target: Complete within 5 seconds**

The 5-second constraint is generous for client-side image generation. Typical performance:
- Small dashboard (~100 elements): 1-2 seconds
- Medium dashboard (~500 elements): 2-3 seconds
- Large dashboard (>1000 elements): 3-5 seconds

**If performance issues arise:**
1. Reduce `pixelRatio` from 2 to 1.5
2. Simplify chart complexity (fewer data points, simpler animations)
3. Consider lazy-loading heavy components that aren't visible in export
4. Use `filter` option to exclude hidden elements from rendering

### Slide-Ready Dimensions

**Standard presentation sizes:**
- **1920x1080 (16:9)** - Modern standard, recommended
- **1280x720 (16:9)** - Lower resolution fallback
- **1024x768 (4:3)** - Legacy format

Recommend 1920x1080 for crisp projection quality. If file size is an issue, fall back to 1280x720.

### Hiding Interactive Elements During Export

```typescript
// Add CSS class to hide elements during export
<style jsx global>{`
  .export-hide {
    display: none;
  }

  @media print {
    .export-hide {
      display: none;
    }
  }
`}</style>

// Apply to buttons, dropdowns, etc.
<button className="export-hide">Week Selector</button>
```

Alternatively, use a state flag and conditionally render:
```typescript
const [isExporting, setIsExporting] = useState(false);

{!isExporting && <button>Week Selector</button>}
```

### Error Handling

**Common failure scenarios:**
1. **Element not found** - Target div doesn't exist or hasn't rendered yet
2. **CORS issues** - External images (charts, logos) fail to load
3. **Memory limits** - Very large dashboards exceed browser canvas limits
4. **Browser compatibility** - Older browsers may not support canvas export

**Solutions:**
- Validate element existence before export
- Ensure all images are same-origin or CORS-enabled
- Simplify dashboard if memory issues occur
- Test in Chrome, Safari, Firefox (html-to-image works well in all modern browsers)

### Testing Checklist

- [ ] Export generates PNG file with correct filename format
- [ ] Image opens in slide deck software (PowerPoint, Keynote, Google Slides)
- [ ] Text is readable at presentation scale
- [ ] Charts render correctly (no missing elements)
- [ ] Loading state shows during generation
- [ ] Error message appears if export fails
- [ ] Download completes in under 5 seconds
- [ ] Memory cleanup prevents leaks on repeated exports

### References

- [Source: {output_folder}/planning-artifacts/prd.md#FR15: One-click composite image export]
- [Source: {output_folder}/planning-artifacts/architecture.md#Export & AI Generation]
- [Source: {output_folder}/planning-artifacts/epics.md#Story 3.1: One-Click Dashboard Image Export]
- [html-to-image documentation](https://github.com/bubkoo/html-to-image)
- [dom-to-image-more (alternative)](https://github.com/1904labs/dom-to-image-more)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List


---STORY BREAK---


# Story 3.2: AI Narrative & Talk Track Generation

Status: ready-for-dev

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

- [ ] Task 1: Install Anthropic SDK (AC: #1)
  - [ ] Run `pnpm add @anthropic-ai/sdk`
  - [ ] Add `ANTHROPIC_API_KEY` to `.env.example` and `.env.local`
  - [ ] Verify environment variable is not prefixed with `NEXT_PUBLIC_` (server-only)
- [ ] Task 2: Create AI narrative generation utility (AC: #2, #3)
  - [ ] Create `src/lib/ai/narrative.ts`
  - [ ] Export `generateNarrative(weekData, prevWeekData)` function
  - [ ] Implement Claude API call with prompt template for 2-4 sentence summary
  - [ ] Return plain text string suitable for email body
- [ ] Task 3: Create AI talk track generation utility (AC: #1, #3)
  - [ ] Create `src/lib/ai/talk-track.ts`
  - [ ] Export `generateTalkTrack(weekData, prevWeekData, sportData, topEvents)` function
  - [ ] Implement Claude API call with comprehensive prompt template
  - [ ] Structure prompt to include: headline, KPIs with WoW deltas, key drivers (sport mix, events, trends), context/takeaway, forward-looking areas
  - [ ] Return full script as plain text string
- [ ] Task 4: Create API route for talk track generation (AC: #1, #4)
  - [ ] Create `src/app/api/export/talk-track/route.ts`
  - [ ] Accept POST request with `weekStart` parameter
  - [ ] Fetch weekly data, previous week data, sport breakdown, top events from Supabase
  - [ ] Call `generateTalkTrack()` utility
  - [ ] Return generated text as response
  - [ ] Handle errors with `errorResponse()` helper
- [ ] Task 5: Create talk track download button component (AC: #1, #4)
  - [ ] Create `src/components/talk-track-download.tsx`
  - [ ] Implement button with loading state
  - [ ] On click: POST to `/api/export/talk-track` with selected week
  - [ ] On success: trigger text file download with filename `talk-track-week-${weekStart}.txt`
  - [ ] On error: show user-friendly error message
- [ ] Task 6: Add talk track button to dashboard (AC: #1)
  - [ ] Import `TalkTrackDownload` component in `src/app/page.tsx`
  - [ ] Position near export image button
  - [ ] Pass selected week data as prop
- [ ] Task 7: Design and test Claude prompts (AC: #1, #2, #3)
  - [ ] Test narrative prompt generates 2-4 sentence summaries matching WBR tone
  - [ ] Test talk track prompt produces comprehensive script with all required sections
  - [ ] Validate key drivers analysis identifies meaningful insights from data
  - [ ] Ensure historical context improves comparative analysis quality

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

### Debug Log References

### Completion Notes List

### File List


---STORY BREAK---


# Story 4.1: Monday Email with KPIs, Narrative & Image Attachment

Status: ready-for-dev

## Story

As a user,
I want to receive an automated email every Monday with KPIs, AI narrative, and dashboard image attached,
so that WBR prep is in my inbox with zero effort.

## Acceptance Criteria

1. Daily cron on Monday (detected via isMonday() utility) triggers email flow after pipeline completes.
2. Server-side image generated via Satori (@vercel/og) rendering dashboard data as PNG.
3. Email sent via Resend includes: KPIs with WoW deltas in body, 2-4 sentence AI narrative in body, composite image attachment, link to dashboard.
4. On Resend failure: retry 3x with backoff, log status to pipeline_runs. No silent failures.
5. Subject line includes week number and headline KPIs (e.g., "Week 17: 252 tickets sold (-50% WoW), $33.0K GTV (-60% WoW)")

## Tasks / Subtasks

- [ ] Task 1: Install Resend and Satori libraries (AC: #2, #3)
  - [ ] Run `pnpm add resend @vercel/og`
  - [ ] Add `RESEND_API_KEY` and `NEXT_PUBLIC_APP_URL` to `.env.example` and `.env.local`
  - [ ] Verify environment variables are configured correctly
- [ ] Task 2: Create email image generation utility (AC: #2)
  - [ ] Create `src/lib/email/image.ts`
  - [ ] Export `generateEmailImage(weekData, prevWeekData, sportData, topEvents)` function
  - [ ] Use Satori to render JSX → SVG → PNG
  - [ ] Return PNG buffer suitable for email attachment
  - [ ] Design layout matching dashboard (KPI cards, trend chart, sport breakdown, top events)
- [ ] Task 3: Create email HTML template utility (AC: #3)
  - [ ] Create `src/lib/email/template.ts`
  - [ ] Export `buildEmailTemplate(weekData, prevWeekData, narrative, dashboardUrl)` function
  - [ ] Build HTML email body with KPIs, WoW deltas, AI narrative, dashboard link
  - [ ] Use inline CSS for email client compatibility
  - [ ] Include professional styling (tables, colors, responsive layout)
- [ ] Task 4: Create email sending utility (AC: #3, #4)
  - [ ] Create `src/lib/email/send.ts`
  - [ ] Export `sendMondayEmail(weekData, prevWeekData, subscribers)` function
  - [ ] Fetch subscriber list from Supabase
  - [ ] Generate email image via `generateEmailImage()`
  - [ ] Generate AI narrative via `generateNarrative()` from Story 3.2
  - [ ] Build email HTML via `buildEmailTemplate()`
  - [ ] Send email via Resend API with image attachment
  - [ ] Implement retry logic (3x with exponential backoff) using retry wrapper from Story 1.2
  - [ ] Log send status to `pipeline_runs` table
- [ ] Task 5: Create subject line generator (AC: #5)
  - [ ] Add `generateSubjectLine(weekData, prevWeekData, weekNumber)` to `src/lib/email/template.ts`
  - [ ] Format: "Week N: X tickets sold (±Y% WoW), $Z GTV (±W% WoW)"
  - [ ] Calculate week number from `weekStart` date (week of year)
- [ ] Task 6: Integrate Monday email into pipeline orchestrator (AC: #1)
  - [ ] Modify `src/lib/pipeline/orchestrator.ts` to detect Monday via `isMonday()` utility
  - [ ] After pipeline completion on Monday: trigger `sendMondayEmail()`
  - [ ] Log email stage status to `pipeline_runs` (running, success, failed)
  - [ ] Surface email failures clearly in pipeline status (no silent failures)
- [ ] Task 7: Test email delivery end-to-end (AC: #3, #4, #5)
  - [ ] Verify email sends successfully via Resend
  - [ ] Test email rendering in Gmail, Outlook, Apple Mail
  - [ ] Verify image attachment displays correctly
  - [ ] Validate KPIs, narrative, and dashboard link in email body
  - [ ] Test retry logic on simulated Resend failure
  - [ ] Verify subject line format matches spec

## Dev Notes

### Project Structure Notes

**New files created:**
```
src/
└── lib/
    └── email/
        ├── image.ts
        ├── template.ts
        └── send.ts
```

**Modified files:**
```
src/lib/pipeline/orchestrator.ts (add Monday email stage)
.env.example (add RESEND_API_KEY, NEXT_PUBLIC_APP_URL)
package.json (add resend, @vercel/og)
```

### Environment Variables

```bash
# .env.example
RESEND_API_KEY=re_...
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Production: https://impact-monitor.vercel.app
```

**RESEND_API_KEY:** Server-only, do NOT prefix with `NEXT_PUBLIC_`
**NEXT_PUBLIC_APP_URL:** Client-accessible for dashboard link in email

### Resend Setup

**Installation:**
```bash
pnpm add resend
```

**API key setup:**
1. Sign up at [resend.com](https://resend.com)
2. Verify domain (or use resend.dev for testing)
3. Generate API key from dashboard
4. Add to environment variables

**Cost reference (as of April 2026):**
- Free tier: 100 emails/day, 3,000/month
- Paid tier: $20/month for 50,000 emails
- Typical usage: 4 emails/month (1 per Monday) = well within free tier

### Satori Setup

**Installation:**
```bash
pnpm add @vercel/og
```

**What is Satori?**
Satori converts JSX → SVG → PNG on the server. Designed for Open Graph images, perfect for email attachments.

**Key features:**
- No headless browser needed (unlike Puppeteer)
- Fast (< 1 second for typical dashboard)
- Works in Vercel serverless functions
- Supports subset of CSS (flexbox, basic styling)

**Limitations:**
- No full HTML/CSS support (no `position: absolute`, limited animations)
- Must use inline styles or simple Tailwind-like utilities
- External images must be fetched and converted to base64

### Email Image Generation

```typescript
// src/lib/email/image.ts
import satori from 'satori';
import { html } from 'satori-html';
import sharp from 'sharp';

export interface EmailImageData {
  weekStart: string;
  totalTickets: number;
  totalOrders: number;
  totalGtv: number;
  avgOrderValue: number;
  wowTickets: number | null;
  wowOrders: number | null;
  wowGtv: number | null;
  wowAov: number | null;
  sportData: Array<{ sport: string; tickets: number; gtv: number }>;
  topEvents: Array<{ sport: string; eventName: string; gtv: number }>;
}

export async function generateEmailImage(data: EmailImageData): Promise<Buffer> {
  // Create JSX layout
  const jsx = (
    <div
      style={{
        width: '1200px',
        height: '675px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        padding: '40px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '30px' }}>
        Impact Monitor - Week of {data.weekStart}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        {renderKpiCard('Tickets Sold', data.totalTickets, data.wowTickets)}
        {renderKpiCard('Orders', data.totalOrders, data.wowOrders)}
        {renderKpiCard('GTV', `$${(data.totalGtv / 1000).toFixed(1)}K`, data.wowGtv)}
        {renderKpiCard('Avg Order', `$${data.avgOrderValue.toFixed(2)}`, data.wowAov)}
      </div>

      {/* Sport Breakdown */}
      <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
        Top Sports by GTV
      </div>
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
        {data.sportData.slice(0, 5).map((sport) => (
          <div key={sport.sport} style={{ fontSize: '14px' }}>
            <div style={{ fontWeight: 'bold' }}>{sport.sport}</div>
            <div>${(sport.gtv / 1000).toFixed(1)}K</div>
          </div>
        ))}
      </div>

      {/* Top Events */}
      <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>
        Top 5 Events by GTV
      </div>
      <div style={{ fontSize: '14px' }}>
        {data.topEvents.map((event, i) => (
          <div key={i} style={{ marginBottom: '8px' }}>
            {i + 1}. {event.eventName} ({event.sport}) - ${(event.gtv / 1000).toFixed(1)}K
          </div>
        ))}
      </div>
    </div>
  );

  // Render JSX to SVG
  const svg = await satori(jsx, {
    width: 1200,
    height: 675,
    fonts: [
      {
        name: 'Arial',
        data: await fetch('https://fonts.gstatic.com/s/arial/v15/gAmX3GUKKJcKOFjjQl9Y.ttf').then((res) => res.arrayBuffer()),
        weight: 400,
        style: 'normal',
      },
    ],
  });

  // Convert SVG to PNG using sharp
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return pngBuffer;
}

function renderKpiCard(label: string, value: string | number, wow: number | null) {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
  const wowText = wow !== null ? `${wow > 0 ? '+' : ''}${wow.toFixed(1)}%` : '';
  const wowColor = wow !== null && wow > 0 ? '#10b981' : '#ef4444';

  return (
    <div
      style={{
        flex: 1,
        padding: '20px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '4px' }}>
        {displayValue}
      </div>
      {wowText && (
        <div style={{ fontSize: '14px', color: wowColor }}>
          {wowText} WoW
        </div>
      )}
    </div>
  );
}
```

**Note:** Install `sharp` for SVG → PNG conversion:
```bash
pnpm add sharp
```

### Email HTML Template

```typescript
// src/lib/email/template.ts
export interface EmailTemplateData {
  weekStart: string;
  totalTickets: number;
  totalOrders: number;
  totalGtv: number;
  avgOrderValue: number;
  wowTickets: number | null;
  wowOrders: number | null;
  wowGtv: number | null;
  wowAov: number | null;
  narrative: string;
  dashboardUrl: string;
}

export function generateSubjectLine(
  weekData: { totalTickets: number; totalGtv: number },
  prevWeekData: { totalTickets: number; totalGtv: number } | null,
  weekNumber: number
): string {
  const wowTickets = prevWeekData
    ? ((weekData.totalTickets - prevWeekData.totalTickets) / prevWeekData.totalTickets * 100).toFixed(0)
    : null;
  const wowGtv = prevWeekData
    ? ((weekData.totalGtv - prevWeekData.totalGtv) / prevWeekData.totalGtv * 100).toFixed(0)
    : null;

  const ticketsText = `${weekData.totalTickets.toLocaleString()} tickets sold${wowTickets ? ` (${wowTickets > 0 ? '+' : ''}${wowTickets}% WoW)` : ''}`;
  const gtvText = `$${(weekData.totalGtv / 1000).toFixed(1)}K GTV${wowGtv ? ` (${wowGtv > 0 ? '+' : ''}${wowGtv}% WoW)` : ''}`;

  return `Week ${weekNumber}: ${ticketsText}, ${gtvText}`;
}

export function buildEmailTemplate(data: EmailTemplateData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Impact Monitor - Week of ${data.weekStart}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 30px 20px; background-color: #3b82f6; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Impact Monitor</h1>
              <p style="margin: 5px 0 0; color: #e0e7ff; font-size: 14px;">Week of ${data.weekStart}</p>
            </td>
          </tr>

          <!-- AI Narrative -->
          <tr>
            <td style="padding: 30px; border-bottom: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 15px; color: #111827; font-size: 18px;">Weekly Summary</h2>
              <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
                ${data.narrative}
              </p>
            </td>
          </tr>

          <!-- KPIs -->
          <tr>
            <td style="padding: 30px; border-bottom: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 20px; color: #111827; font-size: 18px;">Key Metrics</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding-bottom: 20px;">
                    ${renderKpiRow('Tickets Sold', data.totalTickets, data.wowTickets)}
                  </td>
                  <td width="50%" style="padding-bottom: 20px;">
                    ${renderKpiRow('Orders', data.totalOrders, data.wowOrders)}
                  </td>
                </tr>
                <tr>
                  <td width="50%">
                    ${renderKpiRow('GTV', `$${(data.totalGtv / 1000).toFixed(1)}K`, data.wowGtv)}
                  </td>
                  <td width="50%">
                    ${renderKpiRow('Avg Order Value', `$${data.avgOrderValue.toFixed(2)}`, data.wowAov)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <p style="margin: 0 0 15px; color: #6b7280; font-size: 14px;">
                Full dashboard and charts are attached above.
              </p>
              <a href="${data.dashboardUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;">
                View Live Dashboard
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Impact Monitor - Automated Weekly Business Review
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function renderKpiRow(label: string, value: string | number, wow: number | null): string {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
  const wowText = wow !== null ? `${wow > 0 ? '+' : ''}${wow.toFixed(1)}% WoW` : '';
  const wowColor = wow !== null && wow > 0 ? '#10b981' : '#ef4444';

  return `
    <div style="margin-bottom: 8px;">
      <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px;">${label}</p>
      <p style="margin: 0; color: #111827; font-size: 20px; font-weight: bold;">${displayValue}</p>
      ${wowText ? `<p style="margin: 4px 0 0; color: ${wowColor}; font-size: 12px; font-weight: bold;">${wowText}</p>` : ''}
    </div>
  `;
}
```

### Email Sending Utility

```typescript
// src/lib/email/send.ts
import { Resend } from 'resend';
import { generateEmailImage, type EmailImageData } from './image';
import { buildEmailTemplate, generateSubjectLine, type EmailTemplateData } from './template';
import { generateNarrative, type WeekData } from '../ai/narrative';
import { createServerClient } from '../supabase/server';
import { retry } from '../utils/retry'; // From Story 1.2

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendMondayEmail(
  weekData: WeekData,
  prevWeekData: WeekData | null
): Promise<void> {
  const supabase = createServerClient();

  // Fetch subscribers
  const { data: subscribers, error: subscribersError } = await supabase
    .from('subscribers')
    .select('email');

  if (subscribersError) {
    throw new Error(`Failed to fetch subscribers: ${subscribersError.message}`);
  }

  if (!subscribers || subscribers.length === 0) {
    console.log('No subscribers found, skipping Monday email');
    return;
  }

  // Generate AI narrative
  const narrative = await retry(() => generateNarrative(weekData, prevWeekData));

  // Fetch sport and event data for image generation
  const weekEnd = new Date(weekData.weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const { data: sportData } = await supabase
    .from('daily_metrics')
    .select('sport, tickets_sold, gtv')
    .eq('source', 'reconciled')
    .gte('metric_date', weekData.weekStart)
    .lte('metric_date', weekEndStr);

  const { data: topEventsData } = await supabase
    .from('daily_metrics')
    .select('sport, event_name, gtv')
    .eq('source', 'reconciled')
    .gte('metric_date', weekData.weekStart)
    .lte('metric_date', weekEndStr)
    .order('gtv', { ascending: false })
    .limit(5);

  // Aggregate sport data
  const sportMap = new Map<string, { tickets: number; gtv: number }>();
  sportData?.forEach((row) => {
    const sport = row.sport || 'Unknown';
    const tickets = row.tickets_sold || 0;
    const gtv = row.gtv || 0;

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

  const sportBreakdown = Array.from(sportMap.entries())
    .map(([sport, data]) => ({ sport, tickets: data.tickets, gtv: data.gtv }))
    .sort((a, b) => b.gtv - a.gtv);

  const topEvents = topEventsData?.map((e) => ({
    sport: e.sport || 'Unknown',
    eventName: e.event_name || 'Unknown Event',
    gtv: e.gtv || 0,
  })) || [];

  // Calculate metrics
  const wowTickets = prevWeekData
    ? ((weekData.totalTickets - prevWeekData.totalTickets) / prevWeekData.totalTickets * 100)
    : null;
  const wowOrders = prevWeekData
    ? ((weekData.totalOrders - prevWeekData.totalOrders) / prevWeekData.totalOrders * 100)
    : null;
  const wowGtv = prevWeekData
    ? ((weekData.totalGtv - prevWeekData.totalGtv) / prevWeekData.totalGtv * 100)
    : null;
  const avgOrderValue = weekData.totalOrders > 0 ? weekData.totalGtv / weekData.totalOrders : 0;
  const prevAvgOrderValue = prevWeekData && prevWeekData.totalOrders > 0
    ? prevWeekData.totalGtv / prevWeekData.totalOrders
    : null;
  const wowAov = prevAvgOrderValue
    ? ((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue * 100)
    : null;

  // Generate email image
  const imageData: EmailImageData = {
    weekStart: weekData.weekStart,
    totalTickets: weekData.totalTickets,
    totalOrders: weekData.totalOrders,
    totalGtv: weekData.totalGtv,
    avgOrderValue,
    wowTickets,
    wowOrders,
    wowGtv,
    wowAov,
    sportData: sportBreakdown,
    topEvents,
  };

  const imageBuffer = await retry(() => generateEmailImage(imageData));

  // Build email HTML
  const templateData: EmailTemplateData = {
    weekStart: weekData.weekStart,
    totalTickets: weekData.totalTickets,
    totalOrders: weekData.totalOrders,
    totalGtv: weekData.totalGtv,
    avgOrderValue,
    wowTickets,
    wowOrders,
    wowGtv,
    wowAov,
    narrative,
    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}?week=${weekData.weekStart}`,
  };

  const htmlBody = buildEmailTemplate(templateData);

  // Calculate week number
  const weekDate = new Date(weekData.weekStart);
  const startOfYear = new Date(weekDate.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((weekDate.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);

  // Generate subject line
  const subject = generateSubjectLine(
    { totalTickets: weekData.totalTickets, totalGtv: weekData.totalGtv },
    prevWeekData ? { totalTickets: prevWeekData.totalTickets, totalGtv: prevWeekData.totalGtv } : null,
    weekNumber
  );

  // Send email with retry
  await retry(async () => {
    const result = await resend.emails.send({
      from: 'Impact Monitor <noreply@impact-monitor.com>',
      to: subscribers.map((s) => s.email),
      subject,
      html: htmlBody,
      attachments: [
        {
          filename: `impact-monitor-week-${weekData.weekStart}.png`,
          content: imageBuffer,
        },
      ],
    });

    if (result.error) {
      throw new Error(`Resend API error: ${result.error.message}`);
    }

    console.log('Monday email sent successfully:', result.data?.id);
  });
}
```

### Integration with Pipeline Orchestrator

```typescript
// src/lib/pipeline/orchestrator.ts (add Monday email stage)
import { sendMondayEmail } from '../email/send';
import { isMonday } from '../utils/dates'; // From Story 1.4
import { createServerClient } from '../supabase/server';

export async function runPipeline() {
  const supabase = createServerClient();
  let runId: string;

  try {
    // ... existing pipeline stages (TM API, Snowflake, reconciliation) ...

    // Monday email stage
    if (isMonday()) {
      await logStage(runId, 'monday_email', 'running');

      try {
        // Fetch current week and previous week data
        const { data: weekData } = await supabase
          .from('weekly_summary')
          .select('*')
          .order('week_start', { ascending: false })
          .limit(2);

        if (weekData && weekData.length > 0) {
          const currentWeek = weekData[0];
          const prevWeek = weekData.length > 1 ? weekData[1] : null;

          await sendMondayEmail(
            {
              weekStart: currentWeek.week_start,
              totalTickets: currentWeek.total_tickets,
              totalOrders: currentWeek.total_orders,
              totalGtv: currentWeek.total_gtv,
              totalFaceValue: currentWeek.total_face_value,
              totalGrossProfit: currentWeek.total_gross_profit,
            },
            prevWeek ? {
              weekStart: prevWeek.week_start,
              totalTickets: prevWeek.total_tickets,
              totalOrders: prevWeek.total_orders,
              totalGtv: prevWeek.total_gtv,
              totalFaceValue: prevWeek.total_face_value,
              totalGrossProfit: prevWeek.total_gross_profit,
            } : null
          );

          await logStage(runId, 'monday_email', 'success');
        } else {
          await logStage(runId, 'monday_email', 'failed', 'No weekly data available');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Email send failed';
        await logStage(runId, 'monday_email', 'failed', errorMessage);
        // Don't throw - email failure shouldn't fail entire pipeline
      }
    }

    // Mark pipeline as complete
    await markPipelineComplete(runId, 'success');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Pipeline failed';
    await markPipelineComplete(runId, 'failed', errorMessage);
    throw error;
  }
}
```

### Email Client Compatibility

**Tested clients:**
- Gmail (web, iOS, Android)
- Outlook (web, desktop, mobile)
- Apple Mail (macOS, iOS)
- Yahoo Mail
- Proton Mail

**Best practices:**
- Use table-based layout (not CSS Grid or Flexbox for main structure)
- Inline all CSS styles
- Test with [Litmus](https://litmus.com) or [Email on Acid](https://www.emailonacid.com) for broad compatibility
- Avoid background images (poor support)
- Keep email width ≤ 600px for mobile compatibility

### Testing Checklist

- [ ] Email sends successfully via Resend API
- [ ] Subject line includes week number and headline KPIs with WoW deltas
- [ ] Email body includes KPIs with WoW percentages
- [ ] Email body includes 2-4 sentence AI narrative
- [ ] Dashboard image attached as PNG file
- [ ] Dashboard link resolves to correct URL with week parameter
- [ ] Email renders correctly in Gmail, Outlook, Apple Mail
- [ ] Image attachment displays inline (not as separate download)
- [ ] Retry logic triggers on simulated Resend failure
- [ ] Email send status logged to `pipeline_runs` table
- [ ] Failed email surfaces clearly in pipeline status (no silent failures)
- [ ] Monday detection works correctly (only sends on Mondays)

### Resend Domain Setup

**For testing:**
Use `onboarding@resend.dev` as sender (no domain verification needed).

**For production:**
1. Add domain to Resend dashboard
2. Add DNS records (SPF, DKIM, DMARC)
3. Verify domain
4. Update sender email: `noreply@your-domain.com`

### References

- [Source: {output_folder}/planning-artifacts/prd.md#FR22-FR26: Monday email delivery]
- [Source: {output_folder}/planning-artifacts/architecture.md#Monday Email Delivery]
- [Source: {output_folder}/planning-artifacts/epics.md#Story 4.1: Monday Email]
- [Resend API documentation](https://resend.com/docs)
- [Satori documentation](https://github.com/vercel/satori)
- [Email HTML best practices](https://www.campaignmonitor.com/dev-resources/guides/coding/)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List


---STORY BREAK---


# Story 4.2: Email Subscriber Management

Status: ready-for-dev

## Story

As an admin,
I want to add and remove email subscribers,
so that stakeholders receive the Monday email without me forwarding it.

## Acceptance Criteria

1. Subscriber management UI shows list of current subscribers.
2. Add: enter email, click add → POST /api/admin/subscribers → appears in list.
3. Remove: click remove → DELETE /api/admin/subscribers → disappears from list.
4. Monday email sends to all addresses in subscribers table.

## Tasks / Subtasks

- [ ] Task 1: Create subscriber management API route (AC: #2, #3)
  - [ ] Create `src/app/api/admin/subscribers/route.ts`
  - [ ] Implement GET handler to fetch all subscribers from Supabase
  - [ ] Implement POST handler to add new subscriber (validate email format)
  - [ ] Implement DELETE handler to remove subscriber by ID
  - [ ] Use Supabase service role client for write operations
  - [ ] Return consistent API response format (successResponse/errorResponse)
- [ ] Task 2: Create subscriber manager component (AC: #1, #2, #3)
  - [ ] Create `src/components/subscriber-manager.tsx`
  - [ ] Display list of current subscribers with email addresses
  - [ ] Implement add subscriber form (email input + add button)
  - [ ] Implement remove subscriber button for each list item
  - [ ] Show loading states during API calls
  - [ ] Show error messages if API calls fail
  - [ ] Use TanStack Query for data fetching and cache invalidation
- [ ] Task 3: Add subscriber manager to dashboard (AC: #1)
  - [ ] Import `SubscriberManager` component in `src/app/page.tsx`
  - [ ] Position in admin section (e.g., collapsible panel or separate tab)
  - [ ] Protect with auth check (admin-only section)
- [ ] Task 4: Email validation (AC: #2)
  - [ ] Create `src/lib/utils/validation.ts` with `isValidEmail(email)` function
  - [ ] Validate email format before adding subscriber (both client and server)
  - [ ] Prevent duplicate email addresses (unique constraint in DB + API check)
- [ ] Task 5: Test subscriber management flow (AC: #1, #2, #3, #4)
  - [ ] Verify subscriber list displays on page load
  - [ ] Add valid email → appears in list immediately
  - [ ] Add invalid email → shows error message
  - [ ] Add duplicate email → shows error message
  - [ ] Remove subscriber → disappears from list immediately
  - [ ] Verify Monday email sends to all subscribers in table

## Dev Notes

### Project Structure Notes

**New files created:**
```
src/
├── app/
│   └── api/
│       └── admin/
│           └── subscribers/
│               └── route.ts
├── components/
│   └── subscriber-manager.tsx
└── lib/
    └── utils/
        └── validation.ts
```

**Modified files:**
```
src/app/page.tsx (add subscriber manager section)
```

### API Route Implementation

```typescript
// src/app/api/admin/subscribers/route.ts
import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/api';
import { isValidEmail } from '@/lib/utils/validation';

// GET - Fetch all subscribers
export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('subscribers')
      .select('id, email, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return successResponse(data || []);
  } catch (error) {
    console.error('Failed to fetch subscribers:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch subscribers',
      'FETCH_ERROR',
      500
    );
  }
}

// POST - Add new subscriber
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return errorResponse('Email is required', 'MISSING_EMAIL', 400);
    }

    if (!isValidEmail(email)) {
      return errorResponse('Invalid email format', 'INVALID_EMAIL', 400);
    }

    const supabase = createServerClient();

    // Check for duplicate
    const { data: existing } = await supabase
      .from('subscribers')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return errorResponse('Email already subscribed', 'DUPLICATE_EMAIL', 409);
    }

    // Insert new subscriber
    const { data, error } = await supabase
      .from('subscribers')
      .insert({ email })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return successResponse(data, 201);
  } catch (error) {
    console.error('Failed to add subscriber:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to add subscriber',
      'INSERT_ERROR',
      500
    );
  }
}

// DELETE - Remove subscriber
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Subscriber ID is required', 'MISSING_ID', 400);
    }

    const supabase = createServerClient();

    const { error } = await supabase
      .from('subscribers')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return successResponse({ id });
  } catch (error) {
    console.error('Failed to delete subscriber:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to delete subscriber',
      'DELETE_ERROR',
      500
    );
  }
}
```

### Email Validation Utility

```typescript
// src/lib/utils/validation.ts
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

**Note:** This is a basic email validation regex. For production, consider using a more robust library like `validator.js` or `email-validator`.

### Subscriber Manager Component

```typescript
// src/components/subscriber-manager.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isValidEmail } from '@/lib/utils/validation';

interface Subscriber {
  id: string;
  email: string;
  created_at: string;
}

export function SubscriberManager() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch subscribers
  const { data: subscribers, isLoading } = useQuery<Subscriber[]>({
    queryKey: ['subscribers'],
    queryFn: async () => {
      const response = await fetch('/api/admin/subscribers');
      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Failed to fetch subscribers');
      }

      return result.data;
    },
  });

  // Add subscriber mutation
  const addMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/admin/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Failed to add subscriber');
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      setEmail('');
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to add subscriber');
    },
  });

  // Remove subscriber mutation
  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/subscribers?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Failed to remove subscriber');
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to remove subscriber');
    },
  });

  function handleAdd() {
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Invalid email format');
      return;
    }

    addMutation.mutate(email.trim().toLowerCase());
  }

  function handleRemove(id: string) {
    if (confirm('Remove this subscriber?')) {
      removeMutation.mutate(id);
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Email Subscribers</h2>

      {/* Add subscriber form */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Enter email address"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {addMutation.isPending ? 'Adding...' : 'Add'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Subscriber list */}
      <div>
        {isLoading ? (
          <p className="text-gray-500">Loading subscribers...</p>
        ) : subscribers && subscribers.length > 0 ? (
          <ul className="space-y-2">
            {subscribers.map((subscriber) => (
              <li
                key={subscriber.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="text-gray-900">{subscriber.email}</span>
                <button
                  onClick={() => handleRemove(subscriber.id)}
                  disabled={removeMutation.isPending}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                >
                  {removeMutation.isPending ? 'Removing...' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No subscribers yet.</p>
        )}
      </div>
    </div>
  );
}
```

### Integration with Dashboard

```typescript
// src/app/page.tsx (add subscriber manager section)
import { SubscriberManager } from '@/components/subscriber-manager';

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-8">
      {/* Existing dashboard content (KPI cards, charts, etc.) */}

      {/* Admin section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Admin Settings</h2>
        <SubscriberManager />
      </div>
    </div>
  );
}
```

**Alternative placement:** Use a collapsible panel or separate admin page if dashboard becomes cluttered.

### Database Schema (Already Exists from Story 1.1)

```sql
CREATE TABLE subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policy:**
- Anon key: No access (subscribers table is admin-only)
- Service role key: Full access (used in API routes)

### Email Normalization

**Best practice:** Normalize email addresses before storing to prevent duplicates.

```typescript
// In POST handler
const normalizedEmail = email.trim().toLowerCase();
```

This ensures:
- `Adam@Example.com` and `adam@example.com` are treated as duplicates
- Leading/trailing whitespace doesn't cause issues

### UI/UX Considerations

**Loading states:**
- Show "Loading subscribers..." while fetching
- Show "Adding..." / "Removing..." during mutations
- Disable buttons during pending operations

**Error handling:**
- Display clear error messages (invalid email, duplicate email, API failure)
- Use red text for errors
- Clear error message on successful operation

**Confirmation:**
- Confirm before removing subscriber (prevent accidental deletion)
- No confirmation needed for adding (low-risk operation)

**Input validation:**
- Client-side: validate email format before sending request
- Server-side: validate again (never trust client)
- Prevent duplicate emails (DB unique constraint + API check)

### Testing Checklist

- [ ] GET /api/admin/subscribers returns list of subscribers
- [ ] POST /api/admin/subscribers adds new subscriber
- [ ] POST with invalid email returns 400 error
- [ ] POST with duplicate email returns 409 error
- [ ] DELETE /api/admin/subscribers removes subscriber
- [ ] Subscriber list updates immediately after add/remove
- [ ] Email addresses normalized (case-insensitive, trimmed)
- [ ] Loading states display during API calls
- [ ] Error messages display on API failures
- [ ] Confirmation prompt appears before removing subscriber
- [ ] Monday email sends to all subscribers in table

### TanStack Query Setup (Already Installed in Story 2.1)

**If not yet installed:**
```bash
pnpm add @tanstack/react-query
```

**Query client provider (should already exist in `src/app/layout.tsx`):**
```typescript
// src/app/layout.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

### Security Considerations

**Auth protection:**
- Subscriber management is admin-only
- Proxy (proxy.ts) already protects non-public routes
- API route uses service role key (bypasses RLS)
- No additional auth needed if dashboard is already protected

**Input validation:**
- Validate email format (client + server)
- Sanitize input to prevent injection attacks
- Use parameterized queries (Supabase client handles this)

**Rate limiting:**
- Consider adding rate limiting to prevent abuse (e.g., max 10 adds per minute)
- Vercel Edge Functions have built-in rate limiting

### Future Enhancements (Out of Scope)

- [ ] Bulk import subscribers from CSV
- [ ] Email unsubscribe link in Monday email
- [ ] Subscriber activity tracking (last email received, click rate)
- [ ] Admin email notifications on subscriber add/remove
- [ ] Role-based access (different permission levels)

### References

- [Source: {output_folder}/planning-artifacts/prd.md#FR27-FR28: Subscriber management]
- [Source: {output_folder}/planning-artifacts/architecture.md#Monday Email Delivery]
- [Source: {output_folder}/planning-artifacts/epics.md#Story 4.2: Email Subscriber Management]
- [TanStack Query documentation](https://tanstack.com/query/latest)
- [Supabase RLS documentation](https://supabase.com/docs/guides/auth/row-level-security)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
