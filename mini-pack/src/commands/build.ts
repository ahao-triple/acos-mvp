import { loadGameConfig } from '../core/config.js';
import { getPlatformBuilder } from '../platforms/index.js';
import { logger } from '../shared/logger.js';
import type { PlatformName } from '../shared/types.js';

export interface BuildCommandOptions {
  platform: string;
  projectRoot?: string;
  skipVivoRpk?: boolean;
}

export async function runBuildCommand(options: BuildCommandOptions): Promise<void> {
  const builder = getPlatformBuilder(options.platform);
  const loaded = await loadGameConfig({
    projectRoot: options.projectRoot,
    platform: options.platform as PlatformName,
  });
  const report = await builder.build(loaded, {
    skipVivoRpk: options.skipVivoRpk === true,
  });

  for (const warning of report.warnings) {
    logger.warn(warning);
  }
  logger.success(`Built ${report.platform} package at ${report.outDir}`);
}
