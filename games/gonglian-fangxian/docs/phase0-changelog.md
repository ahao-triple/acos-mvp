# Phase 0 攻坚清单 — vivo + PixiJS v8

> Smoke 目标：在 vivo 真机上跑通 PixiJS v8 渲染管线，验证 (1) `Graphics.roundRect().fill().stroke()` 走 tessellation 绕开 vivo Canvas2D path bug；(2) 中文 Text 字体管线；(3) Sprite + Texture 通路。
>
> 起点：v1.0.11（旧 Canvas2D 渲染器，path API bug 黑屏）  
> 终点：**v1.0.22 / code 23**（Pixi v8 Smoke 三项验证全通过，画面正常显示）

---

## 修复列表（按出现顺序）

### 修复 1. PixiJS v8 安装 + Phase 0 Smoke 骨架
- 装 `pixi.js@^8.18.1`（核心包，不带 spine/filters/sound 等扩展）。
- 新建 `src/render/vivoPixiSmoke.ts`：自取 `mainCanvas.getContext('webgl', { alpha: false })`，通过 `Application.init({ canvas, context, preferWebGLVersion: 1, preference: 'webgl' })` 传给 Pixi —— 强制 WebGL 1（vivo 默认 WebGL 1，不指望 v2），同时避免 Pixi 内部再 `getContext` 引入未知行为。
- 包含 Smoke 内容：3 个 `roundRect` 按钮 + 中文 Text + Sprite + 实时 fps。

### 修复 2. `Intl` 全局缺失 → ReferenceError
- **症状**：vivo 真机加载 main.js 时 `Uncaught ReferenceError: Intl is not defined` at `CanvasTextMetrics.mjs`。
- **根因**：Pixi v8 `scene/text/canvas/CanvasTextMetrics.mjs` 模块体跑 `if (typeof Intl?.Segmenter === "function")`。注意 `Intl?.Segmenter` 不是 `typeof Intl`，optional chaining **先读取 Intl**，bare 引用在 vivo 上直接 ReferenceError。
- **修复**：在 polyfill 注入空 `Intl = {}`。`Intl?.Segmenter` 取到 undefined，走 Pixi 内置 fallback `(s) => [...s]`（按 codepoint 拆字，中文棋盘 UI 完全够用）。
- 文件：`platform/vivo/dom-polyfill.ts` 段 1

### 修复 3. `navigator` 全局缺失 → ReferenceError
- **症状**：`isSafari` 在 `glUploadVideoResource.mjs` 模块加载时被调，读 `userAgent` 触发 ReferenceError。
- **根因**：Pixi `BrowserAdapter.getNavigator: () => navigator` 裸读 navigator。
- **修复**：注入 `navigator = { userAgent: '', gpu: null, hardwareConcurrency: 4, ... }`。
- 文件：`platform/vivo/dom-polyfill.ts` 段 2

### 修复 4. `unsafe-eval` 被禁 → Pixi `_unsafeEvalCheck` 抛错
- **症状**：`Current environment does not allow unsafe-eval, please use pixi.js/unsafe-eval module`。
- **根因**：vivo runtime 不允许 `new Function()` / `eval`，Pixi v8 默认用它们生成 shader sync / UBO sync 代码。
- **修复**：`import 'pixi.js/unsafe-eval'`。这是 Pixi 官方提供的 self-installing 子包，import 后会 patch `AbstractRenderer` / `UboSystem` / `GlShaderSystem` 等 prototype，把 eval 路径换成 polyfill 实现。
- 文件：`render/vivoPixiSmoke.ts` 顶部

### 修复 5. PixiJS BrowserAdapter 整体替换 → vivo DOMAdapter
- **思路**：Pixi v8 把所有 DOM 调用集中在 `DOMAdapter.get()`，这是官方扩展点。在 `Application.init` 之前 `DOMAdapter.set(vivoAdapter)`，让 createCanvas/createImage 走 `qg.createCanvas()`/`qg.createImage()`，getNavigator 返回本地 stub，getFontFaceSet 返 null，fetch/parseXML 抛错（Phase 0 不该被触发）。
- 文件：`platform/vivo/pixi-adapter.ts`

