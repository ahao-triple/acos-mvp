# vivo 小游戏 runtime 已知坑位

本文档沉淀 vivo 小游戏 runtime 的真机实测异常 + 绕过策略。
**每条坑必须给：probe 证据 / 影响范围 / 绕过方法 / 不要尝试什么。**

发现新 quirk 时往这个文档追加，不要散落在 commit message 或个人笔记。

---

## Canvas2D

### ❌ fillText alpha 输出 ~10/255

- **发现日期**：2026-05-13
- **probe 证据**：`src/platform/vivo/canvas2d-text-probe.ts`
  ```
  fillStyle = '#FFFFFF'
  font = '900 24px sans-serif'
  fillText('A', 4, 4)
  → getImageData 第一个非透明像素 = [255, 255, 255, 10]
  ```
  RGB 值是对的（255,255,255 纯白），但 alpha 通道只有 10/255 ≈ 4% 不透明度。
- **现象**：白字在深背景上几乎完全透明 → 看起来像"消失"或"被背景色稀释成中灰"。
- **影响**：所有依赖 `ctx.fillText` 的渲染管线，包括 **PixiJS Text 内部字体图集生成**（PIXI v8 Text 走 Canvas2D fillText 离屏画字 → 上传 texture → Sprite 贴图，alpha 在第一步就崩了，后续无论怎么画都是半透明）。
- **绕过方法**：改用 **BitmapText + SDF 字体图集**（WebGL 直绘，完全不走 Canvas2D fillText 路径）。当前进行中，见阶段 2。
- **不要尝试**：
  - 调字重（昨晚 weight 700→900 被这个 bug 误导，**实际无关**）
  - 调 fillStyle 颜色格式（probe 证明 `#FFFFFF` / `rgb()` / number 三种都被正确解析）
  - 改 `ctx.globalAlpha`（probe 已证 alpha 不在 globalAlpha 上）
  - 加 stroke 描边（描边走 strokeText 路径，同样 alpha 衰减风险）

### ❌ OffscreenCanvas.getContext('2d') 不存在

- **发现日期**：2026-05-13
- **probe 证据**：
  ```
  new OffscreenCanvas(64, 64) 构造成功
  canvas.getContext is not a function（或返回 null）
  ```
  构造器存在但 `getContext` 没实装。
- **影响**：PixiJS 内部某些路径可能优先使用 OffscreenCanvas 做离屏渲染 / RenderTexture / Text 字体图集——这些路径在 vivo 上会直接抛错。
- **绕过方法**：强制走 `document.createElement('canvas')` 路径。当前 `src/platform/vivo/pixi-adapter.ts` 已经把 `DOMAdapter.createCanvas` 接到 `qg.createCanvas` 上，绕过 OffscreenCanvas。
- **TODO**：审 PixiJS v8 源码（特别是 `CanvasTextSystem` / `RenderTextureSystem`）是否有 OffscreenCanvas 优先逻辑可能漏网。

### ✅ fillStyle setter / fillRect 正常

- **发现日期**：2026-05-13
- **probe 证据**：
  ```
  fillStyle = '#FFFFFF'           → readback "rgb(255, 255, 255)"  ✓
  fillStyle = 'rgb(255,255,255)'  → readback "rgb(255, 255, 255)"  ✓
  fillStyle = 0xFFFFFF (number)   → readback "rgb(0, 0, 0)" 或被吞 ⚠️ (number 输入非标准 web API)
  fillRect(0,0,32,32) + getImageData(8,8) = [255, 255, 255, 255]   ✓
  ```
- **结论**：Canvas2D **fillRect / fillStyle setter 在 vivo 上是工作的**。
- **影响**：**PIXI.Graphics 路径在 vivo 上可信** —— 所有基于 Graphics 的元素（适龄图标 / 按钮 bg / 棋盘 / piece 圆角矩形 / EffectsLayer 粒子）继续正常工作，不必迁移。
- **注意**：fillStyle 不要传 number（非标准 web API），始终用 hex string 或 rgb() 字符串。

---

## WebGL

### ❌ OES_element_index_uint 不支持（WebGL 1）

- **发现日期**：2026-05-13（Phase 0）
- **现象**：PixiJS v8 默认 batcher 用 Uint32Array 作 index buffer，vivo WebGL 1 不支持 OES_element_index_uint 扩展，`drawElements` 失败。
- **绕过方法**：`patches/pixi.js+8.18.1.patch` 强制所有 index buffer 用 Uint16Array。patch-package 在 postinstall 自动 apply（`scripts/apply-pixi-patch.sh`）。
- **触发条件**：在 vivo / 任何 WebGL 1 only 环境下都会触发。

### ❌ MSDF shader 在 vivo WebGL 1 上颜色失效（待修）

