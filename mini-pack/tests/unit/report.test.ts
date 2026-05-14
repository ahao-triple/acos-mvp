import { describe, expect, test } from 'vitest';

import { createBuildReport } from '../../src/core/report.js';

describe('createBuildReport', () => {
  test('creates the documented report shape', () => {
    const report = createBuildReport({
      platform: 'vivo',
      title: '全民爆梗游戏软件',
      entry: 'game/src/main.ts',
      publicDir: 'game/public',
      outDir: 'builds/vivo',
      bundleBytes: 42,
      assetCount: 2,
      assetBytes: 18,
    });

    expect(report).toEqual({
      tool: 'mini-pack',
      platform: 'vivo',
      title: '全民爆梗游戏软件',
      entry: 'game/src/main.ts',
      publicDir: 'game/public',
      outDir: 'builds/vivo',
      bundle: {
        file: 'game.js',
        bytes: 42,
      },
      assets: {
        count: 2,
        bytes: 18,
      },
      warnings: [],
    });
  });

  test('adds non-blocking warnings for large outputs', () => {
    const report = createBuildReport({
      platform: 'vivo',
      title: '全民爆梗游戏软件',
      entry: 'game/src/main.ts',
      publicDir: 'game/public',
      outDir: 'builds/vivo',
      bundleBytes: 2 * 1024 * 1024 + 1,
      assetCount: 2,
      assetBytes: 13 * 1024 * 1024,
    });

    expect(report.warnings).toEqual([
      'game.js is larger than 2 MB.',
      'assets are larger than 10 MB.',
      'total output is larger than 15 MB.',
    ]);
  });
});
