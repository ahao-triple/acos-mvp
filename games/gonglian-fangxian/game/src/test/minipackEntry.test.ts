import { afterEach, describe, expect, test, vi } from 'vitest';

import { resolveRuntimeCanvasSize } from '../main';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mini-pack entry contract', () => {
  test('exports createGame without requiring a browser canvas during import', async () => {
    const entry = await import('../main');

    expect(typeof entry.createGame).toBe('function');
  });

  test('uses mini game system pixel ratio for runtime canvas sizing', () => {
    vi.stubGlobal('tt', {
      getSystemInfoSync() {
        return {
          windowWidth: 393,
          windowHeight: 852,
          pixelRatio: 3,
        };
      },
    });

    expect(resolveRuntimeCanvasSize({ width: 0, height: 0 } as HTMLCanvasElement)).toEqual({
      width: 393,
      height: 852,
      dpr: 3,
    });
  });
});
