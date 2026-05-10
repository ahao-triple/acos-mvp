import { douyinPlatformBuilder } from './douyin/index.js';
import { vivoPlatformBuilder } from './vivo/index.js';
import { UserError } from '../shared/errors.js';
import type { BuildReport, LoadedGameConfig, PlatformName } from '../shared/types.js';

export interface PlatformBuildOptions {
  skipVivoRpk?: boolean;
}

export interface PlatformBuilder {
  name: PlatformName;
  build(loaded: LoadedGameConfig, options?: PlatformBuildOptions): Promise<BuildReport>;
}

const supportedPlatforms = ['douyin', 'vivo'] as const;

export function getPlatformBuilder(platform: string): PlatformBuilder {
  if (platform === 'douyin') return douyinPlatformBuilder;
  if (platform === 'vivo') return vivoPlatformBuilder;

  throw new UserError(
    `Unsupported platform: ${platform}`,
    `Supported platforms: ${supportedPlatforms.join(', ')}`,
  );
}
