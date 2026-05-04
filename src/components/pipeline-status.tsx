'use client';

import { formatDistanceToNow } from 'date-fns';

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
  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />;
  }

  if (!status || !timestamp) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        No pipeline data available
      </div>
    );
  }

  const config = statusConfig[status];
  const timeAgo = formatDistanceToNow(new Date(timestamp), { addSuffix: true });

  return (
    <div className={`rounded-lg border p-4 ${config.color}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{config.icon}</span>
        <div className="flex-1">
          <p className="font-semibold">{config.label}</p>
          <p className="text-sm opacity-80">Last run: {timeAgo}</p>
        </div>
        {errorMessage && (
          <p className="text-sm">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
