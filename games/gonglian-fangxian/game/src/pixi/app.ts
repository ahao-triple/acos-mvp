/**
 * Pixi v8 Application 初始化（gonglian-fangxian Phase 1）。
 *
 * 与 Phase 0 Smoke 的差异：
 *  - Smoke 是临时验证脚本；这里是正式生命周期，由 PixiRenderer 持有 app。
 *  - 走相同的兼容性处理：vivo 路径 import polyfill + unsafe-eval + DOMAdapter.set +
 *    extensions._queue mutate 卸载 DOM 依赖 pipe/system。
 *  - web 也用同一份代码 —— polyfill 是条件式（已存在不覆盖），
 *    在浏览器上是 no-op；DOMAdapter.set 会换掉 BrowserAdapter，浏览器上略有性能
 *    损失但行为一致。
 *
 * 战斗主屏 fps ≥ 55 的目标要求 ticker 不能跑 sharedTicker（避免多个 Application
 * 抢同一 ticker），且 autoStart=true 让 ticker 一启动就跑。
 */
import 'pixi.js/unsafe-eval';
import {
  Application,
  Batcher,
  extensions,
  DOMPipe,
  AccessibilitySystem,
  HTMLTextPipe,
  HTMLTextSystem,
  EventSystem,
  FilterSystem,
} from 'pixi.js';
import { setupVivoPixiDOMAdapter } from '../platform/vivo/pixi-adapter';
import { patchEventSystemPrototype } from '../platform/vivo/listener-store';
import { isVivoStrictMode } from '../platform/vivo/strict-mode';

// ─── PixiJS uint16 index patch 运行时自检 ───
// 模块顶层副作用：检查 Batcher.prototype._resizeIndexBuffer 源码是否含 Uint32Array。
// patch 没生效（postinstall 失败 / rpk 构建绕过 patches/ / 装错版本）时这里就会 error log。
// 设计要点：
//   1) 必须在 PixiJS Application init 之前执行 —— import 链上 app.ts 顶层比 createPixiApp() 早
//   2) 失败不 throw 只 console.error —— vConsole 第一时间暴露，但不让游戏崩溃
//   3) 设 globalThis.__pixiPatchOk 让 e2e / 用户脚本可读
// 失败的真机表现就是 drawElements failed / glType not correct 复发。
{
  const src = (Batcher.prototype as unknown as { _resizeIndexBuffer?: () => unknown })._resizeIndexBuffer?.toString?.() ?? '';
  const batcherHasUint32 = src.includes('Uint32Array');
  const filterSysSrc = FilterSystem.toString();
  const filterHasUint32 = filterSysSrc.includes('Uint32Array');
  const patchOk = !batcherHasUint32 && !filterHasUint32;
  (globalThis as unknown as { __pixiPatchOk?: boolean; __pixiFilterPatchOk?: boolean }).__pixiPatchOk = patchOk;
  (globalThis as unknown as { __pixiFilterPatchOk?: boolean }).__pixiFilterPatchOk = !filterHasUint32;
  if (batcherHasUint32) {
    console.error('[pixi-patch-check] FAILED: Batcher.prototype._resizeIndexBuffer still uses Uint32Array. patch not applied — drawElements failed will recur on vivo (run: sh scripts/apply-pixi-patch.sh)');
  } else {
    console.log('[pixi-patch-check] OK: Uint16Array index enforced');
  }
  if (filterHasUint32) {
    console.error('[pixi-patch-check] FAILED: FilterSystem still has Uint32Array');
  } else {
    console.log('[pixi-patch-check] OK: FilterSystem class source has no Uint32Array');
  }
}

/** 把 extensions._queue 里指定的 ref 全部过滤掉。详见 phase0-changelog.md 修复 6/8。 */
function removePixiExtensionsByRef(...refs: unknown[]): void {
  const ext = extensions as unknown as {
    _queue?: Record<string, Array<{ ref: unknown }>>;
  };
  const queue = ext._queue;
  if (!queue) return;
  for (const typeName of Object.keys(queue)) {
    const list = queue[typeName];
    if (!Array.isArray(list)) continue;
    queue[typeName] = list.filter((entry) => !refs.includes(entry.ref));
  }
}

