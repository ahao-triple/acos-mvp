// SPECULATIVE PORT from vivo. OPPO 也用 qg.* runtime, 多数 hook 应通用。
// 真机校准如有差异再修。

// 顶层 import：让 listener-store 模块本身求值（导出 buckets / installGlobalRoutes），
// 但 install 动作在 IIFE 末尾才触发 —— 那时 document/window 都已补齐。
// 关键时序：本模块作为 main.ts 第一行 import 同步执行，所以本 IIFE 退出后、PixiJS
// 模块顶层求值之前，全局 addEventListener 已是 routed 版本。PixiJS 即便在模块顶层
// cache globalThis.addEventListener 引用，cache 到的也是 routed 函数。
import { installGlobalRoutes } from './listener-store';
import { isOppoStrictMode } from './strict-mode';

/**
 * oppo 小游戏 runtime BOM/DOM polyfill 总入口（Phase 0 攻坚产物）。
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 调用约定
 * ─────────────────────────────────────────────────────────────────────────────
 *  - 必须独立模块 + 在 main.ts **第一行** import。
 *  - 原因：ESM 规范保证 import 先于模块体执行，本模块体会先于任何依赖
 *    `pixi.js` 的模块体执行 —— 而 Pixi 模块体（特别是 CanvasTextMetrics）
 *    在加载时就会读取 `Intl?.Segmenter`，没有 polyfill 直接 ReferenceError。
 *  - 模块体是 IIFE，副作用就是给 globalThis 挂上缺失字段。重复 import 无害
 *    （所有补丁都是 `typeof !== ...` 条件式）。
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 设计原则
 * ─────────────────────────────────────────────────────────────────────────────
 *  - **已存在字段不覆盖**（typeof === 'function' / 'string' / 'number' 等
 *    判断，已存在即跳过）。vivo runtime 实际提供的 API 保持原样。
 *  - **所有未实现方法用 no-op，不抛错**。小游戏环境无 DOM 概念，事件、查询
 *    等操作无效是正确语义，只要不让 Pixi 在初始化路径上崩。
 *  - **接口形状以 Pixi v8 调用点为准**，不追求 W3C 完整。
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 跨平台兼容性说明（OPPO 快游戏 / 华为快游戏 / 小米快游戏）
 * ─────────────────────────────────────────────────────────────────────────────
 *  - **当前只在 vivo runtime 验证过**。OPPO/华为/小米 真机未测。
 *  - 由于所有 polyfill 都是条件式（仅补缺失项），理论上在那些 runtime 上
 *    import 这个模块也是安全的 —— 它们 runtime 提供的字段会被保留，仅补
 *    它们也缺失的字段。
 *  - 但是 vivo 特有的 quirk（如 createElement 只接受 'canvas' 类型）在
 *    其他平台不一定存在，wrap 行为可能造成轻微性能损耗（多一次函数调用），
 *    但不影响正确性。
 *  - 真要上 OPPO/华为/小米 前，建议按相同方式 grep 它们的 runtime 行为，
 *    再决定要不要单独走一份 polyfill。
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 穷举源
 * ─────────────────────────────────────────────────────────────────────────────
 *  通过对 `node_modules/pixi.js/lib` 全量 grep 得到 Pixi v8 main-thread 用到的
 *  所有 `document.* / globalThis.* / navigator.* / window.*` API。下面每个
 *  polyfill 段都标注了对应的 Pixi 调用点。
 */
