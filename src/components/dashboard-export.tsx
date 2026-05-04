'use client';

import { useState } from 'react';
import { toPng } from 'html-to-image';

interface DashboardExportProps {
  weekStart: string;
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

      const isDark = document.documentElement.classList.contains('dark');
      const dataUrl = await toPng(element, {
        pixelRatio: 2,
        backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `fanatics-tickets-week-${weekStart}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
    >
      {isExporting ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Exporting...
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export PNG
        </>
      )}
    </button>
  );
}
