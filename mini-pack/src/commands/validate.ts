import { loadGameConfig } from '../core/config.js';
import { getPlatformBuilder } from '../platforms/index.js';
import { logger } from '../shared/logger.js';
import type { PlatformName } from '../shared/types.js';

export interface ValidateCommandOptions {
  platform: string;
  projectRoot?: string;
}

export async function runValidateCommand(options: ValidateCommandOptions): Promise<void> {
  const builder = getPlatformBuilder(options.platform);
  const config = await loadGameConfig({
    projectRoot: options.projectRoot,
    platform: options.platform as PlatformName,
  });
  await builder.validate(config);

  logger.success(`Configuration valid for ${config.platform}: ${config.title}`);
}
