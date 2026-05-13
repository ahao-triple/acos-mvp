import { defineConfig } from 'vitest/config';

export default defineConfig({
  publicDir: 'public-pack',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    // vivo runtime（quickgame）不支持动态 import 拆 chunk —— 实测 Pixi v8 默认会把
    // WebGLRenderer / WebGPURenderer / CanvasRenderer / Filter 等拆出多个独立 chunk。
    // inlineDynamicImports 把所有 dynamic import 内联到主 bundle，输出唯一 index.js。
    // Web Worker（`new Worker(new URL(...))`）走另一条路径不受影响，仍保留独立产物。
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    // vitest 跑 src/test/*.test.ts；Playwright 的 tests/e2e/*.spec.ts 由 playwright runner
    // 独立编译运行，必须从 vitest include 中排除（否则 vitest 把 @playwright/test 的 test()
    // 误当成自己的，抛 "did not expect test() to be called here"）。
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
  },
});
