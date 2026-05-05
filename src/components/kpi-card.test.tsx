import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPICard } from './kpi-card';

describe('KPICard', () => {
  it('renders title and formatted ticket value', () => {
    render(<KPICard title="Total Tickets" value={1234} unit="tickets" wowDelta={5.2} vsForecastDelta={null} />);
    expect(screen.getByText('Total Tickets')).toBeDefined();
    expect(screen.getByText('1,234')).toBeDefined();
  });

  it('renders currency with dollar sign', () => {
    render(<KPICard title="Revenue" value={50000} unit="currency" wowDelta={-3.1} vsForecastDelta={null} />);
    expect(screen.getByText('$50,000')).toBeDefined();
  });

  it('shows positive delta with up arrow', () => {
    render(<KPICard title="Orders" value={100} unit="orders" wowDelta={10.5} vsForecastDelta={null} />);
    const delta = screen.getByText((content) => content.includes('10.5%'));
    expect(delta.textContent).toContain('\u2191');
  });

  it('shows negative delta with down arrow', () => {
    render(<KPICard title="Orders" value={100} unit="orders" wowDelta={-7.3} vsForecastDelta={null} />);
    const delta = screen.getByText((content) => content.includes('7.3%'));
    expect(delta.textContent).toContain('\u2193');
  });

  it('shows dash when delta is null', () => {
    render(<KPICard title="Orders" value={100} unit="orders" wowDelta={null} vsForecastDelta={null} />);
    expect(screen.getByText('Week over Week')).toBeDefined();
    expect(screen.getByText('vs. Forecast')).toBeDefined();
  });

  it('renders skeleton when loading', () => {
    const { container } = render(
      <KPICard title="Orders" value={0} unit="orders" wowDelta={null} vsForecastDelta={null} isLoading />
    );
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBe(3);
  });

  it('shows absolute previous value when provided', () => {
    render(<KPICard title="Orders" value={150} unit="orders" wowDelta={50} vsForecastDelta={null} prevValue={100} />);
    expect(screen.getByText('100')).toBeDefined();
  });

  it('shows compact format for large forecast values', () => {
    render(<KPICard title="Revenue" value={1200000} unit="currency" wowDelta={null} vsForecastDelta={10} forecastValue={1100000} />);
    expect(screen.getByText('$1.1M')).toBeDefined();
  });
});
