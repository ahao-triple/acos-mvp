// SPECULATIVE PORT from vivo. OPPO 也用 qg.* runtime, 多数 hook 应通用。
// 真机校准如有差异再修。

/**
 * oppo 严格模式开关 —— 控制 oppo 兼容性 hook（dom-polyfill / DOMAdapter / EventSystem patch /
 * removePixiExtensionsByRef DOM 路径）是否启用。
 *
 * 三种入口：
 *   1. oppo 小游戏 runtime（qg）→ 自动启用
 *   2. 浏览器 + URL 含 `?oppo-strict` → 显式启用，用于复现真机问题
 *   3. 普通浏览器 dev → 关闭，PixiJS 走纯原生 DOM / EventSystem，表现力最佳
 *
 * 模块顶层 freeze 一次：dom-polyfill / app.ts 多处调用都拿同一份结果，避免 URL 中途变更
 * 引起的不一致。第一次求值发生在 dom-polyfill IIFE 顶部（main.ts 第一行 import），那时
 * location.search 已就绪。
 */

function detect(): boolean {
  const g = globalThis as unknown as {
    qg?: unknown;
    location?: { search?: string };
  };
  // mini-pack runtime 标志：oppo qg。
  if (typeof g.qg !== 'undefined') {
    return true;
  }
  // 浏览器路径：URL 显式开启。用 indexOf 而不是 URLSearchParams 避免依赖（runtime 可能不
  // 提供 URLSearchParams）。
  const search = g.location?.search;
  return typeof search === 'string' && search.indexOf('oppo-strict') >= 0;
}

const cached = detect();

export function isOppoStrictMode(): boolean {
  return cached;
}
