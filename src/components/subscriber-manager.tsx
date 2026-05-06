'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isValidEmail } from '@/lib/utils/validation';

interface Subscriber {
  id: string;
  email: string;
  created_at: string;
}

export function SubscriberManager() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<{ id: string; status: 'sending' | 'sent' | 'error'; message?: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: subscribers, isLoading } = useQuery<Subscriber[]>({
    queryKey: ['subscribers'],
    queryFn: async () => {
      const response = await fetch('/api/admin/subscribers');
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Failed to fetch subscribers');
      }
      return result.data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (newEmail: string) => {
      const response = await fetch('/api/admin/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Failed to add subscriber');
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      setEmail('');
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to add subscriber');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/subscribers?id=${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Failed to remove subscriber');
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers'] });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to remove subscriber');
    },
  });

  function handleAdd() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email is required');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError('Invalid email format');
      return;
    }
    addMutation.mutate(trimmed.toLowerCase());
  }

  function handleRemove(id: string) {
    if (confirm('Remove this subscriber?')) {
      removeMutation.mutate(id);
    }
  }

  async function handleTest(id: string, recipientEmail: string) {
    setTestState({ id, status: 'sending' });
    try {
      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: recipientEmail }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error?.message || 'Failed to send test email');
      }
      setTestState({ id, status: 'sent', message: `Sent to ${recipientEmail}` });
      setTimeout(() => setTestState((s) => (s?.id === id ? null : s)), 4000);
    } catch (err) {
      setTestState({
        id,
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to send test email',
      });
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-900">
      <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-gray-100">Email Subscribers</h2>

      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Enter email address"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {addMutation.isPending ? 'Adding...' : 'Add'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <div>
        {isLoading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading subscribers...</p>
        ) : subscribers && subscribers.length > 0 ? (
          <ul className="space-y-2">
            {subscribers.map((subscriber) => {
              const isActiveTest = testState?.id === subscriber.id;
              const testLabel = isActiveTest && testState.status === 'sending'
                ? 'Sending...'
                : isActiveTest && testState.status === 'sent'
                  ? 'Sent ✓'
                  : 'Test';
              return (
                <li
                  key={subscriber.id}
                  className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3 dark:bg-gray-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 dark:text-gray-100">{subscriber.email}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTest(subscriber.id, subscriber.email)}
                        disabled={isActiveTest && testState.status === 'sending'}
                        className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        {testLabel}
                      </button>
                      <button
                        onClick={() => handleRemove(subscriber.id)}
                        disabled={removeMutation.isPending}
                        className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:bg-gray-400"
                      >
                        {removeMutation.isPending ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                  {isActiveTest && testState.status === 'error' && (
                    <p className="text-xs text-red-600 dark:text-red-400">{testState.message}</p>
                  )}
                  {isActiveTest && testState.status === 'sent' && (
                    <p className="text-xs text-green-600 dark:text-green-400">{testState.message}</p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No subscribers yet.</p>
        )}
      </div>
    </div>
  );
}
