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
  const wowTickets = prevWeekData && prevWeekData.totalTickets > 0
    ? ((weekData.totalTickets - prevWeekData.totalTickets) / prevWeekData.totalTickets * 100).toFixed(0)
    : null;
  const wowGtv = prevWeekData && prevWeekData.totalGtv > 0
    ? ((weekData.totalGtv - prevWeekData.totalGtv) / prevWeekData.totalGtv * 100).toFixed(0)
    : null;

  const ticketsText = `${weekData.totalTickets.toLocaleString()} tickets sold${wowTickets ? ` (${Number(wowTickets) > 0 ? '+' : ''}${wowTickets}% WoW)` : ''}`;
  const gtvText = `$${(weekData.totalGtv / 1000).toFixed(1)}K GTV${wowGtv ? ` (${Number(wowGtv) > 0 ? '+' : ''}${wowGtv}% WoW)` : ''}`;

  return `Week ${weekNumber}: ${ticketsText}, ${gtvText}`;
}

export function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
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

export function buildEmailTemplate(data: EmailTemplateData): string {
  return `<!DOCTYPE html>
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
</html>`;
}
