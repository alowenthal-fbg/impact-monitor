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
