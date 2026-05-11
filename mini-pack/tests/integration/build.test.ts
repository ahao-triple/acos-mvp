import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { runBuildCommand } from '../../src/commands/build.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const fixtureRoot = path.join(fixturesDir, 'valid-douyin-game');

describe('runBuildCommand (fixture)', () => {
  afterEach(async () => {
    await fs.rm(path.join(fixtureRoot, 'channels/douyin/build'), { recursive: true, force: true });
    await fs.rm(path.join(fixtureRoot, 'channels/kuaishou/build'), { recursive: true, force: true });
  });

  it('builds the douyin package into channels/douyin/build/', async () => {
    await runBuildCommand({ platform: 'douyin', projectRoot: fixtureRoot });
    const outDir = path.join(fixtureRoot, 'channels/douyin/build');
    const entries = await fs.readdir(outDir);
    expect(entries.sort()).toEqual(
      ['assets', 'build-report.json', 'game.js', 'game.json', 'project.config.json'].sort(),
    );
  });

  it('builds the kuaishou package into channels/kuaishou/build/', async () => {
    await runBuildCommand({ platform: 'kuaishou', projectRoot: fixtureRoot });
    const outDir = path.join(fixtureRoot, 'channels/kuaishou/build');
    const entries = await fs.readdir(outDir);
    expect(entries.sort()).toEqual(
      ['assets', 'build-report.json', 'game.js', 'game.json', 'project.config.json'].sort(),
    );
  });
});

describe('runBuildCommand vivo (fixture, fake rpk)', () => {
  // TODO(channels-migration): add valid-vivo-game fixture and re-enable.
  it.skip('builds the vivo package with fake rpk', async () => {
    // Awaiting a vivo channel fixture before this case can run.
  });
});
