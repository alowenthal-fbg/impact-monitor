import { Resend } from 'resend';
import { generateEmailImage, buildImageData, type ForecastTotals } from './image';
import { buildEmailTemplate, generateSubjectLine, getWeekNumber } from './template';
import type { EmailTemplateData } from './template';
import { generateNarrative, type WeekData } from '../ai/narrative';
import { createServerClient } from '../supabase/server';
import { retryWithBackoff } from '../utils/retry';

export interface SendMondayEmailOptions {
  recipients?: string[]; // Override subscriber list (used for test sends)
  testMode?: boolean; // Prepend [TEST] to subject
}

export async function sendMondayEmail(
  weekData: WeekData,
  prevWeekData: WeekData | null,
  options: SendMondayEmailOptions = {}
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured. Set it in .env.local (dev) or Vercel env vars (prod) and restart the server.');
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabase = createServerClient();

  // Determine recipients: override takes precedence, otherwise pull from subscribers
  let recipients: string[];
  if (options.recipients && options.recipients.length > 0) {
    recipients = options.recipients;
  } else {
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

    recipients = subscribers.map((s) => s.email);
  }

  // Generate AI narrative
  const narrative = await retryWithBackoff(() => generateNarrative(weekData, prevWeekData));

  // Fetch sport and event data for image generation
  const weekEnd = new Date(weekData.weekStart + 'T00:00:00');
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const { data: sportRows } = await supabase
    .from('daily_metrics')
    .select('sport, tickets_sold, gtv')
    .eq('source', 'tm_api')
    .gte('metric_date', weekData.weekStart)
    .lte('metric_date', weekEndStr);

  const { data: topEventsData } = await supabase
    .from('daily_metrics')
    .select('sport, event_name, gtv')
    .eq('source', 'tm_api')
    .gte('metric_date', weekData.weekStart)
    .lte('metric_date', weekEndStr)
    .order('gtv', { ascending: false })
    .limit(5);

  // Fetch commercial forecast for the week
  const { data: forecastRows } = await supabase
    .from('forecast_metrics')
    .select('tickets_sold, orders, gtv')
    .gte('metric_date', weekData.weekStart)
    .lte('metric_date', weekEndStr);

  let forecast: ForecastTotals | null = null;
  if (forecastRows && forecastRows.length > 0) {
    const totals = forecastRows.reduce(
      (acc, row) => ({
        totalTickets: acc.totalTickets + (row.tickets_sold ?? 0),
        totalOrders: acc.totalOrders + (row.orders ?? 0),
        totalGtv: acc.totalGtv + Number(row.gtv ?? 0),
      }),
      { totalTickets: 0, totalOrders: 0, totalGtv: 0 }
    );
    if (totals.totalTickets > 0 || totals.totalOrders > 0 || totals.totalGtv > 0) {
      forecast = totals;
    }
  }

  // Aggregate sport data
  const sportMap = new Map<string, { tickets: number; gtv: number }>();
  sportRows?.forEach((row) => {
    const sport = row.sport || 'Unknown';
    const tickets = row.tickets_sold || 0;
    const gtv = row.gtv || 0;
    const existing = sportMap.get(sport);
    if (existing) {
      sportMap.set(sport, { tickets: existing.tickets + tickets, gtv: existing.gtv + gtv });
    } else {
      sportMap.set(sport, { tickets, gtv });
    }
  });

  const sportBreakdown = Array.from(sportMap.entries())
    .map(([sport, d]) => ({ sport, tickets: d.tickets, gtv: d.gtv }))
    .sort((a, b) => b.gtv - a.gtv);

  const topEvents = (topEventsData ?? []).map((e) => ({
    sport: e.sport || 'Unknown',
    eventName: e.event_name || 'Unknown Event',
    gtv: e.gtv || 0,
  }));

  // Build image data and generate PNG
  const imageData = buildImageData(weekData, prevWeekData, sportBreakdown, topEvents, forecast);
  const imageBuffer = await retryWithBackoff(() => generateEmailImage(imageData));

  // Build email HTML
  const avgOrderValue = weekData.totalOrders > 0 ? weekData.totalGtv / weekData.totalOrders : 0;
  const templateData: EmailTemplateData = {
    weekStart: weekData.weekStart,
    totalTickets: weekData.totalTickets,
    totalOrders: weekData.totalOrders,
    totalGtv: weekData.totalGtv,
    avgOrderValue,
    wowTickets: imageData.wowTickets,
    wowOrders: imageData.wowOrders,
    wowGtv: imageData.wowGtv,
    wowAov: imageData.wowAov,
    vsForecastTickets: imageData.vsForecastTickets,
    vsForecastOrders: imageData.vsForecastOrders,
    vsForecastGtv: imageData.vsForecastGtv,
    vsForecastAov: imageData.vsForecastAov,
    narrative,
    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?week=${weekData.weekStart}`,
  };

  const htmlBody = buildEmailTemplate(templateData);
  const weekNumber = getWeekNumber(weekData.weekStart);

  const baseSubject = generateSubjectLine(
    { totalTickets: weekData.totalTickets, totalGtv: weekData.totalGtv },
    prevWeekData ? { totalTickets: prevWeekData.totalTickets, totalGtv: prevWeekData.totalGtv } : null,
    weekNumber
  );
  const subject = options.testMode ? `[TEST] ${baseSubject}` : baseSubject;

  // Send email with retry
  await retryWithBackoff(async () => {
    const result = await resend.emails.send({
      from: 'Impact Monitor <onboarding@resend.dev>',
      to: recipients,
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
