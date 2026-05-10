import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPreflight } from '../../src/commands/preflight.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const validGame = path.join(fixturesDir, 'valid-douyin-game');

describe('runPreflight (fixture)', () => {
  it('passes for the douyin fixture', async () => {
    const result = await runPreflight({ projectRoot: validGame, platform: 'douyin' });
    expect(result.issues).toEqual([]);
  });

  it('reports missing materials for vivo on the douyin-only fixture', async () => {
    const result = await runPreflight({ projectRoot: validGame, platform: 'vivo' });
    expect(result.issues.some((i) => i.code === 'MISSING_MATERIALS')).toBe(true);
  });
});
