# Story 4.2: Email Subscriber Management

Status: ready-for-dev

## Story

As an admin,
I want to add and remove email subscribers,
so that stakeholders receive the Monday email without me forwarding it.

## Acceptance Criteria

1. Subscriber management UI shows list of current subscribers.
2. Add: enter email, click add → POST /api/admin/subscribers → appears in list.
3. Remove: click remove → DELETE /api/admin/subscribers → disappears from list.
4. Monday email sends to all addresses in subscribers table.

## Tasks / Subtasks

- [ ] Task 1: Create subscriber management API route (AC: #2, #3)
  - [ ] Create `src/app/api/admin/subscribers/route.ts`
  - [ ] Implement GET handler to fetch all subscribers from Supabase
  - [ ] Implement POST handler to add new subscriber (validate email format)
  - [ ] Implement DELETE handler to remove subscriber by ID
  - [ ] Use Supabase service role client for write operations
  - [ ] Return consistent API response format (successResponse/errorResponse)
- [ ] Task 2: Create subscriber manager component (AC: #1, #2, #3)
  - [ ] Create `src/components/subscriber-manager.tsx`
  - [ ] Display list of current subscribers with email addresses
  - [ ] Implement add subscriber form (email input + add button)
  - [ ] Implement remove subscriber button for each list item
  - [ ] Show loading states during API calls
  - [ ] Show error messages if API calls fail
  - [ ] Use TanStack Query for data fetching and cache invalidation
- [ ] Task 3: Add subscriber manager to dashboard (AC: #1)
  - [ ] Import `SubscriberManager` component in `src/app/page.tsx`
  - [ ] Position in admin section (e.g., collapsible panel or separate tab)
  - [ ] Protect with auth check (admin-only section)
- [ ] Task 4: Email validation (AC: #2)
  - [ ] Create `src/lib/utils/validation.ts` with `isValidEmail(email)` function
  - [ ] Validate email format before adding subscriber (both client and server)
  - [ ] Prevent duplicate email addresses (unique constraint in DB + API check)
- [ ] Task 5: Test subscriber management flow (AC: #1, #2, #3, #4)
  - [ ] Verify subscriber list displays on page load
  - [ ] Add valid email → appears in list immediately
  - [ ] Add invalid email → shows error message
  - [ ] Add duplicate email → shows error message
  - [ ] Remove subscriber → disappears from list immediately
  - [ ] Verify Monday email sends to all subscribers in table

## Dev Notes

### Project Structure Notes

**New files created:**
```
src/
├── app/
│   └── api/
│       └── admin/
│           └── subscribers/
│               └── route.ts
├── components/
│   └── subscriber-manager.tsx
└── lib/
    └── utils/
        └── validation.ts
```

**Modified files:**
```
src/app/page.tsx (add subscriber manager section)
```

### API Route Implementation

```typescript
// src/app/api/admin/subscribers/route.ts
import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/api';
import { isValidEmail } from '@/lib/utils/validation';

// GET - Fetch all subscribers
export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('subscribers')
      .select('id, email, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return successResponse(data || []);
  } catch (error) {
    console.error('Failed to fetch subscribers:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch subscribers',
      'FETCH_ERROR',
      500
    );
  }
}

// POST - Add new subscriber
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return errorResponse('Email is required', 'MISSING_EMAIL', 400);
    }

    if (!isValidEmail(email)) {
      return errorResponse('Invalid email format', 'INVALID_EMAIL', 400);
    }

    const supabase = createServerClient();

    // Check for duplicate
    const { data: existing } = await supabase
      .from('subscribers')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return errorResponse('Email already subscribed', 'DUPLICATE_EMAIL', 409);
    }

    // Insert new subscriber
    const { data, error } = await supabase
      .from('subscribers')
      .insert({ email })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return successResponse(data, 201);
  } catch (error) {
    console.error('Failed to add subscriber:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to add subscriber',
      'INSERT_ERROR',
      500
    );
  }
}

// DELETE - Remove subscriber
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Subscriber ID is required', 'MISSING_ID', 400);
    }

    const supabase = createServerClient();

    const { error } = await supabase
      .from('subscribers')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return successResponse({ id });
  } catch (error) {
    console.error('Failed to delete subscriber:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to delete subscriber',
      'DELETE_ERROR',
      500
    );
  }
}
```

### Email Validation Utility

```typescript
// src/lib/utils/validation.ts
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

**Note:** This is a basic email validation regex. For production, consider using a more robust library like `validator.js` or `email-validator`.

### Subscriber Manager Component

```typescript
// src/components/subscriber-manager.tsx
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
  const queryClient = useQueryClient();

  // Fetch subscribers
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

  // Add subscriber mutation
  const addMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/admin/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
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

  // Remove subscriber mutation
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

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Invalid email format');
      return;
    }

    addMutation.mutate(email.trim().toLowerCase());
  }

  function handleRemove(id: string) {
    if (confirm('Remove this subscriber?')) {
      removeMutation.mutate(id);
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Email Subscribers</h2>

      {/* Add subscriber form */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Enter email address"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {addMutation.isPending ? 'Adding...' : 'Add'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Subscriber list */}
      <div>
        {isLoading ? (
          <p className="text-gray-500">Loading subscribers...</p>
        ) : subscribers && subscribers.length > 0 ? (
          <ul className="space-y-2">
            {subscribers.map((subscriber) => (
              <li
                key={subscriber.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="text-gray-900">{subscriber.email}</span>
                <button
                  onClick={() => handleRemove(subscriber.id)}
                  disabled={removeMutation.isPending}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                >
                  {removeMutation.isPending ? 'Removing...' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No subscribers yet.</p>
        )}
      </div>
    </div>
  );
}
```

### Integration with Dashboard

```typescript
// src/app/page.tsx (add subscriber manager section)
import { SubscriberManager } from '@/components/subscriber-manager';

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-8">
      {/* Existing dashboard content (KPI cards, charts, etc.) */}

      {/* Admin section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Admin Settings</h2>
        <SubscriberManager />
      </div>
    </div>
  );
}
```

**Alternative placement:** Use a collapsible panel or separate admin page if dashboard becomes cluttered.

### Database Schema (Already Exists from Story 1.1)

```sql
CREATE TABLE subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS Policy:**
- Anon key: No access (subscribers table is admin-only)
- Service role key: Full access (used in API routes)

### Email Normalization

**Best practice:** Normalize email addresses before storing to prevent duplicates.

```typescript
// In POST handler
const normalizedEmail = email.trim().toLowerCase();
```

This ensures:
- `Adam@Example.com` and `adam@example.com` are treated as duplicates
- Leading/trailing whitespace doesn't cause issues

### UI/UX Considerations

**Loading states:**
- Show "Loading subscribers..." while fetching
- Show "Adding..." / "Removing..." during mutations
- Disable buttons during pending operations

**Error handling:**
- Display clear error messages (invalid email, duplicate email, API failure)
- Use red text for errors
- Clear error message on successful operation

**Confirmation:**
- Confirm before removing subscriber (prevent accidental deletion)
- No confirmation needed for adding (low-risk operation)

**Input validation:**
- Client-side: validate email format before sending request
- Server-side: validate again (never trust client)
- Prevent duplicate emails (DB unique constraint + API check)

### Testing Checklist

- [ ] GET /api/admin/subscribers returns list of subscribers
- [ ] POST /api/admin/subscribers adds new subscriber
- [ ] POST with invalid email returns 400 error
- [ ] POST with duplicate email returns 409 error
- [ ] DELETE /api/admin/subscribers removes subscriber
- [ ] Subscriber list updates immediately after add/remove
- [ ] Email addresses normalized (case-insensitive, trimmed)
- [ ] Loading states display during API calls
- [ ] Error messages display on API failures
- [ ] Confirmation prompt appears before removing subscriber
- [ ] Monday email sends to all subscribers in table

### TanStack Query Setup (Already Installed in Story 2.1)

**If not yet installed:**
```bash
pnpm add @tanstack/react-query
```

**Query client provider (should already exist in `src/app/layout.tsx`):**
```typescript
// src/app/layout.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

### Security Considerations

**Auth protection:**
- Subscriber management is admin-only
- Proxy (proxy.ts) already protects non-public routes
- API route uses service role key (bypasses RLS)
- No additional auth needed if dashboard is already protected

**Input validation:**
- Validate email format (client + server)
- Sanitize input to prevent injection attacks
- Use parameterized queries (Supabase client handles this)

**Rate limiting:**
- Consider adding rate limiting to prevent abuse (e.g., max 10 adds per minute)
- Vercel Edge Functions have built-in rate limiting

### Future Enhancements (Out of Scope)

- [ ] Bulk import subscribers from CSV
- [ ] Email unsubscribe link in Monday email
- [ ] Subscriber activity tracking (last email received, click rate)
- [ ] Admin email notifications on subscriber add/remove
- [ ] Role-based access (different permission levels)

### References

- [Source: {output_folder}/planning-artifacts/prd.md#FR27-FR28: Subscriber management]
- [Source: {output_folder}/planning-artifacts/architecture.md#Monday Email Delivery]
- [Source: {output_folder}/planning-artifacts/epics.md#Story 4.2: Email Subscriber Management]
- [TanStack Query documentation](https://tanstack.com/query/latest)
- [Supabase RLS documentation](https://supabase.com/docs/guides/auth/row-level-security)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
