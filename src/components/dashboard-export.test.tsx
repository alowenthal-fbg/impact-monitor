import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { DashboardExport } from './dashboard-export';

const mockToPng = vi.fn();

vi.mock('html-to-image', () => ({
  toPng: (...args: unknown[]) => mockToPng(...args),
}));

afterEach(cleanup);

describe('DashboardExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure only one export target exists
    document.querySelectorAll('#dashboard-export-target').forEach((el) => el.remove());
    const target = document.createElement('div');
    target.id = 'dashboard-export-target';
    document.body.appendChild(target);
  });

  it('renders export button', () => {
    render(<DashboardExport weekStart="2026-04-21" />);
    expect(screen.getByText('Export PNG')).toBeDefined();
  });

  it('shows loading state during export', async () => {
    mockToPng.mockReturnValue(new Promise(() => {}));

    render(<DashboardExport weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Exporting...')).toBeDefined();
    });
  });

  it('calls toPng with correct options on click', async () => {
    mockToPng.mockResolvedValue('data:image/png;base64,abc123');

    render(<DashboardExport weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockToPng).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        })
      );
    });
  });

  it('resets button state after export completes', async () => {
    mockToPng.mockResolvedValue('data:image/png;base64,abc123');

    render(<DashboardExport weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Export PNG')).toBeDefined();
    });
  });

  it('handles export failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockToPng.mockRejectedValue(new Error('Canvas failed'));

    render(<DashboardExport weekStart="2026-04-21" />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
      expect(screen.getByText('Export PNG')).toBeDefined();
    });

    consoleSpy.mockRestore();
  });
});
