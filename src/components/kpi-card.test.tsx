import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPICard } from './kpi-card';

describe('KPICard', () => {
  it('renders title and formatted ticket value', () => {
    render(<KPICard title="Total Tickets" value={1234} unit="tickets" wowDelta={5.2} />);
    expect(screen.getByText('Total Tickets')).toBeDefined();
    expect(screen.getByText('1,234')).toBeDefined();
  });

  it('renders currency with dollar sign', () => {
    render(<KPICard title="Revenue" value={50000} unit="currency" wowDelta={-3.1} />);
    expect(screen.getByText('$50,000')).toBeDefined();
  });

  it('shows positive delta with up arrow', () => {
    render(<KPICard title="Orders" value={100} unit="orders" wowDelta={10.5} />);
    const delta = screen.getByText((content) => content.includes('10.5%'));
    expect(delta.textContent).toContain('↑');
  });

  it('shows negative delta with down arrow', () => {
    render(<KPICard title="Orders" value={100} unit="orders" wowDelta={-7.3} />);
    const delta = screen.getByText((content) => content.includes('7.3%'));
    expect(delta.textContent).toContain('↓');
  });

  it('shows no prior week message when delta is null', () => {
    render(<KPICard title="Orders" value={100} unit="orders" wowDelta={null} />);
    expect(screen.getByText('No prior week data')).toBeDefined();
  });

  it('renders skeleton when loading', () => {
    const { container } = render(
      <KPICard title="Orders" value={0} unit="orders" wowDelta={null} isLoading />
    );
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBe(3);
  });
});
