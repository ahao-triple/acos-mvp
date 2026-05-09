import { UserError } from '../../shared/errors.js';
import type { BuildReport, LoadedGameConfig } from '../../shared/types.js';
import type { PlatformBuilder } from '../index.js';

export const vivoPlatformBuilder: PlatformBuilder = {
  name: 'vivo',

  async validate(config: LoadedGameConfig): Promise<void> {
    if (config.platform !== 'vivo') {
      throw new UserError(`Vivo builder cannot build platform: ${config.platform}`);
    }
  },

  async build(_config: LoadedGameConfig): Promise<BuildReport> {
    throw new UserError('Vivo build is registered; project generation is added in Task 3.');
  },
};
