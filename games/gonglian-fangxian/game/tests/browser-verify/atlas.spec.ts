/**
 * verify:browser —— 字体 atlas 在浏览器 dist 路径下是否真的加载成功 + 文字渲染清晰。
 *
 * 这是 2026-05-13 真机踩坑后新增的诊断层。之前缺失这一层导致：
 *   1. e2e jsdom 路径走 fallback Pixi Text，永远绿
 *   2. 真机灌包发现 atlas load fail → fallback Text → fillText alpha bug → 全屏深色文字
 *   3. 根因（`Assets.load('/fonts/main.fnt')` 前导斜杠被 qg.request 当 URL）本来在浏览器
 *      就能复现（因为 vite dev/preview 也是 `/` 起头当 absolute path，但 dev 时 publicDir
 *      中间件能命中、build 后 preview 路径解析依然命中——所以浏览器没炸；vivo 才炸）。
 *      所以更严格的断言是 console log 出现 "BitmapFont atlas loaded: N glyphs"。
 *
 * 断言：
 *   a. atlas 已加载（console log 出现 "BitmapFont atlas loaded: N glyphs"）
 *   b. console 未出现 `[pixi-renderer] atlas load failed`
 *   c. console 未出现 `[bitmap-text] missing chars in atlas`
 *   d. page error 列表为空
 *   e. 截图保存到 test-results/browser-verify.png 供人工对照
 *
 * 失败时输出全部 console log，便于直接定位根因（不像 vivo runtime 那样需要单独诊断）。
 *
 * 缺字 warn 会导致 BitmapText 文案被替换，属于本测试必须捕获的资源覆盖问题。
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test('atlas loads in production preview build', async ({ page }) => {
  const consoleLines: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    consoleLines.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (e) => {
    pageErrors.push(`pageerror: ${e.message}`);
  });

  await page.goto('/');

  // 等 atlas 加载证据出现。
  // 失败时 catch 后手动 dump 所有 console（poll 的 message option 不接 function，所以这里手动 dump）。
  const atlasEvidence = (l: string): boolean => /BitmapFont atlas loaded:.*glyphs/.test(l);
  try {
    await expect
      .poll(() => consoleLines.some(atlasEvidence), {
        message: 'expected atlas-loaded evidence in console within 10s',
        timeout: 10_000,
      })
      .toBe(true);
  } catch (assertion) {
    console.log('=== verify:browser FAILED — dumping browser console ===');
    for (const line of consoleLines) console.log(line);
    if (pageErrors.length) {
      console.log('--- page errors ---');
      for (const e of pageErrors) console.log(e);
    }
    console.log('=== end dump ===');
    throw assertion;
  }

  // 给 PixiRenderer 第一帧 render 留 500ms，再截图（保证文字真的画上去了）
  await page.waitForTimeout(500);

  // 截图保存（mkdir -p test-results 避免目录不存在）
  const outDir = resolve('test-results');
  mkdirSync(outDir, { recursive: true });
  const shotPath = resolve(outDir, 'browser-verify.png');
  await page.screenshot({ path: shotPath, fullPage: false });
  console.log(`[verify:browser] screenshot saved: ${shotPath}`);

  // 断言：没有 atlas 加载失败的 warn/error
  const loadFailed = consoleLines.filter((l) => /atlas load failed/i.test(l));
  expect(loadFailed, `unexpected atlas load failures:\n${loadFailed.join('\n')}`).toEqual([]);

  // 断言：没有缺字 warn。缺字会触发 sanitizeText 替换，真机上可能表现为文案不完整或空白。
  const missingWarns = consoleLines.filter((l) => /\[bitmap-text\] missing chars in atlas/.test(l));
  expect(missingWarns, `unexpected bitmap-text missing chars:\n${missingWarns.join('\n')}`).toEqual([]);

  // 断言：无 page error（unhandled exception / unhandled rejection）
  expect(pageErrors, `unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([]);

  // 提取 atlas 证据报告（用于 review 时确认 atlas 是新版本 + 现状摘要）。
  const loadedLine = consoleLines.find((l) => /BitmapFont atlas loaded:.*glyphs/.test(l));
  console.log(`[verify:browser] loaded-log: ${loadedLine ?? '(not captured by page.on console)'}`);
  console.log(`[verify:browser] missing-chars warns: ${missingWarns.length}`);
});
