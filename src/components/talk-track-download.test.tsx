import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TalkTrackDownload } from './talk-track-download';

afterEach(cleanup);

describe('TalkTrackDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders talk track button', () => {
    render(<TalkTrackDownload weekStart="2026-04-21" />);
    expect(screen.getByText('Talk Track')).toBeDefined();
  });

  it('shows loading state during generation', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    render(<TalkTrackDownload weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Generating...')).toBeDefined();
    });
  });

  it('calls API with correct weekStart', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { talkTrack: 'Generated text.' }, error: null }),
    });

    render(<TalkTrackDownload weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/export/talk-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: '2026-04-21' }),
      });
    });
  });

  it('shows error message on failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ data: null, error: { message: 'API key missing' } }),
    });

    render(<TalkTrackDownload weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('API key missing')).toBeDefined();
    });
  });

  it('resets button after successful download', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { talkTrack: 'Generated text.' }, error: null }),
    });

    render(<TalkTrackDownload weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Talk Track')).toBeDefined();
    });
  });
});