(() => {
  // ----------------------------------------------------------------------
  // 严格模式短路：普通浏览器 dev（无 ?oppo-strict 标志、无 qg/tt/ks runtime）直接 return，
  // 让 PixiJS 走真原生 DOM / EventSystem，最佳表现力。本短路必须放在所有副作用之前。
  // ----------------------------------------------------------------------
  if (!isOppoStrictMode()) {
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log('[oppo-polyfill] skip (not oppo-strict mode; add ?oppo-strict to URL to enable)');
    }
    return;
  }

  // ----------------------------------------------------------------------
  // 通用工具
  // ----------------------------------------------------------------------
  const noop = (): void => {};
  const trueFn = (): boolean => true;
  const nullFn = (): null => null;
  const emptyArrFn = (): unknown[] => [];

  type AnyRec = Record<string, unknown>;
  const g = globalThis as unknown as AnyRec & {
    qg?: { createCanvas?: () => unknown };
  };

  function log(msg: string): void {
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log('[oppo-polyfill] ' + msg);
    }
  }

  function createStubElement(tagName: string): AnyRec {
    const style: Record<string, string> = new Proxy({}, {
      get: (target, k) => (k in target ? (target as AnyRec)[k as string] : ''),
      set: (target, k, v) => {
        (target as AnyRec)[k as string] = String(v);
        return true;
      },
    }) as unknown as Record<string, string>;
    const stub: AnyRec = {
      tagName,
      nodeName: tagName ? tagName.toUpperCase() : '',
      nodeType: 1,
      style,
      children: [],
      childNodes: [],
      parentNode: null,
      parentElement: null,
      ownerDocument: null,
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      textContent: '',
      innerHTML: '',
      innerText: '',
      title: '',
      id: '',
      className: '',
      classList: {
        add: noop,
        remove: noop,
        toggle: noop,
        contains: () => false,
      },
      appendChild: (child: unknown) => child,
      removeChild: (child: unknown) => child,
      insertBefore: (child: unknown) => child,
      replaceChild: (newChild: unknown) => newChild,
      setAttribute: noop,
      removeAttribute: noop,
      getAttribute: nullFn,
      hasAttribute: () => false,
      setAttributeNS: noop,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: trueFn,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
      }),
      contains: () => false,
      remove: noop,
      cloneNode: () => createStubElement(tagName),
      focus: noop,
      blur: noop,
      click: noop,
      querySelector: nullFn,
      querySelectorAll: emptyArrFn,
      getElementsByTagName: emptyArrFn,
      getElementsByClassName: emptyArrFn,
      // HTMLVideoElement stub：PixiJS v8 Assets 启动时调 document.createElement('video').canPlayType('video/mp4')
      // 来检测视频支持。返 '' 表示不支持任何格式，PIXI 会跳过 video texture 路径。
      canPlayType: () => '',
      // HTMLMediaElement stub：play / pause / load 等方法 PIXI 可能在 cleanup 时触碰
      play: () => Promise.resolve(),
      pause: noop,
      load: noop,
    };
    return stub;
  }

  /**
   * 对已存在的元素对象（可能是 vivo runtime 提供的不完整 stub）逐字段补齐方法。
   * 已存在的不覆盖。`containsTreatAsTrue` 用于 document/body 这类容器：
   *   Pixi WebGLRenderer.isRenderingToScreen 调 `document.body.contains(canvas)`
   *   判断 canvas 是否挂载在 DOM 上。返 true 让它认为已挂载，跳渲染才正确。
   */
  function ensureElementMethods(el: AnyRec, containsTreatAsTrue: boolean): void {
    if (typeof el.appendChild !== 'function') el.appendChild = (c: unknown) => c;
    if (typeof el.removeChild !== 'function') el.removeChild = (c: unknown) => c;
    if (typeof el.insertBefore !== 'function') el.insertBefore = (c: unknown) => c;
    if (typeof el.replaceChild !== 'function') el.replaceChild = (n: unknown) => n;
    if (typeof el.contains !== 'function') el.contains = containsTreatAsTrue ? trueFn : (() => false);
    if (typeof el.addEventListener !== 'function') el.addEventListener = noop;
    if (typeof el.removeEventListener !== 'function') el.removeEventListener = noop;
    if (typeof el.dispatchEvent !== 'function') el.dispatchEvent = trueFn;
    if (typeof el.setAttribute !== 'function') el.setAttribute = noop;
    if (typeof el.removeAttribute !== 'function') el.removeAttribute = noop;
    if (typeof el.getAttribute !== 'function') el.getAttribute = nullFn;
    if (typeof el.hasAttribute !== 'function') el.hasAttribute = () => false;
    if (typeof el.setAttributeNS !== 'function') el.setAttributeNS = noop;
    if (typeof el.querySelector !== 'function') el.querySelector = nullFn;
    if (typeof el.querySelectorAll !== 'function') el.querySelectorAll = emptyArrFn;
    if (typeof el.getElementsByTagName !== 'function') el.getElementsByTagName = emptyArrFn;
    if (typeof el.getElementsByClassName !== 'function') el.getElementsByClassName = emptyArrFn;
    if (typeof el.getElementById !== 'function') el.getElementById = nullFn;
    if (typeof el.getBoundingClientRect !== 'function') {
      el.getBoundingClientRect = () => ({
        left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
      });
    }
    if (typeof el.remove !== 'function') el.remove = noop;
    if (typeof el.cloneNode !== 'function') el.cloneNode = () => createStubElement('');
    if (typeof el.focus !== 'function') el.focus = noop;
    if (typeof el.blur !== 'function') el.blur = noop;
    if (typeof el.click !== 'function') el.click = noop;
    if (!el.style || typeof el.style !== 'object') {
      el.style = new Proxy({}, {
        get: (target, k) => (k in target ? (target as AnyRec)[k as string] : ''),
        set: (target, k, v) => {
          (target as AnyRec)[k as string] = String(v);
          return true;
        },
      });
    }
    if (!el.classList || typeof el.classList !== 'object') {
      el.classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
    }
    if (!('children' in el)) el.children = [];
    if (!('childNodes' in el)) el.childNodes = [];
    if (!('parentNode' in el)) el.parentNode = null;
    if (!('parentElement' in el)) el.parentElement = null;
    if (!('textContent' in el)) el.textContent = '';
    if (!('innerHTML' in el)) el.innerHTML = '';
  }

  // ======================================================================
  // 1. Intl
  // ----------------------------------------------------------------------
  // 为什么需要：
  //   Pixi v8 `scene/text/canvas/CanvasTextMetrics.mjs` 模块体（不是函数体）跑：
  //     _CanvasTextMetrics.graphemeSegmenter = (() => {
  //       if (typeof Intl?.Segmenter === "function") { ... }
  //       return (s) => [...s];
  //     })();
  //   注意 `Intl?.Segmenter` 不是 `typeof Intl`：optional chaining 先读取 Intl，
  //   vivo runtime 没有 Intl 全局 → bare 引用直接 ReferenceError，整个 main.js
  //   加载失败。Pixi 自带的 fallback `(s) => [...s]` 根本进不到。
  //
  // 为什么这样实现：
  //   注入一个空对象 `Intl = {}`。`Intl?.Segmenter` 会取到 undefined，
  //   `typeof undefined === "function"` 为 false，走 fallback 按 codepoint 拆字。
  //   对中文棋盘 UI（没有 ZWJ emoji、没有复合字符）完全够用。
  //
  // 跨平台：OPPO/华为/小米 大概率也没有 Intl 全局（小游戏 runtime 普遍精简）。
  //   条件赋值，已有则跳过，安全。
  // ======================================================================
  if (typeof g.Intl === 'undefined') {
    g.Intl = {};
    log('Intl stubbed');
  }

  // ======================================================================
  // 2. navigator
  // ----------------------------------------------------------------------
  // 为什么需要：
  //   - `environment-browser/BrowserAdapter.mjs` 的 getNavigator: () => navigator
  //     裸读 navigator → vivo 上 ReferenceError。
  //   - `utils/browser/isSafari.mjs`: 读 `userAgent.toLowerCase()`。
  //   - `utils/browser/isMobile.mjs`: 读 `userAgent / platform / maxTouchPoints`。
  //   - `events/EventSystem.mjs`: 读 `navigator.msPointerEnabled`。
  //   - `utils/browser/isWebGPUSupported.mjs`: 读 `navigator.gpu`。
  //   - `assets` workerPool 用 `navigator.hardwareConcurrency`。
  //
  // 为什么这样实现：
  //   - userAgent='' → isSafari 正则不匹配返 false（vivo 不是 Safari，符合事实）。
  //   - gpu=null → isWebGPUSupported 直接 return false（我们用 WebGL 1）。
  //   - hardwareConcurrency=4 → worker pool 取个保守默认。
  //   - msPointerEnabled=false → 跳过 IE 兼容路径。
  //
  // 跨平台：OPPO/华为/小米 同样无 navigator 全局，条件补缺安全。
  // ======================================================================
  if (typeof g.navigator === 'undefined') {
    g.navigator = {};
    log('navigator stubbed');
  }
  const nav = g.navigator as AnyRec;
  if (typeof nav.userAgent !== 'string') nav.userAgent = '';
  if (typeof nav.platform !== 'string') nav.platform = 'oppo-quickgame';
  if (typeof nav.language !== 'string') nav.language = 'zh-CN';
  if (!Array.isArray(nav.languages)) nav.languages = ['zh-CN', 'zh'];
  if (typeof nav.hardwareConcurrency !== 'number') nav.hardwareConcurrency = 4;
  if (typeof nav.maxTouchPoints !== 'number') nav.maxTouchPoints = 1;
  if (typeof nav.msPointerEnabled === 'undefined') nav.msPointerEnabled = false;
  if (typeof nav.onLine !== 'boolean') nav.onLine = true;
  if (!('gpu' in nav)) nav.gpu = null;
  if (!('mediaCapabilities' in nav)) {
    nav.mediaCapabilities = {
      decodingInfo: () => Promise.resolve({ supported: false, smooth: false, powerEfficient: false }),
    };
  }

  // ======================================================================
  // 3. document
  // ----------------------------------------------------------------------
  // 为什么需要：
  //   vivo runtime 实测有 document 全局，但是个不完整 stub。已知缺陷：
  //   (a) createElement 拒绝非 'canvas' 类型，返 undefined 并打错误日志
  //       `you create div type, but only canvas type can be created now!`
  //       —— 被 Pixi DOMPipe / AccessibilitySystem constructor 直接调炸。
  //   (b) addEventListener / removeEventListener / dispatchEvent / contains
  //       等方法不存在 —— Pixi EventSystem.init 调 document.addEventListener
  //       TypeError；WebGLRenderer.isRenderingToScreen 调 body.contains 同样炸。
  //
  // 为什么这样实现：
  //   - createElement wrap：原生路径只用 'canvas'，其他一律返回完整 stub
  //     元素（避免 undefined 解引用）。
  //   - 方法用 ensureElementMethods 工具逐字段补齐，已存在的不覆盖。
  //   - body / documentElement / head 走 ensureElementMethods + containsTreatAsTrue=true：
  //     Pixi WebGLRenderer.isRenderingToScreen 期望 body.contains(canvas) 为 true
  //     才会渲染，所以容器语义的 contains 默认返 true。
  //
  // 跨平台：
  //   - createElement wrap：OPPO/华为/小米 如果原生 createElement 工作正常，
  //     wrap 后非 canvas 也返 stub，与原生行为不一致 —— **可能需要按平台区分**。
  //   - ensureElementMethods：所有补丁条件式，对已经完整的 document 无影响。
  // ======================================================================
  if (typeof g.document === 'undefined') {
    g.document = {};
    log('document object stubbed');
  }
  const doc = g.document as AnyRec;

  // 3a) createElement —— vivo 关键 wrap，详见上面"为什么需要 (a)"。
  if (typeof doc.createElement === 'function') {
    const original = (doc.createElement as (...args: unknown[]) => unknown).bind(doc);
    doc.createElement = (tag: string) => {
      const t = typeof tag === 'string' ? tag.toLowerCase() : '';
      if (t === 'canvas') {
        const c = original('canvas');
        if (c) return c;
        if (g.qg?.createCanvas) return g.qg.createCanvas();
        return createStubElement(t);
      }
      return createStubElement(t);
    };
    log('document.createElement wrapped');
  } else {
    doc.createElement = (tag: string) => {
      const t = typeof tag === 'string' ? tag.toLowerCase() : '';
      if (t === 'canvas' && g.qg?.createCanvas) return g.qg.createCanvas();
      return createStubElement(t);
    };
    log('document.createElement stubbed');
  }

  // 3b) createElementNS —— Pixi HTMLText 的 SVG 通路（即便 HTMLText 被拔除，
  //     兜底防御）。
  if (typeof doc.createElementNS !== 'function') {
    doc.createElementNS = (_ns: string, tag: string) => createStubElement(tag);
  }

  // 3c) 杂项字段
  if (typeof doc.baseURI !== 'string') doc.baseURI = '';
  if (!('fonts' in doc)) doc.fonts = null;
  if (typeof doc.readyState !== 'string') doc.readyState = 'complete';
  if (typeof doc.visibilityState !== 'string') doc.visibilityState = 'visible';
  if (typeof doc.hidden !== 'boolean') doc.hidden = false;
  if (typeof doc.title !== 'string') doc.title = '';
  if (!('cookie' in doc)) doc.cookie = '';

  // 3d) body / documentElement / head / document 自身 —— 逐字段补齐方法。
  //     containsTreatAsTrue=true 让 body.contains(canvas) 返 true，让
  //     Pixi WebGLRenderer.isRenderingToScreen 走渲染分支。
  if (!doc.body) doc.body = createStubElement('body');
  if (!doc.documentElement) doc.documentElement = createStubElement('html');
  if (!doc.head) doc.head = createStubElement('head');
  ensureElementMethods(doc.body as AnyRec, true);
  ensureElementMethods(doc.documentElement as AnyRec, true);
  ensureElementMethods(doc.head as AnyRec, true);
  ensureElementMethods(doc, true);

  // ======================================================================
  // 4. window / globalThis BOM
  // ----------------------------------------------------------------------
  // 为什么需要：
  //   - `app/ResizePlugin.mjs`: globalThis.addEventListener("resize")
  //     + globalThis.innerWidth / innerHeight
  //   - `events/EventSystem.mjs`: globalThis.addEventListener("keydown" /
  //     "mouseup" / "pointerup")
  //   - `environment-webworker/WebWorkerAdapter`: globalThis.location.href
  //   - `app/Application.mjs`: this._resizeTo === globalThis.window 比较
  //
  // 为什么这样实现：
  //   - vivo runtime 没有 window 全局：直接把 window 别名到 globalThis，
  //     避免 `globalThis.window === undefined` 比较出问题。
  //   - addEventListener/removeEventListener no-op：Smoke 不需要响应全局事件。
  //   - innerWidth/innerHeight 设安全默认（750×1334），Pixi 没用这些数会去
  //     resize 主 canvas，但我们 Smoke 自己 resize，不依赖。
  //   - location 全字段 stub：Pixi worker 加载 KTX/Basis 时会构造 URL。
  //
  // 跨平台：OPPO/华为/小米 同样小游戏环境无 window 全局，条件补缺安全。
  // ======================================================================
  if (typeof g.window === 'undefined') {
    g.window = g;
    log('window aliased to globalThis');
  }
  if (typeof g.addEventListener !== 'function') g.addEventListener = noop;
  if (typeof g.removeEventListener !== 'function') g.removeEventListener = noop;
  if (typeof g.dispatchEvent !== 'function') g.dispatchEvent = trueFn;
  const win = g.window as AnyRec;
  if (win !== g) {
    if (typeof win.addEventListener !== 'function') win.addEventListener = noop;
    if (typeof win.removeEventListener !== 'function') win.removeEventListener = noop;
    if (typeof win.dispatchEvent !== 'function') win.dispatchEvent = trueFn;
  }

  if (typeof g.innerWidth !== 'number') g.innerWidth = 750;
  if (typeof g.innerHeight !== 'number') g.innerHeight = 1334;
  if (typeof g.devicePixelRatio !== 'number') g.devicePixelRatio = 1;

  if (typeof g.location === 'undefined') {
    g.location = {
      href: '',
      origin: '',
      protocol: 'https:',
      host: '',
      hostname: '',
      port: '',
      pathname: '/',
      search: '',
      hash: '',
      reload: noop,
      replace: noop,
      assign: noop,
      toString: () => '',
    };
    log('location stubbed');
  }
  if (typeof (g.location as AnyRec).href !== 'string') (g.location as AnyRec).href = '';

  // requestAnimationFrame / cancelAnimationFrame —— vivo 实际提供，但保险。
  if (typeof g.requestAnimationFrame !== 'function') {
    g.requestAnimationFrame = ((cb: (t: number) => void) =>
      (g.setTimeout as (h: () => void, ms: number) => number)(() => cb(Date.now()), 16)) as unknown as (
      cb: FrameRequestCallback,
    ) => number;
  }
  if (typeof g.cancelAnimationFrame !== 'function') {
    g.cancelAnimationFrame = ((handle: number) =>
      (g.clearTimeout as (h: number) => void)(handle)) as unknown as (handle: number) => void;
  }

  // matchMedia —— Pixi 有些路径会读，stub 成永远 false。
  if (typeof g.matchMedia !== 'function') {
    g.matchMedia = (_q: string) => ({
      matches: false,
      media: _q,
      onchange: null,
      addEventListener: noop,
      removeEventListener: noop,
      addListener: noop,
      removeListener: noop,
      dispatchEvent: trueFn,
    });
  }

  // ======================================================================
  // 5. DOM / Event 构造器
  // ----------------------------------------------------------------------
  // 为什么需要：
  //   Pixi 用 `resource instanceof HTMLCanvasElement` / `instanceof Image`
  //   等检查纹理源类型。vivo runtime 没有这些全局构造器 → bare 引用 ReferenceError。
  //
  // 为什么这样实现：
  //   - 空类 `class {}` 占位即可。`instanceof StubClass` 对 vivo qg 创建的
  //     真实 canvas 总是返回 false（原型链不同），让 Pixi 走 generic fallback
  //     分支处理这些资源 —— 对 Smoke（Graphics + Text + Texture.WHITE）来说
  //     不会进 instanceof 检查路径，无影响。
  //   - Image stub 提供 width/height/src/onload/onerror，给 Pixi 异步加载
  //     图片的代码兜底（Smoke 不会触发，但未来加图片资源会需要）。
  //
  // 跨平台：OPPO/华为/小米 如果有真实 HTMLCanvasElement 全局，条件赋值跳过，
  //   不影响 instanceof 真值。
  // ======================================================================
  const stubCtors = [
    'HTMLCanvasElement',
    'HTMLImageElement',
    'HTMLVideoElement',
    'HTMLAnchorElement',
    'HTMLDivElement',
    'ImageBitmap',
    'OffscreenCanvas',
    'Path2D',
    'FontFace',
    'DOMParser',
    'XMLSerializer',
  ];
  for (const name of stubCtors) {
    if (typeof g[name] === 'undefined') {
      g[name] = class {};
    }
  }

  if (typeof g.Image === 'undefined') {
    g.Image = class StubImage {
      width = 0;
      height = 0;
      src = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      addEventListener = noop;
      removeEventListener = noop;
    };
  }
  for (const ev of ['PointerEvent', 'TouchEvent', 'MouseEvent', 'WheelEvent', 'KeyboardEvent', 'FocusEvent']) {
    if (typeof g[ev] === 'undefined') {
      g[ev] = class StubEvent {
        type = '';
        target = null;
      };
    }
  }

  // 时机关键：document / window 全部补齐后立即装全局 pointer 路由，
  // 早于 main.ts 后续 import（PixiRenderer 等）模块顶层求值。
  installGlobalRoutes();

  log('init complete');
})();
