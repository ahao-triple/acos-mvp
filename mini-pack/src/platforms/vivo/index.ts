import fs from 'fs-extra';
import path from 'node:path';

import { copyAssets } from '../../core/assets.js';
import { bundleGameEntry } from '../../core/bundle.js';
import { createBuildReport, writeBuildReport } from '../../core/report.js';
import { UserError } from '../../shared/errors.js';
import type { BuildReport, LoadedGameConfig } from '../../shared/types.js';
import type { PlatformBuildOptions, PlatformBuilder } from '../index.js';
import { createVivoManifest, createVivoPackageJson, renderVivoGameJs } from './template.js';

export const vivoPlatformBuilder: PlatformBuilder = {
  name: 'vivo',

  async validate(config: LoadedGameConfig): Promise<void> {
    if (config.platform !== 'vivo') {
      throw new UserError(`Vivo builder cannot build platform: ${config.platform}`);
    }
  },

  async build(config: LoadedGameConfig, options: PlatformBuildOptions = {}): Promise<BuildReport> {
    await this.validate(config);

    const outDir = config.paths.outDirAbs;
    const srcDir = path.join(outDir, 'src');
    await fs.remove(outDir);
    await fs.ensureDir(srcDir);

    await fs.writeJson(path.join(outDir, 'package.json'), createVivoPackageJson(), { spaces: 2 });
    await fs.writeJson(path.join(srcDir, 'manifest.json'), createVivoManifest(config), { spaces: 2 });

    const tempDir = path.join(outDir, '.mini-pack');
    const tempBundle = path.join(tempDir, 'game.bundle.js');
    await bundleGameEntry({
      entryAbs: config.paths.entryAbs,
      outfile: tempBundle,
    });

    const bundleCode = await fs.readFile(tempBundle, 'utf8');
    const finalGameJs = renderVivoGameJs(bundleCode);
    const gameJsPath = path.join(srcDir, 'game.js');
    await fs.writeFile(gameJsPath, finalGameJs);
    await fs.remove(tempDir);

    const assetStats = await copyAssets({
      sourceDir: config.paths.publicDirAbs,
      destinationDir: path.join(srcDir, 'assets'),
    });
    const bundleStats = await fs.stat(gameJsPath);

    const report = createBuildReport({
      platform: 'vivo',
      title: config.title,
      entry: config.entry,
      publicDir: config.publicDir,
      outDir: config.outDir,
      bundleBytes: bundleStats.size,
      assetCount: assetStats.count,
      assetBytes: assetStats.bytes,
    });

    await writeBuildReport(path.join(outDir, 'build-report.json'), report);

    if (!options.skipVivoRpk) {
      throw new UserError('Vivo RPK build runner is added in Task 4.');
    }

    return report;
  },
};
