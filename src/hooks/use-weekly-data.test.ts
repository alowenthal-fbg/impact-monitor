import { describe, it, expect } from 'vitest';

// Test the WoW calculation logic directly
function calcWow(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

describe('WoW calculation', () => {
  it('calculates positive percentage change', () => {
    expect(calcWow(110, 100)).toBe(10);
  });

  it('calculates negative percentage change', () => {
    expect(calcWow(90, 100)).toBe(-10);
  });

  it('returns null when previous is zero', () => {
    expect(calcWow(100, 0)).toBeNull();
  });

  it('returns null when current is null', () => {
    expect(calcWow(null, 100)).toBeNull();
  });

  it('returns null when previous is null', () => {
    expect(calcWow(100, null)).toBeNull();
  });

  it('returns 0 when values are equal', () => {
    expect(calcWow(100, 100)).toBe(0);
  });
});