- **发现日期**：2026-05-13
- **现象**：所有 BitmapText 强制深色，浏览器正常。
- **怀疑**：`OES_standard_derivatives` 扩展问题，导致 PixiJS MSDF shader 的颜色/边缘计算在 vivo WebGL 1 上异常。
- **临时绕过**：UI 改浅色主题，让深色字在浅色背景上可读。
- **待办**：probe vivo WebGL 扩展支持情况，可能需要换 plain bitmap font 或 patch PixiJS MSDF shader。

---

## Event Listener

### ❌ globalThis.addEventListener 是 configurable=false 的 accessor property

- **发现日期**：2026-05-13（Phase 0）
- **现象**：vivo runtime 把 `globalThis.addEventListener` 定义为不可重写的 getter-only 属性，`Object.defineProperty` / 直接赋值都失败（runtime warn `can not rewrite the property: addEventListener`）。
- **影响**：PixiJS v8 `EventSystem._addEvents` 用 `globalThis.addEventListener('pointerup', ...)` 注册 pointerup 监听器，被 vivo 锁死后该监听器从未生效 → tap-to-swap 行为缺失。
- **绕过方法**：组合两层补丁：
  1. `src/platform/vivo/listener-store.ts` 在 `globalThis / window / document` 上 force-install routed addEventListener，路由到内部 bucket（vivo 锁了 globalThis 那条，所以路由失败）
  2. `src/platform/vivo/event-bridge.ts` 通过 `qg.onTouchStart/Move/End/Cancel` 接管原生触摸，主动 dispatch 到 bucket 内的 handler
  3. 同时 monkey-patch `PixiJS EventSystem.prototype._addEvents`，在原方法执行后手动把 `this._onPointerUp` push 到 buckets.global.pointerup（弥补 vivo 锁死那一行）

---

## DOM

### ❌ document.createElement 拒绝非 canvas 类型

- **发现日期**：2026-05-13（Phase 0）
- **现象**：`document.createElement('div')` 等返回 `undefined`，并打 runtime warn `you create div type, but only canvas type can be created now!`。
- **影响**：PixiJS `DOMPipe` / `AccessibilitySystem` 构造时调 `document.createElement` 直接崩。
- **绕过方法**：`src/platform/vivo/dom-polyfill.ts` wrap `document.createElement`，非 canvas 类型返回一个完整的 stub element（含 appendChild / addEventListener / style 等 no-op 方法）。

### ❌ Intl 全局不存在

- **发现日期**：2026-05-13（Phase 0）
- **现象**：vivo runtime 没有 `Intl` 全局对象。PixiJS v8 `CanvasTextMetrics` 模块体执行 `typeof Intl?.Segmenter === 'function'` 判断 —— `Intl?.Segmenter` 是 optional chaining，**先取 Intl，没有 Intl 直接 ReferenceError**，整个 Pixi 加载链断。
- **绕过方法**：`dom-polyfill.ts` 注入 `globalThis.Intl = {}` 空对象。后续 `Intl?.Segmenter` 取到 undefined，落回 Pixi 自带 `(s) => [...s]` codepoint fallback，对中文棋盘 UI 足够。

---

## 资源加载

### ❌ Assets.load('/path') 前导斜杠在 vivo 上 404

- **发现日期**：2026-05-13
- **probe 证据**：真机 console 日志
  ```
  [pixi-renderer] atlas load failed, fallback to PixiJS Text:
  [Loader.load] Failed to load fonts/main.fnt. Error: ERROR
  ```
  改为不带前导斜杠的 `Assets.load('fonts/main.fnt')` 后加载成功（同一 rpk、同一文件，仅路径字符串变化）。
- **现象**：以 `/` 开头的资源路径（`/fonts/main.fnt` / `/audio/x.wav` / `/assets/foo.png`）传给 `Assets.load` 或 `new Audio(src)` 时，vivo 的 `qg.request` 把它解析成 `https://<current-domain>/path`，发起网络请求 → 404 → PixiJS Loader 报抽象错 `Error: ERROR`（底层 reject 被吞，无法直接看出根因）。
- **影响**：
  - 字体 atlas 加载失败 → fallback PixiJS Text → 撞回 Canvas2D fillText alpha bug → **全屏文字深色**（这次踩坑路径）。
  - 音频文件加载失败 → `new Audio(src).play()` reject → SoundEngine 静默 catch → 看似"音效正常"实际只有 Web Audio 合成的 sfx 在响（误判为"音频路径工作正常"）。
  - 任何 `Assets.load('/...')` / `Texture.from('/...')` / `new Audio('/...')` 都被影响。
- **绕过方法**：所有资源路径用相对路径（不带前导斜杠）。
  - ✅ `Assets.load('fonts/main.fnt')`
  - ✅ `new Audio('audio/button.wav')`
  - ❌ `Assets.load('/fonts/main.fnt')`
  - 浏览器对两种路径都能解析正确（相对路径基于 document baseURI），vivo 只接受相对路径。
