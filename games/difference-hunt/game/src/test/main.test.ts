import { describe, expect, test } from 'vitest';

import { resolveAssetBase, resolveRuntimeCanvasSize, selectRendererKind } from '../main';
import type { MiniPackGameRuntime } from '../platform/minipack';

describe('resolveRuntimeCanvasSize', () => {
  test('keeps vivo canvas dimensions at the native window size', () => {
    const originalQg = (globalThis as typeof globalThis & { qg?: { getSystemInfoSync?: () => unknown } }).qg;
    (globalThis as typeof globalThis & { qg?: { getSystemInfoSync?: () => unknown } }).qg = {
      getSystemInfoSync() {
        return {
          windowWidth: 1396,
          windowHeight: 2480,
          pixelRatio: 2,
        };
      },
    };

    try {
      const size = resolveRuntimeCanvasSize({
        width: 750,
        height: 1334,
      } as HTMLCanvasElement);

      expect(size).toEqual({
        width: 1396,
        height: 2480,
        dpr: 1,
      });
    } finally {
      (globalThis as typeof globalThis & { qg?: typeof originalQg }).qg = originalQg;
    }
  });
});

describe('mini-pack runtime bootstrap', () => {
  test('uses the WebGL renderer when the platform requests it', () => {
    expect(selectRendererKind({ renderMode: 'webgl' } as MiniPackGameRuntime)).toBe('webgl');
  });

  test('uses the canvas renderer by default', () => {
    expect(selectRendererKind({} as MiniPackGameRuntime)).toBe('canvas');
  });

  test('does not add an extra assets/ prefix for packaged mini-game resources', () => {
    expect(resolveAssetBase({} as MiniPackGameRuntime)).toBe('');
  });

  test('keeps browser assets rooted at the web public path', () => {
    expect(resolveAssetBase()).toBe('/');
  });
});
