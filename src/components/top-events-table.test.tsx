import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TopEventsTable } from './top-events-table';

afterEach(cleanup);

describe('TopEventsTable', () => {
  const mockEvents = [
    { sport: 'NFL', event_name: 'Super Bowl LVIII', gtv: 125000.5 },
    { sport: 'NBA', event_name: 'Finals Game 7', gtv: 85000 },
    { sport: 'MLB', event_name: 'World Series G1', gtv: 45000.25 },
  ];

  it('renders table with event data', () => {
    render(<TopEventsTable events={mockEvents} />);

    expect(screen.getByText('Super Bowl LVIII')).toBeDefined();
    expect(screen.getByText('Finals Game 7')).toBeDefined();
    expect(screen.getByText('World Series G1')).toBeDefined();
  });

  it('formats GTV as currency', () => {
    const { container } = render(<TopEventsTable events={mockEvents} />);
    const cells = container.querySelectorAll('td.text-right');
    expect(cells[0].textContent).toContain('125,000.50');
    expect(cells[1].textContent).toContain('85,000.00');
    expect(cells[2].textContent).toContain('45,000.25');
  });

  it('renders three column headers', () => {
    render(<TopEventsTable events={mockEvents} />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
  });

  it('shows loading skeleton', () => {
    const { container } = render(<TopEventsTable events={[]} isLoading={true} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(5);
  });

  it('shows empty state when no events', () => {
    render(<TopEventsTable events={[]} />);
    expect(screen.getByText('No events found for this week.')).toBeDefined();
  });
});
