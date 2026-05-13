import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config.base';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: [
      'mini-pack/tests/**/*.test.ts',
      'games/gonglian-fangxian/game/src/test/**/*.test.ts',
    ],
  },
}));
