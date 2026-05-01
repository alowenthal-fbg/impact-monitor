'use client';

import type { TopEvent } from '@/hooks/use-top-events';

interface TopEventsTableProps {
  events: TopEvent[];
  isLoading?: boolean;
}

export function TopEventsTable({ events, isLoading }: TopEventsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400">
        No events found for this week.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Sport
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
              Event
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
              GTV
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {events.map((event, idx) => (
            <tr key={idx}>
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                {event.sport}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {event.event_name}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                ${event.gtv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
