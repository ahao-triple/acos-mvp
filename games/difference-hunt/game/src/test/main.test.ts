import { describe, expect, test } from 'vitest';

import { resolveRuntimeCanvasSize } from '../main';

describe('resolveRuntimeCanvasSize', () => {
  test('uses the vivo window size normalized by dpr', () => {
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
        width: 698,
        height: 1240,
        dpr: 2,
      });
    } finally {
      (globalThis as typeof globalThis & { qg?: typeof originalQg }).qg = originalQg;
    }
  });
});
