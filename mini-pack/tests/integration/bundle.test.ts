import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { bundleGameEntry } from '../../src/core/bundle.js';

const tmpRoot = path.resolve(new URL('../tmp/bundle', import.meta.url).pathname);

afterEach(async () => {
  await fs.rm(tmpRoot, { force: true, recursive: true });
});

describe('bundleGameEntry', () => {
  test('bundles a TypeScript game entry into a JavaScript file', async () => {
    const outfile = path.join(tmpRoot, 'game.bundle.mjs');
    const result = await bundleGameEntry({
      entryAbs: path.join(fixturePath('valid-douyin-game'), 'game/src/main.ts'),
      outfile,
    });

    const output = await fs.readFile(outfile, 'utf8');
    expect(result.bytes).toBeGreaterThan(0);
    expect(output).toContain('createGame');
  });

  test('downlevels ES2020 syntax unsupported by the Douyin upload compiler', async () => {
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

    await bundleGameEntry({ entryAbs: entry, outfile });

    const output = await fs.readFile(outfile, 'utf8');
    expect(output).not.toMatch(/\?\.(?!\d)|\?\?/);
  });
});

function fixturePath(name: string): string {
  return path.resolve(new URL(`../fixtures/${name}/`, import.meta.url).pathname);
}
