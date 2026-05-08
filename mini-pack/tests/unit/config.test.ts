import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { loadGameConfig } from '../../src/core/config.js';
import { UserError } from '../../src/shared/errors.js';

const envFilesToRemove: string[] = [];

afterEach(async () => {
  await Promise.all(envFilesToRemove.splice(0).map((file) => fs.rm(file, { force: true })));
});

describe('loadGameConfig', () => {
  test('loads a valid Douyin config and resolves paths', async () => {
    const config = await loadGameConfig({
      projectRoot: fixturePath('valid-douyin-game'),
      platform: 'douyin',
    });

    expect(config.title).toBe('共联防线');
    expect(config.platform).toBe('douyin');
    expect(config.entry).toBe('game/src/main.ts');
    expect(config.publicDir).toBe('game/public');
    expect(config.outDir).toBe('builds/douyin');
    expect(config.paths.entryAbs).toBe(path.join(fixturePath('valid-douyin-game'), 'game/src/main.ts'));
    expect(config.paths.publicDirAbs).toBe(path.join(fixturePath('valid-douyin-game'), 'game/public'));
    expect(config.paths.outDirAbs).toBe(path.join(fixturePath('valid-douyin-game'), 'builds/douyin'));
    expect(config.paths.douyinMaterialsAbs).toBe(
      path.join(fixturePath('valid-douyin-game'), 'platform/douyin/materials'),
    );
  });

  test('rejects a missing entry file with an actionable error', async () => {
    await expect(
      loadGameConfig({
        projectRoot: fixturePath('missing-entry'),
        platform: 'douyin',
      }),
    ).rejects.toMatchObject({
      name: 'UserError',
      exitCode: 1,
    });
  });

  test('rejects unsafe output directories inside source trees', async () => {
    await expect(
      loadGameConfig({
        projectRoot: fixturePath('valid-douyin-game'),
        platform: 'douyin',
        overrides: {
          outDir: 'game/builds',
        },
      }),
    ).rejects.toBeInstanceOf(UserError);
  });

  test('loads Douyin appid from the project .env before importing game.config.ts', async () => {
    const projectRoot = fixturePath('valid-douyin-game');
    const envFile = path.join(projectRoot, '.env');
    envFilesToRemove.push(envFile);
    await fs.writeFile(envFile, 'DOUYIN_APPID=tt-test-appid\n');

    const config = await loadGameConfig({
      projectRoot,
      platform: 'douyin',
    });

    expect(config.douyin.appid).toBe('tt-test-appid');
  });
});

function fixturePath(name: string): string {
  return path.resolve(new URL(`../fixtures/${name}/`, import.meta.url).pathname);
}
