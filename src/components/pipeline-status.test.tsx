import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineStatus } from './pipeline-status';

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
}));

describe('PipelineStatus', () => {
  it('renders success state', () => {
    render(
      <PipelineStatus
        status="success"
        timestamp="2026-04-30T10:00:00Z"
      />
    );

    expect(screen.getByText('Pipeline Healthy')).toBeDefined();
    expect(screen.getByText('Last run: 2 hours ago')).toBeDefined();
  });

  it('renders partial state', () => {
    render(
      <PipelineStatus
        status="partial"
        timestamp="2026-04-30T10:00:00Z"
      />
    );

    expect(screen.getByText('Partial Success')).toBeDefined();
  });

  it('renders failed state with error message', () => {
    render(
      <PipelineStatus
        status="failed"
        timestamp="2026-04-30T10:00:00Z"
        errorMessage="Ticketmaster API timeout"
      />
    );

    expect(screen.getByText('Pipeline Failed')).toBeDefined();
    expect(screen.getByText('Ticketmaster API timeout')).toBeDefined();
  });

  it('renders loading skeleton', () => {
    const { container } = render(<PipelineStatus isLoading={true} />);
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('renders empty state when no data', () => {
    render(<PipelineStatus />);
    expect(screen.getByText('No pipeline data available')).toBeDefined();
  });
});
