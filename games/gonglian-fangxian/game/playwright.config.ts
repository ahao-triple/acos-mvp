/**
 * Playwright e2e 配置（gonglian-fangxian）。
 *
 * 设计：
 *  - viewport 750×1334 一比一对齐游戏 logical canvas，点击坐标可以直接用 playing.ts
 *    里的 BOARD_START_X/Y + cell 偏移。
 *  - chromium only（vivo runtime 用 V8，行为最接近 chromium）。装其他 browser 浪费 CI 时间。
 *  - webServer 跑 vite dev（不是 preview）：dev server 启动快，且 HMR 不影响 e2e。
 *  - trace / video / screenshot 都 on-first-failure：失败时自动留证据，过的时候不留。
 *  - retries=0：本地工作流要"红了立刻看"，retry 会掩盖 flaky bug。
 *  - 严格只跑 tests/e2e，不让 vitest 的 src/test/ 被误识别（双方文件名后缀 .test vs .spec 分离）。
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // 首次冷启动 vite dev 要做 PixiJS 依赖预构建（720+ 模块），可能耗 20-30s。提高到 60s 留余量；
  // 第二次起 vite 命中缓存 < 1s，但 CI / clean checkout 必须能首次跑过。
  timeout: 60 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 750, height: 1334 },
    deviceScaleFactor: 1,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 750, height: 1334 },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