export interface CreatePixiAppOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  backgroundColor?: number;
}

export interface PixiAppHandle {
  app: Application;
  destroy(): void;
}

/**
 * 创建 Pixi Application 并接管现有 canvas 的 WebGL context。
 * - 自己取 webgl context（vivo 上多次 getContext 行为未知，一次就够）
 * - 用 extensions._queue mutate 把 DOMPipe / AccessibilitySystem / EventSystem /
 *   HTMLTextPipe / HTMLTextSystem 拔掉（小游戏环境用不到）
 * - setupVivoPixiDOMAdapter 把 Pixi 内部 DOM 调用路由到 vivo qg.*
 */
export async function createPixiApp(options: CreatePixiAppOptions): Promise<PixiAppHandle> {
  const { canvas, width, height, backgroundColor = 0xfafaf7 } = options;

  // 1) 抢 WebGL 1 context（vivo 兼容最高）。
  let glRaw: WebGLRenderingContext | null = null;
  try {
    glRaw = (canvas.getContext('webgl', { alpha: false }) ||
      canvas.getContext('experimental-webgl', { alpha: false })) as WebGLRenderingContext | null;
  } catch (e) {
    console.error('[pixi-app] mainCanvas.getContext throw:', (e as Error).message);
    throw e;
  }
  if (!glRaw) {
    throw new Error('[pixi-app] webgl context unavailable');
  }

  // 2) 在 init 之前拔掉 DOM 依赖 pipe/system + 安装 DOMAdapter。
  // 拔除 DOM 依赖且 Phase 1 用不到的 pipe/system。注意：EventSystem **保留** —— Phase 1 按钮
  // 点击靠它。EventSystem.init 调 globalThis.document.addEventListener("pointermove") 在
  // dom-polyfill 里被 stub 成 noop，不崩；canvas.addEventListener 走 wrapperCanvas（main.ts
  // 接入 vivoCanvasAdapter 时设置 Pixi events.setTargetElement(wrapperCanvas)）。
  //
  // 严格模式 gate：只有 vivo 真机 / ?vivo-strict URL 才执行。
  // 普通浏览器 dev 走 PixiJS 默认 BrowserAdapter + EventSystem 原生路径，DOM pipe/system
  // 保留可让 HTMLText 之类的高级功能正常工作（调试时有用）。
  if (isVivoStrictMode()) {
    removePixiExtensionsByRef(DOMPipe, AccessibilitySystem, HTMLTextPipe, HTMLTextSystem);
    setupVivoPixiDOMAdapter();
    // vivo runtime 锁死 globalThis.addEventListener（configurable=false getter），EventSystem
    // 原 _addEvents 里 globalThis.addEventListener("pointerup", this._onPointerUp, true) 永久 noop。
    // 这里 monkey-patch prototype，原方法跑完后手动把 _onPointerUp push 到 listener-store。
    patchEventSystemPrototype(EventSystem as unknown as { prototype: Record<string, unknown> });
  } else {
    console.log('[pixi-app] skip vivo hooks (browser non-strict mode; add ?vivo-strict to URL to enable)');
  }

  // 3) Application.init 复用外部 canvas + context。
  const app = new Application();
  await app.init({
    canvas: canvas as unknown as HTMLCanvasElement,
    context: glRaw as unknown as WebGL2RenderingContext,
    preferWebGLVersion: 1,
    preference: 'webgl',
    width,
    height,
    backgroundColor,
    antialias: false,
    autoStart: true,
    sharedTicker: false,
  });

  return {
    app,
    destroy() {
      try {
        app.destroy(false, { children: true });
      } catch (e) {
        console.warn('[pixi-app] app.destroy failed:', (e as Error).message);
      }
    },
  };
}
