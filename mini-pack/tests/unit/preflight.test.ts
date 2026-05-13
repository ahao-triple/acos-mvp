import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPreflight } from '../../src/commands/preflight.js';

const indexPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/index');

async function makeProject(opts: {
  withGameConfig?: boolean;
}): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
  await fs.mkdir(path.join(root, 'game'), { recursive: true });
  await fs.mkdir(path.join(root, 'game/public-pack'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'game/main.ts'),
    'export function createGame(){return{start(){},pause(){},resume(){},destroy(){}};}',
  );

  if (opts.withGameConfig !== false) {
    await fs.writeFile(
      path.join(root, 'game.config.ts'),
      `import { defineGameConfig } from '${indexPath}';
       export default defineGameConfig({
         title: 'T', entry: 'game/main.ts', publicDir: 'game/public-pack',
         orientation: 'portrait', canvas: { width: 1, height: 1 },
       });`,
    );
  }

  return root;
}

describe('runPreflight', () => {
  it('reports missing game.config.ts', async () => {
    const root = await makeProject({ withGameConfig: false });
    const result = await runPreflight({ projectRoot: root, platform: 'vivo' });
    expect(result.issues.some((i) => i.code === 'MISSING_GAME_CONFIG')).toBe(true);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('reports missing materials.ts', async () => {
    const root = await makeProject({});
    const result = await runPreflight({ projectRoot: root, platform: 'vivo' });
    expect(result.issues.some((i) => i.code === 'MISSING_MATERIALS')).toBe(true);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('reports empty rewardedAdUnitId', async () => {
    const root = await makeProject({});
    await fs.mkdir(path.join(root, 'channels/vivo'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'channels/vivo/materials.ts'),
      `import { defineVivoMaterials } from '${indexPath}';
       export default defineVivoMaterials({ packageName: 'com.example.fixture', rewardedAdUnitId: '', iconPath: 'icon.png' });`,
    );
    await fs.writeFile(path.join(root, 'channels/vivo/icon.png'), 'fakepng');

    const result = await runPreflight({ projectRoot: root, platform: 'vivo' });
    expect(result.issues.some((i) => i.code === 'EMPTY_FIELD' && i.message.includes('rewardedAdUnitId'))).toBe(true);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('collects multiple issues at once', async () => {
    const root = await makeProject({});
    const result = await runPreflight({ projectRoot: root, platform: 'vivo' });
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('passes with valid vivo setup', async () => {
    const root = await makeProject({});
    await fs.mkdir(path.join(root, 'channels/vivo'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'channels/vivo/materials.ts'),
      `import { defineVivoMaterials } from '${indexPath}';
       export default defineVivoMaterials({ packageName: 'com.example.fixture', iconPath: 'icon.png' });`,
    );
    await fs.writeFile(path.join(root, 'channels/vivo/icon.png'), 'fakepng');

    const result = await runPreflight({ projectRoot: root, platform: 'vivo' });
    expect(result.issues).toEqual([]);
    await fs.rm(root, { recursive: true, force: true });
  });
});
