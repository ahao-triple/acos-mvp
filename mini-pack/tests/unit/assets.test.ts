import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';

import { copyAssets } from '../../src/core/assets.js';

const tmpRoot = fileURLToPath(new URL('../tmp/assets/', import.meta.url));

afterEach(async () => {
  await fs.rm(tmpRoot, { force: true, recursive: true });
});

describe('copyAssets', () => {
  test('copies assets recursively and returns file statistics', async () => {
    const source = path.join(tmpRoot, 'source');
    const destination = path.join(tmpRoot, 'destination');
    await fs.mkdir(path.join(source, 'nested'), { recursive: true });
    await fs.writeFile(path.join(source, 'piece-shield.txt'), 'shield');
    await fs.writeFile(path.join(source, 'nested/readme.txt'), 'nested asset');

    const stats = await copyAssets({
      sourceDir: source,
      destinationDir: destination,
    });

    await expect(fs.readFile(path.join(destination, 'piece-shield.txt'), 'utf8')).resolves.toBe('shield');
    await expect(fs.readFile(path.join(destination, 'nested/readme.txt'), 'utf8')).resolves.toBe('nested asset');
    expect(stats).toEqual({
      count: 2,
      bytes: Buffer.byteLength('shield') + Buffer.byteLength('nested asset'),
    });
  });
});
