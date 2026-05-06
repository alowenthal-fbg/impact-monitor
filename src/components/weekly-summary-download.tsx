'use client';

import { useState, useEffect, useRef } from 'react';

interface TalkTrackDownloadProps {
  weekStart: string;
  isLiveWeek?: boolean;
}

export function TalkTrackDownload({ weekStart, isLiveWeek = false }: TalkTrackDownloadProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [talkTrack, setTalkTrack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Clear cached summary when week changes
  const prevWeekRef = useRef(weekStart);
  useEffect(() => {
    if (prevWeekRef.current !== weekStart) {
      setTalkTrack(null);
      setError(null);
      prevWeekRef.current = weekStart;
    }
  }, [weekStart]);

  async function handleClick() {
    if (talkTrack) {
      dialogRef.current?.showModal();
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/export/talk-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Failed to generate weekly summary');
      }

      setTalkTrack(result.data.talkTrack);
      dialogRef.current?.showModal();
    } catch (err) {
      console.error('Talk track generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate weekly summary');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleClose() {
    dialogRef.current?.close();
    setCopied(false);
  }

  async function handleCopy() {
    if (!talkTrack) return;
    await navigator.clipboard.writeText(talkTrack);
    setCopied(true);
  }

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Close on backdrop click
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      handleClose();
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleClick}
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-gray-400"
        >
          {isGenerating ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isLiveWeek ? 'Mid-Week Update' : 'Weekly Summary'}
            </>
          )}
        </button>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>

      <dialog
        ref={dialogRef}
        onClick={handleDialogClick}
        className="fixed inset-0 m-auto w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {isLiveWeek ? 'Mid-Week Update' : 'Weekly Summary'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Week of {weekStart}{isLiveWeek ? ' (in progress)' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <p className="whitespace-pre-wrap leading-relaxed text-gray-800 dark:text-gray-200">
            {talkTrack}
          </p>
        </div>
        <div className="flex justify-end border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
