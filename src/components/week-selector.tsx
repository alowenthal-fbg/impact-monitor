'use client';

import { useAvailableWeeks } from '@/hooks/use-weekly-data';
import { formatWeekLabel } from '@/lib/utils/week';

interface WeekSelectorProps {
  selectedWeek: string;
  currentWeekStart: string;
  onChange: (weekStart: string) => void;
}

export function WeekSelector({ selectedWeek, currentWeekStart, onChange }: WeekSelectorProps) {
  const { data: weeks, isLoading } = useAvailableWeeks();

  if (isLoading) {
    return <div className="h-10 w-56 animate-pulse rounded bg-gray-200" />;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedWeek}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {weeks?.map((week) => (
          <option key={week} value={week}>
            {formatWeekLabel(week)}
            {week === currentWeekStart ? ' (Current)' : ''}
          </option>
        ))}
      </select>
      {selectedWeek === currentWeekStart && (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          In Progress
        </span>
      )}
    </div>
  );
}