- **不要尝试**：
  - 在 `pixi-adapter.ts` fetch 实现里 strip 前导 `/` ——会掩盖问题、破坏 grep 一致性，且只覆盖 PixiJS 路径不覆盖 `new Audio` 等其他加载链。
  - 设置 `<base href>` 或 vite `base` 选项绕过——dev 时改 vite，prod 时打包后行为又变，不可控。
  - 改 `qg.request` URL —— 平台 API 不能改。

### ❌ qg.request 读取 rpk 本地资源可能永久 pending

- **发现日期**：2026-05-13
- **现象**：`Assets.load('fonts/main.fnt')` 进入 vivo adapter 的 fetch 后，如果用 `qg.request` 读取 rpk 内本地资源，真机上可能既不 success 也不 fail，导致 `await Assets.load(...)` 永久挂起。
- **影响**：`markAtlasReady`、`registerScreens`、`showScreen` 都不执行，stage 为空，表现为真机黑屏但无异常。
- **绕过方法**：`src/platform/vivo/pixi-adapter.ts` 给 fetch 增加 8 秒 timeout。timeout 后 atlas 加载失败可降级到 PixiJS Text，至少不再永久黑屏。
- **后续真修**：用 vivo FileSystem API 读取 rpk 本地资源，远程 URL 才走 `qg.request`。该项待真机验证 API 签名后再做。
- **启动日志**：应看到 `[vivo-pixi-adapter] fetch:`，失败时应看到 `[vivo-pixi-adapter] fetch timeout (8s):`。

---

## 打包 / 签名

### ❌ mgs build 产物是 Debug 调试签名，不能提审

- **发现日期**：2026-05-13
- **现象**：vivo 开平拒绝上传，提示“签名不能为 Debug 调试签名”。
- **证据**：debug rpk 的 `META-INF/CERT` 字符串中出现 `RPKDebug`，manifest 被 CLI 写入 `buildType: "dev"`。
- **根因**：mini-pack 原先调用 `mgs build`，vivo CLI 默认使用内置 debug 签名。
- **绕过方法**：
  - mini-pack vivo 打包命令切到 `mgs release`。
  - 生成工程内放置 `sign/release/private.pem` 和 `sign/release/certificate.pem`。
  - 当前项目通过 `channels/vivo/materials.ts` 的 `releaseSignDir` 指向仓库根 `vivo-pem/`，构建时复制到生成工程。
- **验收**：
  - rpk 文件名应为 `*.signed.rpk`。
  - manifest 内 `buildType` 应为 `release`。
  - `strings META-INF/CERT | grep RPKDebug` 应为 0。
- **安全要求**：`vivo-pem/` 必须 git ignored，绝不能提交私钥。

---

## 跨平台兼容性说明

以上 quirks 当前**仅在 vivo runtime 验证过**。OPPO / 华为 / 小米 / 鸿蒙快游戏 runtime 真机未测，理论上 polyfill / patch 都是条件式安装（已有的不覆盖），不会破坏其他平台，但需要按 quirk 逐项验证。

每次 mini-pack 接入新平台前应该跑一遍诊断 probe（参考 `src/platform/vivo/canvas2d-text-probe.ts` 套路）+ 把结果追加到本文档。

---

## 检索索引

| 现象 | quirk 段落 |
|---|---|
| 文字白色变透明 / 看起来变深色 | Canvas2D - fillText alpha |
| Pixi Text 显示异常 | Canvas2D - fillText alpha |
| `drawElements failed` | WebGL - OES_element_index_uint |
| pointerup / tap 不触发 | Event Listener - globalThis.addEventListener |
| `can not rewrite the property` warn | Event Listener |
| `you create div type` warn | DOM - createElement |
| `Intl is not defined` 加载崩溃 | DOM - Intl |
| OffscreenCanvas 用不起来 | Canvas2D - OffscreenCanvas |
| Graphics 显示对 / 但 Text 错 | Canvas2D - fillText alpha（确认 quirk 范围） |
| `Loader.load Failed to load ... Error: ERROR` | 资源加载 - 前导斜杠 |
| 任意 `Assets.load('/...')` 路径不工作 | 资源加载 - 前导斜杠 |
| 字体 atlas 加载失败 fallback PixiJS Text | 资源加载 - 前导斜杠（最常见根因） |
| 真机黑屏但无 atlas loaded / failed 日志 | 资源加载 - qg.request 本地资源 pending |
| vivo 提审提示 debug 签名 | 打包 / 签名 - mgs build Debug 签名 |

---

*文档维护：发现新 vivo quirk 必须追加本文档，并把发现 probe 提交到 `src/platform/vivo/*-probe.ts`，证据留底。*
