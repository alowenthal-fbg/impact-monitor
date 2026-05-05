import { Resend } from 'resend';
import { generateEmailImage, buildImageData } from './image';
import { buildEmailTemplate, generateSubjectLine, getWeekNumber } from './template';
import type { EmailTemplateData } from './template';
import { generateNarrative, type WeekData } from '../ai/narrative';
import { createServerClient } from '../supabase/server';
import { retryWithBackoff } from '../utils/retry';

export async function sendMondayEmail(
  weekData: WeekData,
  prevWeekData: WeekData | null
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY!);
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
  const imageData = buildImageData(weekData, prevWeekData, sportBreakdown, topEvents);
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
    narrative,
    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?week=${weekData.weekStart}`,
  };

  const htmlBody = buildEmailTemplate(templateData);
  const weekNumber = getWeekNumber(weekData.weekStart);

  const subject = generateSubjectLine(
    { totalTickets: weekData.totalTickets, totalGtv: weekData.totalGtv },
    prevWeekData ? { totalTickets: prevWeekData.totalTickets, totalGtv: prevWeekData.totalGtv } : null,
    weekNumber
  );

  // Send email with retry
  await retryWithBackoff(async () => {
    const result = await resend.emails.send({
      from: 'Impact Monitor <onboarding@resend.dev>',
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
