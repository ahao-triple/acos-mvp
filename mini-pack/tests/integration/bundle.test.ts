import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';

import { bundleGameEntry } from '../../src/core/bundle.js';

const tmpRoot = fileURLToPath(new URL('../tmp/bundle/', import.meta.url));

afterEach(async () => {
  await fs.rm(tmpRoot, { force: true, recursive: true });
});

describe('bundleGameEntry', () => {
  test('bundles a TypeScript game entry into a JavaScript file', async () => {
    const outfile = path.join(tmpRoot, 'game.bundle.mjs');
    const result = await bundleGameEntry({
      entryAbs: path.join(fixturePath('valid-vivo-game'), 'game/main.ts'),
      outfile,
      platform: 'vivo',
    });

    const output = await fs.readFile(outfile, 'utf8');
    expect(result.bytes).toBeGreaterThan(0);
    expect(output).toContain('createGame');
  });

  test('downlevels ES2020 syntax for mini game runtimes', async () => {
    const entry = path.join(tmpRoot, 'modern-entry.ts');
    const outfile = path.join(tmpRoot, 'modern-entry.bundle.js');
    await fs.mkdir(tmpRoot, { recursive: true });
    await fs.writeFile(
      entry,
      `
export function createGame(runtime: any) {
  const config: any = {};
  const label = config?.sidebar?.label ?? 'fallback';
  return {
    start() {
      runtime.logger.info(label);
    },
    pause() {},
    resume() {},
    destroy() {},
  };
}
`,
    );

    await bundleGameEntry({ entryAbs: entry, outfile, platform: 'vivo' });

    const output = await fs.readFile(outfile, 'utf8');
    expect(output).not.toMatch(/\?\.(?!\d)|\?\?/);
  });
});

function fixturePath(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}/`, import.meta.url));
}
