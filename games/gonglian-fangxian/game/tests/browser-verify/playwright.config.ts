/**
 * verify:browser 工作流 —— 测试金字塔补全一层。
 *
 *   层级                  覆盖
 *   ────────────────────  ──────────────────────────────────
 *   单测（vitest jsdom）   纯逻辑 / EffectsModel / save / controller
 *   e2e（playwright dev）  业务流程 / UI 跳转 / 手势 / 视觉对照
 *   verify:browser（本层） 资源加载 + WebGL 渲染 + bundle 完整性  ← 这次新增
 *   vivo 真机              平台 quirks 终审
 *
 * 为什么独立于 tests/e2e：
 *  - e2e 用 `vite dev`（HMR / 未打包源码），verify:browser 用 `vite build + vite preview`
 *    （和真机一样的构建产物）—— 测的是"dist 里到底有没有这些资源 / 路径解析对不对"。
 *  - dev 服务器对 publicDir 的处理跟 build 后不完全一致（一个走中间件，一个走静态文件）。
 *    "atlas dev 跑通但 dist 跑不通"是真实存在的失败模式（虽然这次根因不是这个）。
 *
 * 触发：`pnpm verify:browser` 单独跑；`pnpm check:full` 里串在 e2e 之后跑。
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  // vite build 冷启动 + preview 启动可能 30-60s，预留 120s。
  timeout: 120 * 1000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 750, height: 1334 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
  },
  // webServer 跑 vite build + preview。
  // - build 必须每次重跑（保证测的是当前源码）。
  // - preview 端口 4173 与 vite dev 5173 错开，避免和 e2e 撞端口。
  // - reuseExistingServer=false：每次 verify 都从干净 build 起，否则 stale dist 会假绿。
  // - cwd 显式回到 game/ 根（playwright config 在 tests/browser-verify/ 下，否则 vite 找不到 index.html）
  webServer: {
    command: 'pnpm exec vite build && pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    cwd: '../..',
    url: 'http://127.0.0.1:4173',
    timeout: 120 * 1000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
