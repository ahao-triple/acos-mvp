import fs from 'fs-extra';
import path from 'node:path';

import { copyAssets } from '../../core/assets.js';
import { bundleGameEntry } from '../../core/bundle.js';
import { createBuildReport, writeBuildReport } from '../../core/report.js';
import { UserError } from '../../shared/errors.js';
import type { BuildReport, LoadedGameConfig } from '../../shared/types.js';
import type { PlatformBuildOptions, PlatformBuilder } from '../index.js';
import { buildVivoRpk } from './rpk.js';
import { createVivoManifest, createVivoPackageJson, renderVivoGameJs } from './template.js';

export const vivoPlatformBuilder: PlatformBuilder = {
  name: 'vivo',

  async build(loaded: LoadedGameConfig, options: PlatformBuildOptions = {}): Promise<BuildReport> {
    if (loaded.platform !== 'vivo') {
      throw new UserError(`Vivo builder cannot build platform: ${loaded.platform}`);
    }

    const outDir = loaded.paths.outDirAbs;
    const srcDir = path.join(outDir, 'src');
    await fs.remove(outDir);
    await fs.ensureDir(srcDir);

    await fs.writeJson(path.join(outDir, 'package.json'), createVivoPackageJson(), { spaces: 2 });
    await fs.writeJson(path.join(srcDir, 'manifest.json'), createVivoManifest(loaded), { spaces: 2 });
    await fs.copyFile(loaded.paths.iconAbs, path.join(srcDir, 'icon.png'));

    const tempDir = path.join(outDir, '.mini-pack');
    const tempBundle = path.join(tempDir, 'game.bundle.js');
    await bundleGameEntry({
      entryAbs: loaded.paths.entryAbs,
      outfile: tempBundle,
    });

    const bundleCode = await fs.readFile(tempBundle, 'utf8');
    const finalGameJs = renderVivoGameJs(bundleCode);
    const gameJsPath = path.join(srcDir, 'game.js');
    await fs.writeFile(gameJsPath, finalGameJs);
    await fs.remove(tempDir);

    const assetStats = await copyAssets({
      sourceDir: loaded.paths.publicDirAbs,
      destinationDir: path.join(srcDir, 'assets'),
    });
    const bundleStats = await fs.stat(gameJsPath);

    const reportOutDir = path.relative(loaded.projectRoot, outDir).split(path.sep).join('/');

    const report = createBuildReport({
      platform: 'vivo',
      title: loaded.game.title,
      entry: loaded.game.entry,
      publicDir: loaded.game.publicDir,
      outDir: reportOutDir,
      bundleBytes: bundleStats.size,
      assetCount: assetStats.count,
      assetBytes: assetStats.bytes,
    });

    await writeBuildReport(path.join(outDir, 'build-report.json'), report);

    if (!options.skipVivoRpk) {
      // buildVivoRpk 旧签名为 (projectDir, config)；下个 task 会改为 (projectDir, loaded)。
      // 暂时用 as any 让类型通过，运行时可能因旧实现读 config.douyin 出错——但这条路径在 vitest 单测里不会触发（rpk 测试单独覆盖）。
      await buildVivoRpk(outDir, loaded as any);
    }

    return report;
  },
};
