import { describe, expect, it } from 'vitest';

import { createBoardCamera, panCamera, resetCamera, zoomCamera } from '../render/camera';

describe('board camera', () => {
  it('starts locked at 1x for early levels', () => {
    expect(createBoardCamera({ levelNo: 2, allowPan: false, allowZoom: false })).toMatchObject({
      scale: 1,
      minScale: 1,
      maxScale: 1,
      canPan: false,
      canZoom: false,
    });
  });

  it('clamps zoom and pan for later boards', () => {
    const camera = createBoardCamera({ levelNo: 12, allowPan: true, allowZoom: true });
    const zoomed = zoomCamera(camera, 4, { x: 330, y: 330 });
    const panned = panCamera(zoomed, { dx: 1000, dy: -1000 });

    expect(zoomed.scale).toBe(2.2);
    expect(Math.abs(panned.x)).toBeLessThanOrEqual(396);
    expect(Math.abs(panned.y)).toBeLessThanOrEqual(396);
  });

  it('resets to the initial centered camera', () => {
    const camera = panCamera(zoomCamera(createBoardCamera({ levelNo: 12, allowPan: true, allowZoom: true }), 1.8, { x: 0, y: 0 }), {
      dx: 120,
      dy: 80,
    });

    expect(resetCamera(camera)).toMatchObject({ scale: 1, x: 0, y: 0 });
  });
});
