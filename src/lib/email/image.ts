import satori from 'satori';
import sharp from 'sharp';
import type { WeekData } from '../ai/narrative';
import type { SportBreakdown, TopEvent } from '../ai/talk-track';
import React from 'react';

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

function fmtWow(wow: number | null): string {
  if (wow === null) return '';
  return `${wow > 0 ? '+' : ''}${wow.toFixed(1)}% WoW`;
}

function kpiCard(label: string, value: string, wow: number | null) {
  const wowText = fmtWow(wow);
  const wowColor = wow !== null && wow > 0 ? '#10b981' : '#ef4444';

  return React.createElement(
    'div',
    {
      style: {
        flex: 1,
        padding: '20px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column' as const,
      },
    },
    React.createElement(
      'div',
      { style: { fontSize: '13px', color: '#6b7280', marginBottom: '8px' } },
      label
    ),
    React.createElement(
      'div',
      { style: { fontSize: '26px', fontWeight: 'bold', marginBottom: '4px' } },
      value
    ),
    wowText
      ? React.createElement(
          'div',
          { style: { fontSize: '13px', color: wowColor } },
          wowText
        )
      : null
  );
}

export async function generateEmailImage(data: EmailImageData): Promise<Buffer> {
  const jsx = React.createElement(
    'div',
    {
      style: {
        width: '1200px',
        height: '675px',
        display: 'flex',
        flexDirection: 'column' as const,
        backgroundColor: '#ffffff',
        padding: '40px',
        fontFamily: 'Inter, Arial, sans-serif',
      },
    },
    // Header
    React.createElement(
      'div',
      {
        style: {
          fontSize: '28px',
          fontWeight: 'bold',
          marginBottom: '24px',
          color: '#111827',
        },
      },
      `Impact Monitor — Week of ${data.weekStart}`
    ),
    // KPI Cards
    React.createElement(
      'div',
      { style: { display: 'flex', gap: '16px', marginBottom: '28px' } },
      kpiCard('Tickets Sold', data.totalTickets.toLocaleString(), data.wowTickets),
      kpiCard('Orders', data.totalOrders.toLocaleString(), data.wowOrders),
      kpiCard('GTV', `$${(data.totalGtv / 1000).toFixed(1)}K`, data.wowGtv),
      kpiCard('Avg Order Value', `$${data.avgOrderValue.toFixed(2)}`, data.wowAov)
    ),
    // Two columns: sport breakdown + top events
    React.createElement(
      'div',
      { style: { display: 'flex', gap: '24px', flex: 1 } },
      // Sport breakdown
      React.createElement(
        'div',
        { style: { flex: 1 } },
        React.createElement(
          'div',
          {
            style: {
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '12px',
              color: '#111827',
            },
          },
          'Top Sports by GTV'
        ),
        ...data.sportData.slice(0, 5).map((sport) =>
          React.createElement(
            'div',
            {
              key: sport.sport,
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #e5e7eb',
                fontSize: '14px',
              },
            },
            React.createElement('div', { style: { fontWeight: 'bold' } }, sport.sport),
            React.createElement(
              'div',
              { style: { color: '#6b7280' } },
              `${sport.tickets.toLocaleString()} tix · $${(sport.gtv / 1000).toFixed(1)}K`
            )
          )
        )
      ),
      // Top events
      React.createElement(
        'div',
        { style: { flex: 1 } },
        React.createElement(
          'div',
          {
            style: {
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '12px',
              color: '#111827',
            },
          },
          'Top 5 Events by GTV'
        ),
        ...data.topEvents.map((event, i) =>
          React.createElement(
            'div',
            {
              key: i,
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #e5e7eb',
                fontSize: '14px',
              },
            },
            React.createElement(
              'div',
              { style: { flex: 1 } },
              `${i + 1}. ${event.eventName}`
            ),
            React.createElement(
              'div',
              { style: { color: '#6b7280', marginLeft: '8px' } },
              `${event.sport} · $${(event.gtv / 1000).toFixed(1)}K`
            )
          )
        )
      )
    )
  );

  const svg = await satori(jsx, {
    width: 1200,
    height: 675,
    fonts: [
      {
        name: 'Inter',
        data: await loadDefaultFont(),
        weight: 400,
        style: 'normal' as const,
      },
    ],
  });

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return pngBuffer;
}

async function loadDefaultFont(): Promise<ArrayBuffer> {
  // Use Google Fonts CDN for a clean sans-serif font
  const res = await fetch(
    'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf'
  );
  return res.arrayBuffer();
}

export function buildImageData(
  weekData: WeekData,
  prevWeekData: WeekData | null,
  sportData: Array<{ sport: string; tickets: number; gtv: number }>,
  topEvents: Array<{ sport: string; eventName: string; gtv: number }>
): EmailImageData {
  const wowTickets =
    prevWeekData && prevWeekData.totalTickets > 0
      ? ((weekData.totalTickets - prevWeekData.totalTickets) / prevWeekData.totalTickets) * 100
      : null;
  const wowOrders =
    prevWeekData && prevWeekData.totalOrders > 0
      ? ((weekData.totalOrders - prevWeekData.totalOrders) / prevWeekData.totalOrders) * 100
      : null;
  const wowGtv =
    prevWeekData && prevWeekData.totalGtv > 0
      ? ((weekData.totalGtv - prevWeekData.totalGtv) / prevWeekData.totalGtv) * 100
      : null;
  const avgOrderValue = weekData.totalOrders > 0 ? weekData.totalGtv / weekData.totalOrders : 0;
  const prevAvgOrderValue =
    prevWeekData && prevWeekData.totalOrders > 0
      ? prevWeekData.totalGtv / prevWeekData.totalOrders
      : null;
  const wowAov = prevAvgOrderValue
    ? ((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100
    : null;

  return {
    weekStart: weekData.weekStart,
    totalTickets: weekData.totalTickets,
    totalOrders: weekData.totalOrders,
    totalGtv: weekData.totalGtv,
    avgOrderValue,
    wowTickets,
    wowOrders,
    wowGtv,
    wowAov,
    sportData,
    topEvents,
  };
}
