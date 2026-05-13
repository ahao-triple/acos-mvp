import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGameConfig } from '../../src/core/config.js';
import { isUserError } from '../../src/shared/errors.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const validGame = path.join(fixturesDir, 'valid-vivo-game');

async function expectUserError(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toSatisfy((error) => isUserError(error));
}

describe('loadGameConfig', () => {
  it('loads game.config.ts and vivo materials.ts', async () => {
    const loaded = await loadGameConfig({
      projectRoot: validGame,
      platform: 'vivo',
    });

    expect(loaded.game.title).toBe('Fixture Game');
    expect(loaded.platform).toBe('vivo');
    expect(loaded.vivoMaterials?.packageName).toBe('com.example.fixture');
    expect(loaded.paths.channelRoot).toBe(path.join(validGame, 'channels/vivo'));
    expect(loaded.paths.materialsAbs).toBe(path.join(validGame, 'channels/vivo/materials.ts'));
    expect(loaded.paths.iconAbs).toBe(path.join(validGame, 'channels/vivo/icon.png'));
    expect(loaded.paths.outDirAbs).toBe(path.join(validGame, 'channels/vivo/build'));
    expect(loaded.paths.entryAbs).toBe(path.join(validGame, 'game/main.ts'));
    expect(loaded.paths.publicDirAbs).toBe(path.join(validGame, 'game/public-pack'));
  });

  it('throws UserError when channels/<platform>/materials.ts is missing', async () => {
    await expectUserError(loadGameConfig({
      projectRoot: path.join(fixturesDir, 'missing-entry'),
      platform: 'vivo',
    }));
  });

  it('throws UserError when project root has no game.config.ts', async () => {
    await expectUserError(loadGameConfig({
      projectRoot: fixturesDir,
      platform: 'vivo',
    }));
  });
});
