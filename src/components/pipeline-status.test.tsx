import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PipelineStatus } from './pipeline-status';

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 hours ago',
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('PipelineStatus', () => {
  it('renders success state', () => {
    render(
      <PipelineStatus
        status="success"
        timestamp="2026-04-30T10:00:00Z"
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('Pipeline Healthy')).toBeDefined();
    expect(screen.getByText('Last updated 2 hours ago')).toBeDefined();
  });

  it('renders partial state', () => {
    render(
      <PipelineStatus
        status="partial"
        timestamp="2026-04-30T10:00:00Z"
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('Partial Success')).toBeDefined();
  });

  it('renders failed state with error message', () => {
    render(
      <PipelineStatus
        status="failed"
        timestamp="2026-04-30T10:00:00Z"
        errorMessage="Ticketmaster API timeout"
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('Pipeline Failed')).toBeDefined();
    expect(screen.getByText('Ticketmaster API timeout')).toBeDefined();
  });

  it('renders loading skeleton', () => {
    const { container } = render(<PipelineStatus isLoading={true} />, { wrapper: Wrapper });
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('renders empty state when no data', () => {
    render(<PipelineStatus />, { wrapper: Wrapper });
    expect(screen.getByText('No pipeline data available')).toBeDefined();
  });

  it('renders refresh button', () => {
    render(
      <PipelineStatus
        status="success"
        timestamp="2026-04-30T10:00:00Z"
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getAllByTitle('Refresh data').length).toBeGreaterThan(0);
  });
});
