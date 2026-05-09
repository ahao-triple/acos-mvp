import { describe, expect, it } from 'vitest';

import { BOARD_BOX, boardLayout, designToCanvas, viewportScale } from '../render/layout';

describe('canvas layout', () => {
  it('scales the 750 x 1334 design into the viewport', () => {
    expect(viewportScale(375, 667)).toBeCloseTo(0.5, 2);
  });

  it('centers non-square boards inside the safe board box', () => {
    const layout = boardLayout({ width: 5, height: 10 });

    expect(layout.cellSize).toBeGreaterThan(0);
    expect(layout.width).toBeLessThanOrEqual(660);
    expect(layout.height).toBeLessThanOrEqual(660);
    expect(layout.x).toBeGreaterThan(45);
    expect(layout.y).toBeGreaterThanOrEqual(BOARD_BOX.y);
  });

  it('keeps the board panel below the level header and progress bar', () => {
    expect(BOARD_BOX.y).toBeGreaterThanOrEqual(280);
  });

  it('maps design coordinates into backing canvas coordinates', () => {
    expect(designToCanvas({ x: 100, y: 200 }, { scale: 2, offsetX: 10, offsetY: 20 })).toEqual({ x: 220, y: 440 });
  });
});
