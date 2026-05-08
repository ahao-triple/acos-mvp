import { douyinPlatformBuilder } from './douyin/index.js';
import { UserError } from '../shared/errors.js';
import type { BuildReport, LoadedGameConfig, PlatformName } from '../shared/types.js';

export interface PlatformBuilder {
  name: PlatformName;
  validate(config: LoadedGameConfig): Promise<void>;
  build(config: LoadedGameConfig): Promise<BuildReport>;
}

export function getPlatformBuilder(platform: string): PlatformBuilder {
  if (platform === 'douyin') {
    return douyinPlatformBuilder;
  }

  throw new UserError(`Unsupported platform: ${platform}`, 'MVP only supports --platform douyin.');
}
