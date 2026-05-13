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

interface VivoQgRequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  data?: unknown;
  header?: Record<string, string>;
  dataType?: 'string' | 'arraybuffer' | 'json';
  success?: (result: { statusCode?: number; data?: unknown; header?: Record<string, string> }) => void;
  fail?: (error: { errMsg?: string }) => void;
}

type VivoQgGlobal = {
  createCanvas?: () => unknown;
  createImage?: () => unknown;
  request?: (options: VivoQgRequestOptions) => void;
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

    // fetch: vivo runtime 没有标准 fetch，用 qg.request 包装成最小 Response-like 对象。
    // 用于 PixiJS Assets.load('fonts/main.fnt') 加载字体图集（绕开 Canvas2D fillText alpha bug
    // 见 docs/vivo-quirks.md）。PNG 走 qg.createImage 的 Image 路径，不走 fetch。
    // ⚠️ 资源路径**必须用相对路径**（不带前导斜杠），否则 qg.request 会当网络 URL 请求 → 404，
    // 见 docs/vivo-quirks.md "资源加载 - 前导斜杠" 段。
    fetch: ((url: unknown, _options?: unknown) => {
      const reqUrl = typeof url === 'string' ? url : String((url as { url?: string })?.url ?? url);
      const isLocalAsset = !/^https?:\/\//i.test(reqUrl);
      console.log('[vivo-pixi-adapter] fetch:', reqUrl, 'isLocal:', isLocalAsset);
      if (!qg?.request) {
        return Promise.reject(new Error('[vivo-pixi-adapter] qg.request unavailable'));
      }
      const isBinary = /\.(png|jpg|jpeg|webp|bin)(\?|$)/i.test(reqUrl);
      return new Promise((resolve, reject) => {
        const timer = globalThis.setTimeout(() => {
          console.error('[vivo-pixi-adapter] fetch timeout (8s):', reqUrl);
          reject(new Error('[vivo-pixi-adapter] fetch timeout: ' + reqUrl));
        }, 8000);
        qg.request!({
          url: reqUrl,
          method: 'GET',
          dataType: isBinary ? 'arraybuffer' : 'string',
          success: (res) => {
            globalThis.clearTimeout(timer);
            console.log('[vivo-pixi-adapter] fetch success:', reqUrl, res?.statusCode ?? 200);
            const data = res?.data;
            const status = res?.statusCode ?? 200;
            const ok = status >= 200 && status < 300;
            const textValue = typeof data === 'string' ? data : '';
            const bufferValue = isBinary && data && typeof data === 'object' ? (data as ArrayBuffer) : new ArrayBuffer(0);
            resolve({
              ok,
              status,
              headers: { get: () => null },
              text: () => Promise.resolve(textValue),
              arrayBuffer: () => Promise.resolve(bufferValue),
              blob: () => Promise.reject(new Error('[vivo-pixi-adapter] fetch.blob not supported')),
              json: () => Promise.resolve(textValue ? JSON.parse(textValue) : null),
            } as unknown as Response);
          },
          fail: (err) => {
            globalThis.clearTimeout(timer);
            console.error('[vivo-pixi-adapter] fetch fail:', reqUrl, err);
            reject(new Error(err?.errMsg ?? '[vivo-pixi-adapter] qg.request failed'));
          },
        });
      });
    }) as unknown as ReturnType<typeof DOMAdapter.get>['fetch'],
    parseXML: ((xml: string) => {
      // PixiJS BitmapFontLoader 解析 .fnt（XML 格式）时调 parseXML —— vivo runtime 无 DOMParser，
      // 用轻量 regex parse 出 BMFont 节点。不支持 namespace / CDATA / 自闭合外的 HTML 怪招。
      // 仅满足 msdf-bmfont-xml 产物的 <info> <common> <pages> <chars> <char/> <kerning/> 结构。
      return parseBmfontXml(xml);
    }) as unknown as ReturnType<typeof DOMAdapter.get>['parseXML'],
  });

  if (typeof console !== 'undefined' && typeof console.log === 'function') {
    console.log('[vivo-pixi-adapter] DOMAdapter installed (qg=%s)', qg ? 'yes' : 'no');
  }
}

/**
 * 最小 BMFont XML parser —— 返回 mock DOM document-like 对象，
 * 支持 PixiJS v8 BitmapFontLoader 用到的 getElementsByTagName / querySelectorAll / getAttribute 调用。
 *
 * 不实现完整 XML：仅满足 msdf-bmfont-xml 产物结构（自闭合 char/page/kerning + 嵌套 info/common/pages/chars/kernings）。
 */
interface MockElement {
  tagName: string;
  getAttribute(name: string): string | null;
  getElementsByTagName(name: string): MockElement[];
  querySelectorAll(selector: string): MockElement[];
}

interface MockDocument {
  getElementsByTagName(name: string): MockElement[];
  querySelectorAll(selector: string): MockElement[];
  documentElement: MockElement;
}

function parseBmfontXml(xml: string): MockDocument {
  // 抓所有 tag —— 含开标签 / 自闭合标签。属性 name="value" 提取
  const elements: Array<{ name: string; attrs: Record<string, string> }> = [];
  const tagRe = /<(\w+)\s*([^>]*?)\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(xml)) !== null) {
    const name = match[1];
    if (name === '?xml' || name === '!--' || name === '/font' || name === '/pages' || name === '/chars' || name === '/kernings') {
      continue;
    }
    const attrs: Record<string, string> = {};
    const attrRe = /(\w+)\s*=\s*"([^"]*)"/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(match[2])) !== null) {
      attrs[am[1]] = am[2];
    }
    elements.push({ name, attrs });
  }

  const makeElement = (e: { name: string; attrs: Record<string, string> }): MockElement => ({
    tagName: e.name,
    getAttribute(name: string): string | null {
      return Object.prototype.hasOwnProperty.call(e.attrs, name) ? e.attrs[name] : null;
    },
    getElementsByTagName(name: string): MockElement[] {
      return elements.filter((el) => el.name === name).map(makeElement);
    },
    querySelectorAll(selector: string): MockElement[] {
      return elements.filter((el) => el.name === selector).map(makeElement);
    },
  });

  const fontRoot = elements.find((e) => e.name === 'font') ?? elements[0] ?? { name: 'font', attrs: {} };

  return {
    getElementsByTagName(name: string): MockElement[] {
      return elements.filter((el) => el.name === name).map(makeElement);
    },
    querySelectorAll(selector: string): MockElement[] {
      return elements.filter((el) => el.name === selector).map(makeElement);
    },
    documentElement: makeElement(fontRoot),
  };
}
