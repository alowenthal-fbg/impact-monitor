import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TalkTrackDownload } from './weekly-summary-download';

afterEach(cleanup);

// jsdom doesn't implement dialog methods
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

describe('TalkTrackDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders weekly summary button', () => {
    render(<TalkTrackDownload weekStart="2026-04-21" />);
    expect(screen.getByRole('button', { name: /weekly summary/i })).toBeDefined();
  });

  it('renders mid-week update button when isLiveWeek is true', () => {
    render(<TalkTrackDownload weekStart="2026-04-21" isLiveWeek />);
    expect(screen.getByRole('button', { name: /mid-week update/i })).toBeDefined();
  });

  it('shows "in progress" suffix in modal header when live', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { talkTrack: 'Mid-week text.' }, error: null }),
    });

    render(<TalkTrackDownload weekStart="2026-04-21" isLiveWeek />);
    fireEvent.click(screen.getByRole('button', { name: /mid-week update/i }));

    await waitFor(() => {
      expect(screen.getByText(/Week of 2026-04-21 \(in progress\)/)).toBeDefined();
    });
  });

  it('shows loading state during generation', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    render(<TalkTrackDownload weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button', { name: /weekly summary/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /weekly summary/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/export/talk-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: '2026-04-21' }),
      });
    });
  });

  it('opens modal with talk track content on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { talkTrack: 'This was a strong week.' }, error: null }),
    });

    render(<TalkTrackDownload weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button', { name: /weekly summary/i }));

    await waitFor(() => {
      expect(screen.getByText('This was a strong week.')).toBeDefined();
      expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
    });
  });

  it('shows week label in modal header', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { talkTrack: 'Content.' }, error: null }),
    });

    render(<TalkTrackDownload weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button', { name: /weekly summary/i }));

    await waitFor(() => {
      expect(screen.getByText('Week of 2026-04-21')).toBeDefined();
    });
  });

  it('copies content to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { talkTrack: 'Copy this text.' }, error: null }),
    });

    render(<TalkTrackDownload weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button', { name: /weekly summary/i }));

    await waitFor(() => {
      expect(screen.getByText('Copy this text.')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Copy'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('Copy this text.');
      expect(screen.getByText('Copied')).toBeDefined();
    });
  });

  it('reopens modal without regenerating if talk track already exists', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { talkTrack: 'Cached content.' }, error: null }),
    });

    render(<TalkTrackDownload weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button', { name: /weekly summary/i }));

    await waitFor(() => {
      expect(screen.getByText('Cached content.')).toBeDefined();
    });

    // Close and reopen
    fireEvent.click(screen.getByLabelText('Close'));
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByRole('button', { name: /weekly summary/i }));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Cached content.')).toBeDefined();
  });

  it('shows error message on failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ data: null, error: { message: 'API key missing' } }),
    });

    render(<TalkTrackDownload weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button', { name: /weekly summary/i }));

    await waitFor(() => {
      expect(screen.getByText('API key missing')).toBeDefined();
    });
  });

  it('resets button after successful generation', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { talkTrack: 'Generated text.' }, error: null }),
    });

    render(<TalkTrackDownload weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button', { name: /weekly summary/i }));

    await waitFor(() => {
      expect(screen.getByText('Weekly Summary')).toBeDefined();
    });
  });
});
