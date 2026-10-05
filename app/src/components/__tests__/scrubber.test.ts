import { nearestIndex } from '../charts';

describe('nearestIndex', () => {
  it('maps the ends of the chart to the first and last point', () => {
    expect(nearestIndex(0, 300, 7)).toBe(0);
    expect(nearestIndex(300, 300, 7)).toBe(6);
  });

  it('rounds to the nearest sample rather than flooring', () => {
    expect(nearestIndex(70, 300, 7)).toBe(1);
    expect(nearestIndex(80, 300, 7)).toBe(2);
  });

  it('clamps touches outside the chart', () => {
    expect(nearestIndex(-40, 300, 7)).toBe(0);
    expect(nearestIndex(900, 300, 7)).toBe(6);
  });

  it('is safe with degenerate inputs', () => {
    expect(nearestIndex(50, 0, 7)).toBe(0);
    expect(nearestIndex(50, 300, 1)).toBe(0);
    expect(nearestIndex(50, 300, 0)).toBe(0);
  });
});
