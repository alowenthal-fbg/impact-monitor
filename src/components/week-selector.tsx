'use client';

import { useState, useRef, useEffect } from 'react';
import { useAvailableWeeks } from '@/hooks/use-weekly-data';
import { formatWeekLabel, getISOWeekNumber } from '@/lib/utils/week';
import { format, addDays } from 'date-fns';

export type ViewMode = 'week' | 'ytd';

interface WeekSelectorProps {
  selectedWeek: string;
  currentWeekStart: string;
  onChange: (weekStart: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  children?: React.ReactNode;
}

export function WeekSelector({ selectedWeek, currentWeekStart, onChange, viewMode, onViewModeChange, children }: WeekSelectorProps) {
  const { data: weeks, isLoading } = useAvailableWeeks();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  if (isLoading) {
    return <div className="h-10 w-72 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />;
  }

  const weeksList = weeks ?? [];
  const currentIndex = weeksList.indexOf(selectedWeek);
  // Weeks are sorted descending (most recent first), so "prev" = index + 1, "next" = index - 1
  const canGoPrev = currentIndex < weeksList.length - 1;
  const canGoNext = currentIndex > 0;

  function goPrev() {
    if (canGoPrev) onChange(weeksList[currentIndex + 1]);
  }

  function goNext() {
    if (canGoNext) onChange(weeksList[currentIndex - 1]);
  }

  function selectWeek(week: string) {
    onChange(week);
    setDropdownOpen(false);
  }

  const isCurrentWeek = selectedWeek === currentWeekStart;

  const isYtd = viewMode === 'ytd';

  return (
    <div className="relative flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
      {/* View mode pill toggle */}
      <div className="flex rounded-lg bg-gray-200 p-0.5 dark:bg-gray-700">
        <button
          onClick={() => onViewModeChange('week')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            !isYtd
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Week
        </button>
        <button
          onClick={() => onViewModeChange('ytd')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            isYtd
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          YTD
        </button>
      </div>

      <div className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-600" />

      {isYtd ? (
        /* YTD label */
        <div className="flex flex-col items-center leading-tight px-2">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {new Date().getFullYear()} Year to Date
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Jan 1 – {format(new Date(), 'MMM d')}
          </span>
        </div>
      ) : (
        <>
          {/* Prev arrow */}
          <button
            onClick={goPrev}
            disabled={!canGoPrev}
            aria-label="Previous week"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Week label + dropdown trigger */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="rounded-md px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <div className="flex flex-col items-center leading-tight">
                <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-gray-100">
                  Week {getISOWeekNumber(selectedWeek)}
                  {isCurrentWeek && (
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      Live
                    </span>
                  )}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {format(new Date(selectedWeek + 'T00:00:00'), 'MMM d')} - {format(addDays(new Date(selectedWeek + 'T00:00:00'), 6), 'MMM d')}
                </span>
              </div>
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {weeksList.map((week) => (
                  <button
                    key={week}
                    onClick={() => selectWeek(week)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      week === selectedWeek
                        ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>{formatWeekLabel(week)}</span>
                    {week === currentWeekStart && (
                      <span className="text-[10px] font-medium text-blue-500">Current</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Next arrow */}
          <button
            onClick={goNext}
            disabled={!canGoNext}
            aria-label="Next week"
            className="rounded-md p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Divider */}
      {children && (
        <>
          <div className="mx-1 h-6 w-px bg-gray-300 dark:bg-gray-600" />
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {children}
          </div>
        </>
      )}
    </div>
  );
}
