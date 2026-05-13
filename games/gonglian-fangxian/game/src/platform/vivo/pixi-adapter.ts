/**
 * Pixi v8 在 vivo runtime 上的 DOMAdapter（Phase 0 攻坚产物）。
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 与 dom-polyfill.ts 的关系
 * ─────────────────────────────────────────────────────────────────────────────
 *  - dom-polyfill.ts：补全 vivo runtime 的全局 BOM/DOM，让 Pixi 模块加载和
 *    instanceof 检查不崩。语义是「全局兜底」。
 *  - pixi-adapter.ts（本文件）：替换 Pixi 自己的 DOMAdapter 抽象层（Pixi v8
 *    把所有 DOM 调用集中在 `DOMAdapter.get()` 上），让 createCanvas/createImage
 *    直接路由到 vivo `qg.*`。语义是「Pixi 专用扩展点」。
 *
 *  两者都启用：dom-polyfill 是默认兜底，pixi-adapter 是 Pixi 专用快速路径。
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 调用约定
 * ─────────────────────────────────────────────────────────────────────────────
 *  - 必须在 `Application.init()` 之前调用 `setupVivoPixiDOMAdapter()`。
 *  - 重复调用无害（installed 标志保护）。
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 跨平台兼容性说明
 * ─────────────────────────────────────────────────────────────────────────────
 *  - 当前用 `qg.createCanvas` / `qg.createImage`，是 vivo runtime 的 API。
 *  - OPPO/华为/小米 各自的 runtime API 名字不同（如 OPPO `qh`、小米 `qq`），
 *    切换平台时需要按平台分支判断。当前文件未做这层抽象。
 */
import { DOMAdapter } from 'pixi.js';

type VivoQgGlobal = {
  createCanvas?: () => unknown;
  createImage?: () => unknown;
};

let installed = false;

export function setupVivoPixiDOMAdapter(): void {
  if (installed) {
    return;
  }
  installed = true;

  const g = globalThis as unknown as {
    qg?: VivoQgGlobal;
    CanvasRenderingContext2D?: unknown;
    WebGLRenderingContext?: unknown;
    Image?: { new (): unknown };
    document?: { createElement?: (tag: string) => unknown };
  };

  const qg = g.qg;

  // navigator stub for Pixi 内部用：isSafari 读 userAgent，isWebGPUSupported 读 gpu。
  // 即便 dom-polyfill 已经补了全局 navigator，这里再保留一份本地 stub，
  // 让 DOMAdapter.getNavigator 直接返回这个简化对象（避免读真实全局，减少分支）。
  const stubNavigator = { userAgent: '', gpu: null };

  DOMAdapter.set({
    // createCanvas: vivo `qg.createCanvas()` 第一次返回 mainCanvas，之后返回离屏 canvas。
    // mini-pack 入口已经 createCanvas 过一次（mainCanvas），所以 Pixi 调到这里时
    // 拿到的是离屏 canvas，正好满足 Pixi Text 测量 / RenderTexture 中转用途。
    createCanvas: ((width?: number, height?: number) => {
      if (qg?.createCanvas) {
        const c = qg.createCanvas() as { width: number; height: number };
        if (typeof width === 'number') c.width = width;
        if (typeof height === 'number') c.height = height;
        return c;
      }
      if (g.document?.createElement) {
        const c = g.document.createElement('canvas') as { width: number; height: number };
        if (typeof width === 'number') c.width = width;
        if (typeof height === 'number') c.height = height;
        return c;
      }
      throw new Error('[vivo-pixi-adapter] createCanvas: no qg.createCanvas & no document');
    }) as unknown as ReturnType<typeof DOMAdapter.get>['createCanvas'],

    createImage: (() => {
      if (qg?.createImage) {
        return qg.createImage();
      }
      if (g.Image) {
        return new g.Image();
      }
      throw new Error('[vivo-pixi-adapter] createImage: no qg.createImage & no Image ctor');
    }) as unknown as ReturnType<typeof DOMAdapter.get>['createImage'],

    getCanvasRenderingContext2D: () => g.CanvasRenderingContext2D as never,
    getWebGLRenderingContext: () => g.WebGLRenderingContext as never,

    getNavigator: () => stubNavigator as never,
    getBaseUrl: () => '',
    getFontFaceSet: () => null,

    // fetch / parseXML 在 Smoke 里不该被触发，触发了说明 Pixi 走到一条意外路径
    // （比如尝试加载 SVG / XML 资源），立即报错而不是静默挂起。
    // Phase 1 接入真实资源加载时再实现。
    fetch: ((_url: unknown, _options?: unknown) => {
      return Promise.reject(new Error('[vivo-pixi-adapter] fetch is not implemented (Phase 0)'));
    }) as unknown as ReturnType<typeof DOMAdapter.get>['fetch'],
    parseXML: ((_xml: string) => {
      throw new Error('[vivo-pixi-adapter] parseXML is not implemented (Phase 0)');
    }) as unknown as ReturnType<typeof DOMAdapter.get>['parseXML'],
  });

  if (typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log('[vivo-pixi-adapter] DOMAdapter installed (qg=%s)', qg ? 'yes' : 'no');
  }
}
