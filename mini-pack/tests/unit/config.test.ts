import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGameConfig } from '../../src/core/config.js';
import { isUserError } from '../../src/shared/errors.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const validGame = path.join(fixturesDir, 'valid-douyin-game');

describe('loadGameConfig', () => {
  it('loads game.config.ts and douyin materials.ts', async () => {
    const loaded = await loadGameConfig({
      projectRoot: validGame,
      platform: 'douyin',
    });

    expect(loaded.game.title).toBe('Fixture Game');
    expect(loaded.platform).toBe('douyin');
    expect(loaded.douyinMaterials?.appid).toBe('tt-fixture-appid');
    expect(loaded.douyinMaterials?.projectName).toBe('fixture');
    expect(loaded.paths.channelRoot).toBe(path.join(validGame, 'channels/douyin'));
    expect(loaded.paths.materialsAbs).toBe(path.join(validGame, 'channels/douyin/materials.ts'));
    expect(loaded.paths.iconAbs).toBe(path.join(validGame, 'channels/douyin/icon.png'));
    expect(loaded.paths.outDirAbs).toBe(path.join(validGame, 'channels/douyin/build'));
    expect(loaded.paths.entryAbs).toBe(path.join(validGame, 'game/main.ts'));
    expect(loaded.paths.publicDirAbs).toBe(path.join(validGame, 'game/public-pack'));
  });

  it('throws UserError when channels/<platform>/materials.ts is missing', async () => {
    await expect(
      loadGameConfig({
        projectRoot: validGame,
        platform: 'vivo', // valid fixture has no vivo channel
      }),
    ).rejects.toSatisfy((error) => isUserError(error));
  });

  it('throws UserError when project root has no game.config.ts', async () => {
    await expect(
      loadGameConfig({
        projectRoot: fixturesDir, // not a project
        platform: 'douyin',
      }),
    ).rejects.toSatisfy((error) => isUserError(error));
  });
});
