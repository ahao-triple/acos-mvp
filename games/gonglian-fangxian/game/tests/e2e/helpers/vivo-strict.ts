/**
 * 模拟 vivo runtime 严格性的 Playwright hook。
 *
 * 本期只覆盖踩过的两个真实根因（ROI 最高）：
 *   1. 禁用 OES_element_index_uint —— 模拟 vivo WebGL 1 严格驱动，强制 uint16 索引路径
 *   2. preferWebGLVersion=1 已在 src/pixi/app.ts 里硬编码，无需 hook 重复
 *
 * 不模拟的（已有解决方案 / 过度工程）：
 *   - globalThis.addEventListener 锁死（pixi prototype patch 已处理，复现意义低）
 *   - OffscreenCanvas 禁用（PixiJS 实际没用到）
 *   - vivo qg.* runtime API（这条路径靠真机回归，不在 e2e 覆盖范围）
 *
 * 原则：每个 hook 对应一次真机事故 + 注释说明来源。不预测未发生的 bug。
 *
 * 错误聚合：拦截 console.error / console.warn / pageerror / unhandledrejection 推到
 * `handle.errors`，测试结束断言 `fatalErrors(handle.errors)` 为空。
 */
import type { Page } from '@playwright/test';

export interface VivoStrictHandle {
  /** 所有 console error/warn + pageerror + uncaught 的字符串日志 */
  errors: string[];
}

export async function installVivoStrictHooks(page: Page): Promise<VivoStrictHandle> {
  const handle: VivoStrictHandle = { errors: [] };

  // 关键：addInitScript 必须在 page.goto 之前注入，才能在用户脚本执行前生效。
  await page.addInitScript(() => {
    // ─── 1. 禁用 OES_element_index_uint（vivo WebGL 1 严格驱动）───
    const origGetExtension = WebGLRenderingContext.prototype.getExtension;
    WebGLRenderingContext.prototype.getExtension = function (name: string) {
      if (name === 'OES_element_index_uint') {
        return null;
      }
      return origGetExtension.call(this, name);
    };
  });

  // 收集错误：Playwright 把 console / pageerror 暴露成事件，比 page.evaluate 读 window
  // 全局更直接。Node 端聚合便于 expect 直接断言。
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      handle.errors.push(`[console.${type}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    handle.errors.push(`[pageerror] ${err.message}`);
  });

  return handle;
}

const FATAL_PATTERNS: RegExp[] = [
  /drawElements failed/i,
  /glType not correct/i,
  /INVALID_ENUM/i,
  /INVALID_OPERATION/i,
  /Cannot read prop/i,
  /is not a function/i,
  /webgl context lost/i,
];

/**
 * 从聚合的错误日志里挑出"必须报警"的项（区别于 PixiJS 警告 / 业务 warn）。
 * 加新模式时附上来源注释，避免误判正常 warn 为 fatal。
 */
export function fatalErrors(errors: string[]): string[] {
  return errors.filter((e) => FATAL_PATTERNS.some((re) => re.test(e)));
}

/**
 * 把游戏的 logical 坐标（750×1334 canvas 内部）转换成 page click 用的物理坐标。
 * canvas 元素本身可能 letterbox / fill，按 #game 的 CSS bounding box 反算。
 */
export async function clickLogical(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator('#game').boundingBox();
  if (!box) {
    throw new Error('canvas #game has no bounding box (not visible?)');
  }
  // PixiJS scaler 用 fit 模式（保持 750:1334 长宽比，居中），所以单 scale。
  const scale = Math.min(box.width / 750, box.height / 1334);
  const offsetX = (box.width - 750 * scale) / 2;
  const offsetY = (box.height - 1334 * scale) / 2;
  await page.locator('#game').click({
    position: {
      x: offsetX + x * scale,
      y: offsetY + y * scale,
    },
  });
}

/**
 * 验证 PixiJS uint16 patch 运行时生效（globalThis.__pixiPatchOk 由 src/pixi/app.ts 顶层设置）。
 * 必须在 PixiJS 初始化后调用（page.goto + 等 #game 可见 + 等 Pixi init 完成）。
 *
 * patch 没生效时：scripts/apply-pixi-patch.sh 没跑 / rpk 构建绕过 patches/ / 装了错的版本。
 * 失败立刻在 e2e 红，避免后续假阴性误判 "drawElements failed 是新 bug"。
 */
export async function assertPatchApplied(page: Page): Promise<void> {
  const ok = await page.evaluate(() => (window as unknown as { __pixiPatchOk?: boolean }).__pixiPatchOk);
  if (ok !== true) {
    // 同时读 Batcher 源码作为补充诊断（无 Batcher 暴露时 src=null，仅看 marker 即可）。
    const src = await page.evaluate(() => {
      const B = (window as unknown as { PIXI?: { Batcher?: { prototype?: { _resizeIndexBuffer?: () => unknown } } } }).PIXI?.Batcher;
      return B?.prototype?._resizeIndexBuffer?.toString?.() ?? null;
    });
    throw new Error(`pixi-patch-check FAILED: window.__pixiPatchOk=${String(ok)}; Batcher source snippet (truncated): ${String(src).slice(0, 200)}`);
  }
}

/** 棋盘 cell (row, col) 的逻辑中心坐标。与 playing.ts 的 BOARD_START_X/Y + CELL_SIZE + GAP 保持一致。 */
export function boardCellCenter(row: number, col: number): { x: number; y: number } {
  const BOARD_CELL_SIZE = 62;
  const BOARD_GAP = 5;
  const BOARD_START_X = 43;
  const BOARD_START_Y = 286;
  return {
    x: BOARD_START_X + col * (BOARD_CELL_SIZE + BOARD_GAP) + BOARD_CELL_SIZE / 2,
    y: BOARD_START_Y + row * (BOARD_CELL_SIZE + BOARD_GAP) + BOARD_CELL_SIZE / 2,
  };
}
