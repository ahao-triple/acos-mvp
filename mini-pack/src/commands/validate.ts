import { loadGameConfig } from '../core/config.js';
import { UserError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import type { PlatformName } from '../shared/types.js';

export interface ValidateCommandOptions {
  platform: string;
  projectRoot?: string;
}

export async function runValidateCommand(options: ValidateCommandOptions): Promise<void> {
  if (options.platform !== 'douyin') {
    throw new UserError(`Unsupported platform: ${options.platform}`, 'MVP only supports --platform douyin.');
  }

  const config = await loadGameConfig({
    projectRoot: options.projectRoot,
    platform: options.platform as PlatformName,
  });

  logger.success(`Configuration valid for ${config.platform}: ${config.title}`);
}
