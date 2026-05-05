'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

interface PipelineStatusProps {
  status?: 'success' | 'partial' | 'failed';
  timestamp?: string;
  errorMessage?: string | null;
  isLoading?: boolean;
}

const statusConfig = {
  success: {
    color: 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
    icon: '\u2713',
    label: 'Pipeline Healthy',
  },
  partial: {
    color: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
    icon: '\u26A0',
    label: 'Partial Success',
  },
  failed: {
    color: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
    icon: '\u2715',
    label: 'Pipeline Failed',
  },
};

export function PipelineStatus({ status, timestamp, errorMessage, isLoading }: PipelineStatusProps) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch('/api/admin/refresh', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Refresh failed (${res.status})`);
      }
      await queryClient.invalidateQueries();
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />;
  }

  if (!status || !timestamp) {
    return (
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          No pipeline data available
        </div>
        <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
      </div>
    );
  }

  const config = statusConfig[status];
  const timeAgo = formatDistanceToNow(new Date(timestamp), { addSuffix: true });

  return (
    <div className="flex items-center gap-3">
      <div className={`rounded-lg border p-4 ${config.color}`}>
        <div className="flex items-center gap-3">
          <span className="text-xl">{config.icon}</span>
          <div className="flex-1">
            <p className="font-semibold">{config.label}</p>
            <p className="text-sm opacity-80">Last updated {timeAgo}</p>
          </div>
          {errorMessage && (
            <p className="text-sm">{errorMessage}</p>
          )}
        </div>
      </div>
      <RefreshButton onClick={handleRefresh} refreshing={refreshing} />
      {refreshError && (
        <p className="text-xs text-red-600 dark:text-red-400">{refreshError}</p>
      )}
    </div>
  );
}

function RefreshButton({ onClick, refreshing }: { onClick: () => void; refreshing: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={refreshing}
      title="Refresh data"
      className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={refreshing ? 'animate-spin' : ''}
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    </button>
  );
}
