/**
 * 核心循环 e2e：启动 → 菜单 → 战斗 → 点 2 个相邻 piece → 等动画稳定 → 0 错误。
 *
 * 覆盖的代码路径（占战斗主屏 90%+）：
 *   - app/controller dispatch 状态转换（start / tapCell）
 *   - VisualBoardModel sync + tilesAt 中间帧
 *   - PieceSprite 池 create / destroy 抖动
 *   - PresentationDirector 多步播放
 *   - effects 粒子 burst + shake
 *   - GL drawElements / 批处理 batcher
 *
 * 不覆盖（留给真机 / Turn 2 抖动测试）：
 *   - 完整通关到结算（需要改关卡数据或暴露调试钩子，污染主代码）
 *   - vivo qg.* runtime / globalThis.addEventListener 锁死等 vivo 特有路径
 */
import { expect, test } from '@playwright/test';
import { assertPatchApplied, boardCellCenter, clickLogical, fatalErrors, installVivoStrictHooks } from './helpers/vivo-strict';

test('启动 → 菜单 → 战斗 → 单次消除：无 GL/运行时错误', async ({ page }) => {
  const handle = await installVivoStrictHooks(page);

  // dev 模式下 PixiJS 720+ 模块首次走 esm import 慢，'load' 事件可能要 20s+。
  // 用 'domcontentloaded' 拿到 DOM 后立即返回，再用 polling 等 Pixi 渲染就绪。
  // ?vivo-strict：强制开启 vivo 兼容性 hook（dom-polyfill / DOMAdapter / EventSystem patch），
  // e2e 必须走严格模式才能复现真机问题；浏览器手动调试默认关闭。
  await page.goto('/?vivo-strict', { waitUntil: 'domcontentloaded' });
  await page.locator('#game').waitFor({ state: 'visible' });
  // PixiJS Application.init + 第一帧 + LoadingScreen 1.5s 自动切 menu 全部跑完。
  await page.waitForTimeout(3000);

  // 第一道闸：PixiJS uint16 patch 必须生效（postinstall 没跑 / 装错版本时此处直接红）。
  await assertPatchApplied(page);

  const canvas = page.locator('#game');
  await expect(canvas).toBeVisible();

  // ─── 1. 菜单 → 点"继续作战"（直接进战斗主屏，已无简报中转） ───
  // menu.ts: 主按钮 x=150 y=430 width=450 height=82
  await clickLogical(page, 150 + 450 / 2, 430 + 82 / 2);
  // 棋盘初始化 + 第一帧渲染需要一些时间，给充裕的预算。
  await page.waitForTimeout(1000);

  // ─── 2. 战斗主屏：点 (4,4) 和 (4,5) 触发交换尝试 ───
  // 注意：是否触发"消除"取决于随机初始棋盘。即使没消除，swap 拒绝 + 复位也会跑完整动画。
  // 测试目的是覆盖 batcher / piece pool 抖动，不要求一定消除。
  const a = boardCellCenter(4, 4);
  const b = boardCellCenter(4, 5);
  await clickLogical(page, a.x, a.y);
  await page.waitForTimeout(150);
  await clickLogical(page, b.x, b.y);
  // 等 swap + 可能的 clear + fall + refill 整套动画跑完。
  await page.waitForTimeout(2000);

  // ─── 3. 断言：fatal 错误 0 个 ───
  const fatal = fatalErrors(handle.errors);
  if (fatal.length > 0) {
    // 打印全部错误供排查，再 assert。这样测试输出里能直接看到错误内容。
    console.log('--- captured console errors ---\n' + handle.errors.join('\n'));
  }
  expect(fatal, `unexpected fatal errors:\n${fatal.join('\n')}`).toEqual([]);
});
