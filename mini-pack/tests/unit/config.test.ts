import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';

import { loadGameConfig } from '../../src/core/config.js';
import { UserError } from '../../src/shared/errors.js';

const envFilesToRemove: string[] = [];
const tempRootsToRemove: string[] = [];

afterEach(async () => {
  await Promise.all([
    ...envFilesToRemove.splice(0).map((file) => fs.rm(file, { force: true })),
    ...tempRootsToRemove.splice(0).map((dir) => fs.rm(dir, { force: true, recursive: true })),
  ]);
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

  test('loads a valid config as vivo when the CLI platform overrides the file platform', async () => {
    const config = await loadGameConfig({
      projectRoot: fixturePath('valid-douyin-game'),
      platform: 'vivo',
    });

    expect(config.title).toBe('共联防线');
    expect(config.platform).toBe('vivo');
    expect(config.entry).toBe('game/src/main.ts');
    expect(config.publicDir).toBe('game/public');
    expect(config.paths.entryAbs).toBe(path.join(fixturePath('valid-douyin-game'), 'game/src/main.ts'));
    expect(config.paths.publicDirAbs).toBe(path.join(fixturePath('valid-douyin-game'), 'game/public'));
    expect(config.paths.douyinMaterialsAbs).toBeUndefined();
  });

  test('requires Douyin materials only for Douyin builds', async () => {
    const projectRoot = await copyFixture('valid-douyin-game');
    const materialsDir = path.join(projectRoot, 'platform/douyin/materials');
    const hiddenDir = path.join(projectRoot, 'platform/douyin/materials-hidden-for-test');

    await fs.rename(materialsDir, hiddenDir);
    try {
      await expect(loadGameConfig({ projectRoot, platform: 'douyin' })).rejects.toMatchObject({
        name: 'UserError',
      });

      await expect(loadGameConfig({ projectRoot, platform: 'vivo' })).resolves.toMatchObject({
        platform: 'vivo',
      });
    } finally {
      await fs.rename(hiddenDir, materialsDir);
    }
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
    const projectRoot = await copyFixture('valid-douyin-game');
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
  return fileURLToPath(new URL(`../fixtures/${name}/`, import.meta.url));
}

async function copyFixture(name: string): Promise<string> {
  const tempParent = fileURLToPath(new URL('../tmp/', import.meta.url));
  await fs.mkdir(tempParent, { recursive: true });
  const tempRoot = await fs.mkdtemp(path.join(tempParent, `${name}-`));
  tempRootsToRemove.push(tempRoot);
  await fs.cp(fixturePath(name), tempRoot, { recursive: true });
  return tempRoot;
}
