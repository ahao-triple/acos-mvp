import path from 'node:path';

import { loadGameConfig } from '../core/config.js';
import { assertSafeGeneratedOutDir } from '../core/paths.js';
import { getPlatformBuilder } from '../platforms/index.js';
import { logger } from '../shared/logger.js';
import type { LoadedGameConfig } from '../shared/types.js';
import type { PlatformName } from '../shared/types.js';

export interface BuildCommandOptions {
  platform: string;
  projectRoot?: string;
  outDir?: string;
  skipVivoRpk?: boolean;
}

export async function runBuildCommand(options: BuildCommandOptions): Promise<void> {
  const builder = getPlatformBuilder(options.platform);
  const config = await loadGameConfig({
    projectRoot: options.projectRoot,
    platform: options.platform as PlatformName,
  });
  const report = await builder.build(applyOutDirOverride(config, options.outDir), {
    skipVivoRpk: options.skipVivoRpk === true,
  });

  for (const warning of report.warnings) {
    logger.warn(warning);
  }
  logger.success(`Built ${report.platform} package at ${report.outDir}`);
}

function applyOutDirOverride(config: LoadedGameConfig, outDir: string | undefined): LoadedGameConfig {
  if (!outDir) {
    return config;
  }

  const outDirAbs = path.resolve(process.cwd(), outDir);
  const reportOutDir = normalizePathForReport(outDir);
  assertSafeGeneratedOutDir(config.projectRoot, reportOutDir, outDirAbs);

  return {
    ...config,
    outDir: reportOutDir,
    paths: {
      ...config.paths,
      outDirAbs,
    },
  };
}

function normalizePathForReport(value: string): string {
  return value.split(path.sep).join('/');
}
