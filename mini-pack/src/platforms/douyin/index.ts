import fs from 'fs-extra';
import path from 'node:path';

import { copyAssets } from '../../core/assets.js';
import { bundleGameEntry } from '../../core/bundle.js';
import { createBuildReport, writeBuildReport } from '../../core/report.js';
import { UserError } from '../../shared/errors.js';
import type { BuildReport, LoadedGameConfig } from '../../shared/types.js';
import type { PlatformBuilder } from '../index.js';
import { createGameJson, createProjectConfigJson, renderDouyinGameJs } from './template.js';

export const douyinPlatformBuilder: PlatformBuilder = {
  name: 'douyin',

  async build(loaded: LoadedGameConfig): Promise<BuildReport> {
    if (loaded.platform !== 'douyin') {
      throw new UserError(`Douyin builder cannot build platform: ${loaded.platform}`);
    }

    const outDir = loaded.paths.outDirAbs;
    await fs.remove(outDir);
    await fs.ensureDir(outDir);

    await fs.writeJson(path.join(outDir, 'game.json'), createGameJson(loaded), { spaces: 2 });
    await fs.writeJson(path.join(outDir, 'project.config.json'), createProjectConfigJson(loaded), { spaces: 2 });

    const tempDir = path.join(outDir, '.mini-pack');
    const tempBundle = path.join(tempDir, 'game.bundle.js');
    await bundleGameEntry({
      entryAbs: loaded.paths.entryAbs,
      outfile: tempBundle,
    });

    const bundleCode = await fs.readFile(tempBundle, 'utf8');
    const finalGameJs = renderDouyinGameJs(bundleCode, loaded);
    const gameJsPath = path.join(outDir, 'game.js');
    await fs.writeFile(gameJsPath, finalGameJs);
    await fs.remove(tempDir);

    const assetStats = await copyAssets({
      sourceDir: loaded.paths.publicDirAbs,
      destinationDir: path.join(outDir, 'assets'),
    });
    const bundleStats = await fs.stat(gameJsPath);

    const reportOutDir = path.relative(loaded.projectRoot, outDir).split(path.sep).join('/');

    const report = createBuildReport({
      platform: 'douyin',
      title: loaded.game.title,
      entry: loaded.game.entry,
      publicDir: loaded.game.publicDir,
      outDir: reportOutDir,
      bundleBytes: bundleStats.size,
      assetCount: assetStats.count,
      assetBytes: assetStats.bytes,
    });

    await writeBuildReport(path.join(outDir, 'build-report.json'), report);
    return report;
  },
};
