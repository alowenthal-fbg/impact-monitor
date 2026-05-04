'use client';

import type { TopEvent } from '@/hooks/use-top-events';

const SPORT_EMOJI: Record<string, string> = {
  Baseball: '\u26BE',
  Basketball: '\uD83C\uDFC0',
  Hockey: '\uD83C\uDFD2',
  Soccer: '\u26BD',
  Football: '\uD83C\uDFC8',
  Wrestling: '\uD83E\uDD3C',
  Lacrosse: '\uD83E\uDD4D',
  Tennis: '\uD83C\uDFBE',
  Golf: '\u26F3',
  'Motorsports/Racing': '\uD83C\uDFCE\uFE0F',
  Boxing: '\uD83E\uDD4A',
  MMA: '\uD83E\uDD4A',
  Volleyball: '\uD83C\uDFD0',
  Cricket: '\uD83C\uDFCF',
  Rugby: '\uD83C\uDFC9',
  Equestrian: '\uD83D\uDC34',
};

interface TopEventsTableProps {
  events: TopEvent[];
  isLoading?: boolean;
}

export function TopEventsTable({ events, isLoading }: TopEventsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
        No events found for this week.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Sport
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              Event
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              GTV
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          {events.map((event, idx) => (
            <tr key={idx}>
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                {SPORT_EMOJI[event.sport] ? `${SPORT_EMOJI[event.sport]} ` : ''}{event.sport}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                {event.event_name}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900 dark:text-gray-100">
                ${event.gtv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
