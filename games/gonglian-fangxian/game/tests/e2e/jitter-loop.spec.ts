/**
 * 30 秒抖动 e2e：进战斗主屏后程序化触发 5 次随机消除尝试，监控 fps + 错误。
 *
 * 设计：
 *   a) 随机选 (r, c) + 相邻方向（→/↓），每轮都不写死坐标，覆盖率高 + 抗 board layout 变化
 *   b) 注入 RAF 计数 fps sampler。chromium 真渲染下 fps 可信；jsdom 没意义所以这条用例只跑 e2e
 *   c) 失败时把全部 console + fps 报告 attach 到 testInfo，便于在 playwright-report 里直接看
 *   d) 串行跑（playwright.config.ts workers=1） —— PixiJS 多实例同进程会抢 GL context
 *
 * 这是回归 net：每个真机 bug 修完后跑一遍这个能保证连续动画路径不退化。
 */
import { expect, test } from '@playwright/test';
import { assertPatchApplied, boardCellCenter, clickLogical, fatalErrors, installVivoStrictHooks } from './helpers/vivo-strict';

const BOARD_ROWS = 10;
const BOARD_COLS = 10;
const ROUNDS = 5;
const ROUND_MS = 5000;       // 5 轮 × 5 秒 = 25 秒抖动主体，加启动开销 ≈ 30 秒
const MIN_AVG_FPS = 50;      // 战斗主屏目标 ≥ 55，留 5 fps 余量给 CI / 弱机器

// 用本地确定性 PRNG（mulberry32）让测试可复现：失败时改不出种就一直能复现。
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface AdjacentPair {
  a: { row: number; col: number };
  b: { row: number; col: number };
}

function pickAdjacent(rng: () => number): AdjacentPair {
  const r = Math.floor(rng() * BOARD_ROWS);
  const c = Math.floor(rng() * BOARD_COLS);
  const dirIsHorizontal = rng() < 0.5;
  // 保证另一格也在板内：边界时翻转方向
  if (dirIsHorizontal) {
    const c2 = c < BOARD_COLS - 1 ? c + 1 : c - 1;
    return { a: { row: r, col: c }, b: { row: r, col: c2 } };
  } else {
    const r2 = r < BOARD_ROWS - 1 ? r + 1 : r - 1;
    return { a: { row: r, col: c }, b: { row: r2, col: c } };
  }
}

test('30 秒抖动：5 轮随机消除 + fps ≥ 50 + 0 fatal', async ({ page }, testInfo) => {
  test.setTimeout(70 * 1000); // 30 秒抖动 + 启动 + 启动后 1.5s + buffer
  const handle = await installVivoStrictHooks(page);

  // ?vivo-strict：与 core-loop 同样强制开启 vivo 兼容性 hook，确保抖动用例覆盖真机路径。
  await page.goto('/?vivo-strict', { waitUntil: 'domcontentloaded' });
  await page.locator('#game').waitFor({ state: 'visible' });
  // PixiJS init + 第一帧 + LoadingScreen 1.5s 自动切 menu 全部跑完。
  await page.waitForTimeout(3000);
  await assertPatchApplied(page);

  // 进战斗主屏：menu → 点"开整" → 直接 playing（briefing 已删）
  await clickLogical(page, 150 + 450 / 2, 430 + 82 / 2);
  await page.waitForTimeout(1500);

  // 注入 fps sampler：requestAnimationFrame 计数，fps 报告时除以 elapsed 秒数。
  // 用全局 window.__fps，类型用 any 通过（spec 不开 strict TS）。
  await page.evaluate(() => {
    const w = window as unknown as { __fps?: { frames: number; started: number } };
    w.__fps = { frames: 0, started: performance.now() };
    const tick = (): void => {
      if (w.__fps) w.__fps.frames += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // 固定 seed 让 CI / 本地复现一致；改种子时 commit message 写明（视为回归 net 变更）。
  const rng = makeRng(0x1337);

  for (let i = 0; i < ROUNDS; i += 1) {
    const pair = pickAdjacent(rng);
    const a = boardCellCenter(pair.a.row, pair.a.col);
    const b = boardCellCenter(pair.b.row, pair.b.col);
    await clickLogical(page, a.x, a.y);
    await page.waitForTimeout(120);
    await clickLogical(page, b.x, b.y);
    await page.waitForTimeout(ROUND_MS - 120);
  }

  // 收 fps
  const fps = await page.evaluate(() => {
    const w = window as unknown as { __fps?: { frames: number; started: number } };
    if (!w.__fps) return { frames: 0, elapsed: 0, fps: 0 };
    const elapsed = (performance.now() - w.__fps.started) / 1000;
    return { frames: w.__fps.frames, elapsed, fps: w.__fps.frames / elapsed };
  });

  const fatal = fatalErrors(handle.errors);

  // 失败时 attach 全部 console + fps 报告到 playwright-report
  if (fatal.length > 0 || fps.fps < MIN_AVG_FPS) {
    await testInfo.attach('console-errors.log', {
      body: handle.errors.join('\n') || '(empty)',
      contentType: 'text/plain',
    });
    await testInfo.attach('fps-report.json', {
      body: JSON.stringify(fps, null, 2),
      contentType: 'application/json',
    });
  }

  expect(fatal, `fatal errors during jitter loop:\n${fatal.slice(0, 10).join('\n')}`).toEqual([]);
  expect(
    fps.fps,
    `avg fps too low: ${fps.fps.toFixed(1)} (frames=${fps.frames} elapsed=${fps.elapsed.toFixed(2)}s, threshold=${MIN_AVG_FPS})`,
  ).toBeGreaterThanOrEqual(MIN_AVG_FPS);
});