### 修复 6. `DOMPipe` constructor 调 `document.createElement("div")` → vivo 拒绝
- **症状**：`### App Framework ### [error] you create div type, but only canvas type can be created now!` 紧接着 `Cannot set properties of undefined (setting position) at new DOMPipe`。
- **根因**：vivo runtime 的 `document.createElement` 只接受 `'canvas'` 类型，其他类型返 undefined 并打错误日志。Pixi `DOMPipe.constructor` 直接读 `div.style.position` 崩。
- **关键发现**：`extensions.remove()` 在 renderer 未创建时**是 no-op**（看 Pixi v8 `extensions/Extensions.mjs:73-77`，`remove()` 只调 `_removeHandlers[type]?.()`，handler 在 renderer 创建时才注册；而 `add()` 在 handler 未注册时把 extension 推到 `_queue[type]` 里等 flush）。
- **修复**：直接 mutate `extensions._queue`，按 `ref` 过滤掉 `DOMPipe` 条目（同时拔掉 `AccessibilitySystem` / `EventSystem` / `HTMLTextPipe` / `HTMLTextSystem`，这些 Smoke 都用不到且都依赖 DOM）。
- 文件：`render/vivoPixiSmoke.ts` 的 `removePixiExtensionsByRef`

### 修复 7. `document.createElement('div')` 兜底（防御）
- **思路**：即便已拔除 DOMPipe，未来 Pixi 加新 DOM 依赖、或其他模块调 createElement('div')，仍然崩。Wrap 全局 `document.createElement`：原生路径只用 'canvas'（先尝试原生，失败回退 `qg.createCanvas`），非 canvas 一律返回完整 stub 元素。
- 文件：`platform/vivo/dom-polyfill.ts` 段 3a

### 修复 8. `EventSystem.init` 调 `globalThis.document.addEventListener("pointermove")` → 函数不存在
- **症状**：`globalThis.document.addEventListener is not a function`。
- **根因**：vivo runtime 的 `document` 只有 createElement，没有事件接口。
- **修复**：双重保险：
  1. 把 `EventSystem` 加入 `_queue` 拔除列表（Smoke 不需要事件）；
  2. polyfill `document.addEventListener` / `removeEventListener` / `dispatchEvent` no-op 兜底。
- 文件：`platform/vivo/dom-polyfill.ts` 段 3 + `render/vivoPixiSmoke.ts` 拔除列表

### 修复 9. `document.body.contains is not a function` → 每帧报错
- **症状**：Application.init 通过，但 render loop 每帧崩。
- **根因**：Pixi `WebGLRenderer.isRenderingToScreen` 调 `document.body.contains(canvas)` 判断 canvas 是否挂在 DOM 上。vivo runtime 的 document.body 是个不完整 stub，没有 contains 方法。
- **修复**：用 `ensureElementMethods(el, containsTreatAsTrue=true)` 工具，对 `document` / `document.body` / `document.documentElement` / `document.head` 逐字段补齐方法（contains/appendChild/removeChild/insertBefore/replaceChild/addEventListener/...）。容器语义的 `contains` 默认返回 true，让 Pixi 认为 canvas 已挂载，正常渲染。
- 关键设计：**不再用「整个对象 if (!exists)」判断**——vivo runtime 已经有部分 stub 时，那种条件会跳过补齐。改用「按字段 typeof !== 'function'」判断，逐个补缺。
- 文件：`platform/vivo/dom-polyfill.ts` 段 3d + `ensureElementMethods`

