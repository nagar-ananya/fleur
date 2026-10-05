import {
  THUMB_SIZE,
  positionFromValue,
  valueFromPosition,
} from '../inputs';

const WIDTH = 330;
const usable = WIDTH - THUMB_SIZE;

describe('positionFromValue', () => {
  it('pins the minimum to the left edge', () => {
    expect(positionFromValue(0, WIDTH, 0, 10)).toBe(0);
  });

  it('pins the maximum to the far edge, allowing for the thumb width', () => {
    expect(positionFromValue(10, WIDTH, 0, 10)).toBeCloseTo(usable, 6);
  });

  it('places the midpoint halfway', () => {
    expect(positionFromValue(5, WIDTH, 0, 10)).toBeCloseTo(usable / 2, 6);
  });

  it('clamps values outside the range instead of overflowing the track', () => {
    expect(positionFromValue(-4, WIDTH, 0, 10)).toBe(0);
    expect(positionFromValue(99, WIDTH, 0, 10)).toBeCloseTo(usable, 6);
  });

  it('never returns a negative offset on a track narrower than the thumb', () => {
    expect(positionFromValue(5, 10, 0, 10)).toBe(0);
  });
});

describe('valueFromPosition', () => {
  it('reads the minimum at the left edge and the maximum at the right', () => {
    expect(valueFromPosition(0, WIDTH, 0, 10, 1)).toBe(0);
    expect(valueFromPosition(WIDTH, WIDTH, 0, 10, 1)).toBe(10);
  });

  it('clamps beyond either end rather than running away', () => {
    expect(valueFromPosition(-500, WIDTH, 0, 10, 1)).toBe(0);
    expect(valueFromPosition(5000, WIDTH, 0, 10, 1)).toBe(10);
  });

  it('snaps to the step', () => {
    for (let x = 0; x <= WIDTH; x += 7) {
      const value = valueFromPosition(x, WIDTH, 0, 12, 0.5);
      expect(value * 2).toBe(Math.round(value * 2));
    }
  });

  it('respects a non-zero minimum', () => {
    expect(valueFromPosition(0, WIDTH, 5, 15, 1)).toBe(5);
    expect(valueFromPosition(WIDTH, WIDTH, 5, 15, 1)).toBe(15);
  });
});

describe('round trip', () => {
  it.each([
    ['severity 0-10', 0, 10, 1],
    ['water 0-15', 0, 15, 1],
    ['sleep 0-12 by halves', 0, 12, 0.5],
    ['alcohol 0-12 by halves', 0, 12, 0.5],
  ])('is stable for %s', (_label, min, max, step) => {
    for (let value = min; value <= max; value += step) {
      const left = positionFromValue(value, WIDTH, min, max);
      const centre = left + THUMB_SIZE / 2;
      expect(valueFromPosition(centre, WIDTH, min, max, step)).toBeCloseTo(value, 6);
    }
  });

  it('never collapses to the minimum in the upper half of the track', () => {
    for (let value = 8; value <= 15; value += 1) {
      const left = positionFromValue(value, WIDTH, 0, 15);
      const centre = left + THUMB_SIZE / 2;
      expect(valueFromPosition(centre, WIDTH, 0, 15, 1)).toBe(value);
    }
  });

  it('never goes down when dragging right', () => {
    let previous = -Infinity;
    for (let x = 0; x <= WIDTH; x += 3) {
      const value = valueFromPosition(x, WIDTH, 0, 15, 1);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});
