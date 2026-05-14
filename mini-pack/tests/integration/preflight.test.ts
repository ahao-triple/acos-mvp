import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPreflight } from '../../src/commands/preflight.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const validGame = path.join(fixturesDir, 'valid-vivo-game');

describe('runPreflight (fixture)', () => {
  it('passes for the vivo fixture', async () => {
    const result = await runPreflight({ projectRoot: validGame, platform: 'vivo' });
    expect(result.issues).toEqual([]);
  });
});
