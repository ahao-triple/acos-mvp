import fs from 'fs-extra';
import path from 'node:path';

import { copyAssets } from '../../core/assets.js';
import { bundleGameEntry } from '../../core/bundle.js';
import { createBuildReport, writeBuildReport } from '../../core/report.js';
import { UserError } from '../../shared/errors.js';
import type { BuildReport, LoadedGameConfig } from '../../shared/types.js';
import type { PlatformBuildOptions, PlatformBuilder } from '../index.js';
import { buildVivoRpk } from './rpk.js';
import {
  createVivoMainJs,
  createVivoManifest,
  createVivoPackageJson,
  createVivoRuntimeRalJs,
  createVivoRuntimeWebAdapterJs,
  renderVivoGameJs,
} from './template.js';

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

    // 先把 public-pack 平铺到 srcDir：让 game/public-pack/<sub>/<file> 直接落到
    // srcDir/<sub>/<file>，从而 .rpk 根的相对路径与游戏代码资源路径一致
    // （rpk 内 assets/find/... 命中 src/assets/find/...）。
    // 重要顺序：copyAssets 必须在 manifest.json / icon.png / game.js 之前，
    // 否则 public-pack 内同名文件会覆盖渠道产物。
    const assetStats = await copyAssets({
      sourceDir: loaded.paths.publicDirAbs,
      destinationDir: srcDir,
    });

    await fs.writeJson(path.join(srcDir, 'manifest.json'), createVivoManifest(loaded), { spaces: 2 });
    // 渠道图标在 public-pack/icon.png 之后写，确保 channels/vivo/icon.png 生效
    await fs.copyFile(loaded.paths.iconAbs, path.join(srcDir, 'icon.png'));
    await fs.writeFile(path.join(srcDir, 'main.js'), createVivoMainJs());
    const runtimeAdapterDir = path.join(srcDir, 'runtime-adapter');
    await fs.ensureDir(runtimeAdapterDir);
    await fs.writeFile(path.join(runtimeAdapterDir, 'ral.js'), createVivoRuntimeRalJs());
    await fs.writeFile(path.join(runtimeAdapterDir, 'web-adapter.js'), createVivoRuntimeWebAdapterJs());

    const tempDir = path.join(outDir, '.mini-pack');
    const tempBundle = path.join(tempDir, 'game.bundle.js');
    await bundleGameEntry({
      entryAbs: loaded.paths.entryAbs,
      outfile: tempBundle,
      platform: 'vivo',
    });

    const bundleCode = await fs.readFile(tempBundle, 'utf8');
    const finalGameJs = renderVivoGameJs(bundleCode, loaded);
    const gameJsPath = path.join(srcDir, 'game.js');
    await fs.writeFile(gameJsPath, finalGameJs);
    await fs.remove(tempDir);

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

    if (!options.skipRpk && !options.skipVivoRpk) {
      await copyVivoReleaseSigningFiles(loaded);
      await buildVivoRpk(outDir, loaded);
    }

    return report;
  },
};

export async function copyVivoReleaseSigningFiles(loaded: LoadedGameConfig): Promise<void> {
  if (loaded.platform !== 'vivo' || !loaded.vivoMaterials?.releaseSignDir) {
    return;
  }

  const sourceDir = path.resolve(loaded.projectRoot, loaded.vivoMaterials.releaseSignDir);
  const privateKeySource = path.join(sourceDir, 'private.pem');
  const certificateSource = path.join(sourceDir, 'certificate.pem');
  const releaseSignDir = path.join(loaded.paths.outDirAbs, 'sign', 'release');

  await fs.ensureDir(releaseSignDir);
  await fs.copyFile(privateKeySource, path.join(releaseSignDir, 'private.pem'));
  await fs.copyFile(certificateSource, path.join(releaseSignDir, 'certificate.pem'));
}
