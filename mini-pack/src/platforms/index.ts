import { vivoPlatformBuilder } from './vivo/index.js';
import { SUPPORTED_PLATFORMS } from '../core/schema.js';
import { UserError } from '../shared/errors.js';
import type { BuildReport, LoadedGameConfig, PlatformName } from '../shared/types.js';

export interface PlatformBuildOptions {
  skipVivoRpk?: boolean;
}

export interface PlatformBuilder {
  name: PlatformName;
  build(loaded: LoadedGameConfig, options?: PlatformBuildOptions): Promise<BuildReport>;
}

const platformBuilders: Partial<Record<PlatformName, PlatformBuilder>> = {
  vivo: vivoPlatformBuilder,
};

export function getPlatformBuilder(platform: string): PlatformBuilder {
  const builder = platformBuilders[platform as PlatformName];
  if (builder) return builder;

  throw new UserError(
    `Unsupported platform: ${platform}`,
    `Supported platforms: ${SUPPORTED_PLATFORMS.join(', ')}`,
  );
}
