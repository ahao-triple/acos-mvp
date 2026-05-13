# Phase 1: PixiJS 迁移 + vivo 真机上架

## 时间线

- Canvas2D 阶段：浏览器正常，但 vivo 真机出现文字/路径/事件兼容问题，Canvas2D `fillText` 存在 alpha 衰减，继续用原渲染栈风险不可控。
- PixiJS 迁移阶段：引入 PixiJS WebGL 渲染管线，拆分 `src/pixi/` 的 app / renderer / screens / ui / pieces，保留 `src/render/` 中可复用的纯模型和动画工具。
- vivo runtime 适配阶段：补 `dom-polyfill`、`listener-store`、`event-bridge`、`pixi-adapter`，绕过 `globalThis.addEventListener` accessor lockdown、`document.createElement` 限制、`Intl` 缺失和本地资源加载差异。
- 真机黑屏排查阶段：定位到 PixiJS WebGL index buffer 在 vivo WebGL 1 下不能使用 `Uint32Array`，扩展 PixiJS patch 到 FilterSystem，启动自检增加 `[pixi-patch-check]`。
- 字体阶段：为规避 vivo Canvas2D 文字 alpha bug，引入 SDF atlas + BitmapText；后续发现 vivo WebGL 1 上 MSDF 颜色异常，短期改为浅色主题并保留 fallback 路径。
- 资源加载阶段：发现 vivo `qg.request` 读取 rpk 内本地资源可能永久 pending，给 fetch 增加 timeout，保证 atlas 加载卡死时能降级而不是黑屏。
- 广告阶段：补 vivo `rewardedAdUnitId` 配置传递，展开 `[object Object]` 错误日志，后续需以 vivo 后台广告位状态继续验证。
- 上架阶段：vivo 拒绝 debug 签名后，切换 `mgs release`，复制 `vivo-pem` 到生成工程 `sign/release/`，补 `homePage`，输出正式签名 `.signed.rpk`。

## 技术决策

- Canvas2D -> PixiJS：原因是 vivo Canvas2D 文本和 path 行为不稳定，PixiJS 能把棋盘、UI、粒子和文字统一放入 WebGL 管线。代价是包体增加、WebGL 兼容面变大、需要维护 PixiJS 补丁。
- vivo platform adapter：用 `src/platform/vivo/` 单独承载 runtime polyfill 和 Pixi 适配，不把 vivo 逻辑散进业务层。核心模块是 `dom-polyfill.ts`、`listener-store.ts`、`event-bridge.ts`、`pixi-adapter.ts`。
- SDF 字体 + BitmapText：目标是避开 Canvas2D `fillText`；字符集由 `scripts/scan-charset.mjs` 生成，atlas 由 `scripts/build-font-atlas.sh` 生成。当前因 vivo WebGL MSDF 颜色问题，保留 timeout/fallback，视觉上采用浅色背景 + 深色字策略。
- PixiJS uint16 patch：vivo WebGL 1 不支持 `OES_element_index_uint`，必须强制 index buffer 使用 `Uint16Array`。已有 9 处基础 patch，后续补上 FilterSystem 形成 9+1 处强制 uint16 修复，并用启动日志自检。

## 已知遗留问题（明天 / 下周再修）

- MSDF shader 在 vivo WebGL 1 上颜色失效：当前用浅色主题和 fallback 保障可读性，后续应 probe `OES_standard_derivatives` 并评估 plain bitmap font 或 shader patch。
- vivo 广告 SDK 集成：`adUnitId` 已配置传递，仍需确认 vivo 后台广告位是否开通、是否白名单、dev/release 行为差异和真实 `errCode`。
- LoadingScreen 网络异常体验：远端 session 404 已有默认配置兜底，但极端网络场景下仍需更明确的 loading/error 反馈。
- audit 文档第 10 节的 P0/P1/P2 项尚未全部实施，上架前仍需按 `spec-compliance-audit.md` 复核。

## 关键交付资产

- `vivo-quirks.md`：记录 vivo runtime 坑位、症状、证据和当前 workaround。
- `patches/pixi.js+8.18.1.patch`：PixiJS uint16 index buffer patch，覆盖 10 个关键位置。
- `src/platform/vivo/`：vivo adapter 三件套和相关 probe，包括 listener-store / event-bridge / pixi-adapter。
- `check:full`：组合 typecheck、unit、build、e2e、browser verify。
- `verify:browser`：验证 atlas 加载、缺字 warning、Pixi 启动日志和截图。
- `jitter-loop`：30 秒随机消除压测，覆盖 fps 和 fatal error 基线。

## 团队约定

- 不动 `vivo-pem/` 内容；该目录必须保持 git ignored，密钥只在本机/安全渠道管理。
- 改任何可见中文文案后，必须执行 `node scripts/scan-charset.mjs`、`sh scripts/build-font-atlas.sh`、`pnpm verify:browser`。
- 新平台接入第一步是跑 probe，不直接移植 vivo workaround；发现的 quirks 写入对应平台文档段落。
- 任何 vivo 真机黑屏先看启动日志：`[pixi-patch-check]`、`[listener-store]`、`[vivo-event-bridge]`、`[pixi-renderer] BitmapFont atlas loaded`。
- 不在业务层散落平台判断；优先放入 `src/platform/<platform>/` 和 `mini-pack/src/platforms/<platform>/`。
