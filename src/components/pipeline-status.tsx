'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

interface PipelineStatusProps {
  status?: 'success' | 'partial' | 'failed';
  timestamp?: string;
  errorMessage?: string | null;
  isLoading?: boolean;
}

const SPREADSHEET_URL =
  'https://docs.google.com/spreadsheets/d/1GipSnWcjPZJFNe9U5sfhdBeZJJZk7_Y1h0LUZYaZ9D4/edit?gid=1862022446#gid=1862022446';

export function PipelineStatus({ status, timestamp, errorMessage, isLoading }: PipelineStatusProps) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ message: string; error?: boolean } | null>(null);
  const [lastForecastUpdated, setLastForecastUpdated] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const [settingsSize, setSettingsSize] = useState<number | undefined>(undefined);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchLastForecastUpdated();
  }, []);

  useEffect(() => {
    if (settingsRef.current) {
      const height = settingsRef.current.offsetHeight;
      if (height > 0) setSettingsSize(height);
    }
  });

  async function fetchLastForecastUpdated() {
    const supabase = createClient();
    const { data } = await supabase
      .from('forecast_metrics')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      setLastForecastUpdated(data[0].updated_at);
    }
  }

  const toggleTheme = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }, [dark]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadStatus(null);
    try {
      const text = await file.text();
      const rows = parseForecastCsv(text);
      if (rows.length === 0) {
        setUploadStatus({ message: 'No forecast data found in file', error: true });
        return;
      }
      const supabase = createClient();
      const batchSize = 500;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase
          .from('forecast_metrics')
          .upsert(batch, { onConflict: 'metric_date,source' });
        if (error) throw new Error(error.message);
      }
      setUploadStatus({ message: `Uploaded ${rows.length} forecast days` });
      fetchLastForecastUpdated();
      queryClient.invalidateQueries({ queryKey: ['forecast'] });
      queryClient.invalidateQueries({ queryKey: ['week-pace'] });
    } catch (err) {
      setUploadStatus({
        message: err instanceof Error ? err.message : 'Upload failed',
        error: true,
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [queryClient]);

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

  const dotColor =
    status === 'success' ? 'bg-green-500' :
    status === 'partial' ? 'bg-yellow-500' :
    status === 'failed' ? 'bg-red-500' : 'bg-gray-400';

  const timeAgo = timestamp
    ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    : null;

  if (isLoading) {
    return <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />;
  }

  return (
    <>
      <div className="flex items-stretch rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {/* Status + timestamp */}
        <div className="flex items-center gap-2 px-4" title={errorMessage ?? undefined}>
          <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {timeAgo ? `Updated ${timeAgo}` : 'No data'}
          </span>
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh data"
          className="flex items-center border-l border-gray-200 px-3 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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
      </div>

      {/* Settings button */}
      <button
        ref={settingsRef}
        onClick={() => setSettingsOpen(true)}
        title="Settings"
        className="flex shrink-0 items-center justify-center self-stretch rounded-xl border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        style={{ width: settingsSize ? `${settingsSize}px` : undefined }}
      >
        <svg className="h-[26px] w-[26px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {refreshError && (
        <p className="text-xs text-red-600 dark:text-red-400">{refreshError}</p>
      )}

      {/* Settings slide-in panel */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setSettingsOpen(false)}
        />
      )}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-80 transform border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 dark:border-gray-700 dark:bg-gray-900 ${
          settingsOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
            <button
              onClick={() => setSettingsOpen(false)}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Theme toggle */}
          <div className="mb-8">
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</span>
              <button
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  mounted && dark ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mounted && dark ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Forecast upload */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Commercial Forecast
            </h3>
            {lastForecastUpdated && (
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                Last updated: {new Date(lastForecastUpdated).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            )}

            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-colors ${
                uploading
                  ? 'border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-800'
                  : 'border-gray-300 text-gray-600 hover:border-indigo-400 hover:bg-indigo-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-indigo-950'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {uploading ? 'Uploading...' : 'Upload Daily Ticketing CSV'}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>

            {uploadStatus && (
              <p className={`mt-2 text-xs ${uploadStatus.error ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {uploadStatus.message}
              </p>
            )}

            <a
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Open source spreadsheet (Daily Ticketing tab) →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

interface ForecastMetricRow {
  metric_date: string;
  tickets_sold: number;
  orders: number;
  gtv: number;
  source: 'gsheet_forecast';
}

function parseForecastCsv(text: string): ForecastMetricRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 8) return [];

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { fields.push(current); current = ''; }
        else { current += ch; }
      }
    }
    fields.push(current);
    return fields;
  };

  const rows = lines.map(parseRow);

  let dateRow: string[] = [];
  let transactionsRow: string[] = [];
  let ticketsRow: string[] = [];
  let govRow: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const label = (rows[i][1] ?? '').trim().toLowerCase();
    if (!dateRow.length && rows[i].slice(2).some((v) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v.trim()))) {
      dateRow = rows[i];
    }
    if (label === 'ticketing transactions') transactionsRow = rows[i];
    if (label === 'total tickets sold') ticketsRow = rows[i];
    if (label === 'total ticketing gov') govRow = rows[i];
  }

  if (!dateRow.length || !ticketsRow.length) return [];

  const results: ForecastMetricRow[] = [];

  for (let col = 2; col < dateRow.length; col++) {
    const dateStr = dateRow[col]?.trim();
    if (!dateStr) continue;

    const metricDate = parseSheetDate(dateStr);
    if (!metricDate) continue;

    const tickets = parseNum(ticketsRow[col]);
    const orders = parseNum(transactionsRow[col]);
    const gtv = parseNumDecimal(govRow[col]);

    if (tickets === 0 && orders === 0 && gtv === 0) continue;

    results.push({
      metric_date: metricDate,
      tickets_sold: tickets,
      orders,
      gtv,
      source: 'gsheet_forecast',
    });
  }

  return results;
}

function parseSheetDate(dateStr: string): string | null {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');
  const year = parts[2];
  return `${year}-${month}-${day}`;
}

function parseNum(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,\s"()]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : Math.round(num);
}

function parseNumDecimal(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,\s"()]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}
