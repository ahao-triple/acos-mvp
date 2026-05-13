import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'mini-pack/tests/**/*.test.ts',
      'games/gonglian-fangxian/game/src/test/**/*.test.ts',
    ],
    restoreMocks: true,
  },
});
