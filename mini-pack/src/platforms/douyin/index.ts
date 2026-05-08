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

  async validate(config: LoadedGameConfig): Promise<void> {
    if (config.platform !== 'douyin') {
      throw new UserError(`Douyin builder cannot build platform: ${config.platform}`);
    }
  },

  async build(config: LoadedGameConfig): Promise<BuildReport> {
    await this.validate(config);

    const outDir = config.paths.outDirAbs;
    await fs.remove(outDir);
    await fs.ensureDir(outDir);

    await fs.writeJson(path.join(outDir, 'game.json'), createGameJson(config), { spaces: 2 });
    await fs.writeJson(path.join(outDir, 'project.config.json'), createProjectConfigJson(config), { spaces: 2 });

    const tempDir = path.join(outDir, '.mini-pack');
    const tempBundle = path.join(tempDir, 'game.bundle.js');
    await bundleGameEntry({
      entryAbs: config.paths.entryAbs,
      outfile: tempBundle,
    });

    const bundleCode = await fs.readFile(tempBundle, 'utf8');
    const finalGameJs = renderDouyinGameJs(bundleCode, config);
    const gameJsPath = path.join(outDir, 'game.js');
    await fs.writeFile(gameJsPath, finalGameJs);
    await fs.remove(tempDir);

    const assetStats = await copyAssets({
      sourceDir: config.paths.publicDirAbs,
      destinationDir: path.join(outDir, 'assets'),
    });
    const bundleStats = await fs.stat(gameJsPath);

    const report = createBuildReport({
      platform: 'douyin',
      title: config.title,
      entry: config.entry,
      publicDir: config.publicDir,
      outDir: config.outDir,
      bundleBytes: bundleStats.size,
      assetCount: assetStats.count,
      assetBytes: assetStats.bytes,
    });

    await writeBuildReport(path.join(outDir, 'build-report.json'), report);
    return report;
  },
};
