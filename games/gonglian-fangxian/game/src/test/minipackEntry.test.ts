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

  test('uses vivo system size for runtime canvas sizing', () => {
    vi.stubGlobal('qg', {
      getSystemInfoSync() {
        return {
          windowWidth: 393,
          windowHeight: 852,
        };
      },
    });

    expect(resolveRuntimeCanvasSize({ width: 0, height: 0 } as HTMLCanvasElement)).toEqual({
      width: 393,
      height: 852,
      dpr: 1,
    });
  });
});