### 修复 10. 穷举式 polyfill 补全
- **思路**：停止「撞一个修一个」节奏，grep 整个 `node_modules/pixi.js/lib` 列出所有 main-thread BOM/DOM 引用，一次性补全。
- **补全清单**：
  - `Intl`、`navigator.*`（userAgent / platform / language / languages / hardwareConcurrency / maxTouchPoints / msPointerEnabled / onLine / gpu / mediaCapabilities）
  - `document.*`（createElement wrap、createElementNS、baseURI、fonts、readyState、visibilityState、hidden、title、cookie，加 ensureElementMethods 全套方法）
  - `document.body` / `document.documentElement` / `document.head` 走 `ensureElementMethods(_, containsTreatAsTrue=true)`
  - `window`（别名 globalThis）、`window.addEventListener` 等
  - `innerWidth=750` / `innerHeight=1334` / `devicePixelRatio=1`
  - `location.*`（href / origin / protocol / host / hostname / port / pathname / search / hash / reload / replace / assign / toString）
  - `requestAnimationFrame` / `cancelAnimationFrame` / `matchMedia` 兜底
  - DOM 构造器：`HTMLCanvasElement` / `HTMLImageElement` / `HTMLVideoElement` / `HTMLAnchorElement` / `HTMLDivElement` / `ImageBitmap` / `OffscreenCanvas` / `Path2D` / `FontFace` / `DOMParser` / `XMLSerializer`
  - Event 构造器：`PointerEvent` / `TouchEvent` / `MouseEvent` / `WheelEvent` / `KeyboardEvent` / `FocusEvent`
  - `Image` 带 stub 字段（width / height / src / onload / onerror）
- 文件：`platform/vivo/dom-polyfill.ts` 全文

---

## 现存治本 vs 兜底分层

| 层 | 文件 | 时机 | 作用 |
|---|---|---|---|
| 兜底 | `platform/vivo/dom-polyfill.ts` | main.ts 第一行 import | 全局 BOM/DOM 补齐，已存在不覆盖 |
| 治本 | `platform/vivo/pixi-adapter.ts` 的 `setupVivoPixiDOMAdapter()` | `Application.init` 前调用 | 替换 Pixi DOMAdapter，createCanvas/createImage 直接走 `qg.*` |
| 治本 | `render/vivoPixiSmoke.ts` 的 `removePixiExtensionsByRef(...)` | `Application.init` 前调用 | mutate `extensions._queue`，拔掉 DOMPipe / AccessibilitySystem / EventSystem / HTMLTextPipe / HTMLTextSystem |

兜底永远开着；治本只走过 Smoke 路径需要的几条。Phase 1 业务化时，EventSystem 等可能要恢复，但需要在 canvas 上 addEventListener 经过兜底，应该 OK。

---

## Phase 0 Smoke 验证项

| 验证项 | Smoke 画面位置 | 验证什么 |
|---|---|---|
| `Graphics.roundRect().fill().stroke()` × 3 | y=220 / 380 / 500（A 白底黑边、B 金底黑边、C 蓝底白边） | tessellation 绕开 vivo Canvas2D path bug |
| 中文 `Text` | 标题 "龚联防线 · PixiJS v8" + 副标题 + 多行 body | 字体管线 |
| `Sprite(Texture.WHITE)` + tint | y=940 红色色块 | Sprite / Texture / sampler 通路 |
| 实时 fps | y=1274 | ticker + 渲染稳定性 |

---

## 资产位置

```
src/platform/vivo/
  dom-polyfill.ts        # 全局 BOM/DOM polyfill 总入口（必须 main.ts 第一行 import）
  pixi-adapter.ts        # Pixi DOMAdapter.set（必须 Application.init 前调用）

src/render/
  vivoPixiSmoke.ts       # Phase 0 Smoke renderer（含 _queue mutate 拔 extension）
```

---

## Bundle 大小（v1.0.22 / code 23）

| 产物 | 大小 |
|---|---|
| `dist/assets/index-DJip1xor.js`（含 Pixi v8 + unsafe-eval + polyfill + Smoke 业务）| **299.73 KB minified / 87.76 KB gzip** |
| `dist/assets/browserAll-Cka1foPi.js` | 2.16 KB / 0.82 KB gzip |
| `dist/assets/webworkerAll-C1-3BNHP.js` | 33.52 KB / 10.54 KB gzip |
| **总 `.rpk`（vivo 包）** | **2.1 MB** |

vivo 主包上限 4 MB，剩约 50% 余量给 Phase 1 资源。
