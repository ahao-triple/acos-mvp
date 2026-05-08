import { describe, expect, test } from 'vitest';
import { coverRect, fitLogicalCanvas, LOGICAL_HEIGHT, LOGICAL_WIDTH, toLogicalPoint } from '../render/scaler';

describe('canvas scaling', () => {
  test('uses 750x1334 logical canvas dimensions', () => {
    expect(LOGICAL_WIDTH).toBe(750);
    expect(LOGICAL_HEIGHT).toBe(1334);
  });

  test('fits logical canvas inside a same-ratio viewport', () => {
    const fit = fitLogicalCanvas(375, 667);

    expect(fit.scale).toBeCloseTo(0.5);
    expect(fit.offsetX).toBeCloseTo(0);
    expect(fit.offsetY).toBeCloseTo(0);
  });

  test('converts device coordinates back to logical coordinates', () => {
    const fit = fitLogicalCanvas(375, 667);

    expect(toLogicalPoint(187.5, 333.5, fit)).toEqual({ x: 375, y: 667 });
  });

  test('cover rect covers tall screens without black bars', () => {
    const rect = coverRect(900, 1600, 750, 1500);

    expect(rect.width).toBeGreaterThanOrEqual(750);
    expect(rect.height).toBeGreaterThanOrEqual(1500);
    expect(rect.x).toBeLessThanOrEqual(0);
    expect(rect.y).toBeLessThanOrEqual(0);
  });

  test('cover rect covers wide screens without black bars', () => {
    const rect = coverRect(900, 1600, 900, 1334);

    expect(rect.width).toBeGreaterThanOrEqual(900);
    expect(rect.height).toBeGreaterThanOrEqual(1334);
  });
});
