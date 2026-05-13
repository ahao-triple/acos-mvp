# gonglian-fangxian / game

共联防线小游戏（PixiJS v8 + TypeScript）。本目录是游戏运行时代码与本地自测体系。

## 浏览器开发模式

| 模式 | URL | 适用场景 |
|---|---|---|
| 纯净浏览器 | `http://localhost:5173/` | 日常表现力打磨、UI 调试、动画/特效迭代 |
| 模拟 vivo 严格 | `http://localhost:5173/?vivo-strict` | 复现真机问题、验证 vivo 兼容性补丁 |
| e2e 自动化 | `pnpm test:e2e` | 始终走 `?vivo-strict`，CI 回归 net |

**纯净模式下**：`dom-polyfill` 整个 IIFE 短路，`setupVivoPixiDOMAdapter` / `patchEventSystemPrototype` / `removePixiExtensionsByRef` 全部不跑。PixiJS 走原生 `BrowserAdapter` + `EventSystem`，HTMLText / DOMPipe / AccessibilitySystem 保留可用。控制台只看到 `[vivo-polyfill] skip` 与 `[pixi-app] skip vivo hooks` 两条短路日志，没有 listener-store 路由日志。

**`?vivo-strict` 模式下**：所有 vivo hook 全开，控制台能看到 `[vivo-polyfill] init complete` / `[listener-store] forceInstall ...` / `[vivo-pixi-adapter] DOMAdapter installed` / `[pixi-patch] EventSystem.prototype._addEvents / _removeEvents patched`，与 vivo 真机日志一致。

切换条件由 `src/platform/vivo/strict-mode.ts:isVivoStrictMode()` 在模块顶层 freeze：检测 `globalThis.qg / tt / ks`（mini-pack runtime 始终启用，维持原有行为）或 `location.search` 含 `vivo-strict`。

## 自测工作流

### 一条命令跑全套（推荐 commit 前）

```bash
pnpm check:full
```

依次跑：

| 阶段 | 命令 | 含义 |
|---|---|---|
| 1. typecheck | `tsc --noEmit` | TS 类型检查，不出产物 |
| 2. test | `vitest run` | 单元测试（jsdom），覆盖业务逻辑 / 纯函数 |
| 3. build | `tsc --noEmit && vite build` | 生产 bundle，验证 esbuild / rollup 链路 |
| 4. test:e2e | `playwright test` | chromium e2e，跑真渲染回归 |

首次冷启动需要 vite 预构建 PixiJS（720+ 模块）+ 装 chromium 缓存，约 50–80 秒；后续命中缓存约 15–20 秒。

### 分步跑（迭代开发时）

```bash
pnpm typecheck         # 只看类型，1–2 秒
pnpm test              # 只跑单测，2–3 秒
pnpm test:watch        # 单测 watch 模式
pnpm test:e2e          # 只跑 e2e，约 40 秒（含 vite 预热）
pnpm check             # typecheck + test + build，跳 e2e，约 10 秒
```

## e2e 能 catch 什么 / 不能 catch 什么

Playwright 跑 **chromium 真渲染** + 注入 vivo 严格性 hook，能在本地复现大部分跨平台渲染 bug：

**✓ 能 catch**
- WebGL 1 严格性问题（`OES_element_index_uint` 禁用，模拟 vivo 真驱动）
- `drawElements failed` / `glType not correct` / `INVALID_ENUM` 等 GL 报错
- PieceSprite 生命周期 bug（destroy 时机 / batcher 残引用）
- 控制台错误 / 运行时异常 / uncaught promise
- 连续动画下的 fps 退化（抖动用例断言平均 ≥ 50）

**✗ 不能 catch（必须真机回归）**
- vivo runtime 特有路径（`globalThis.addEventListener` 锁死 / qg.\* API / `quickgame` 包格式）
- 真机性能特性（chromium 跑 60 fps 不代表低端 vivo 也跑 60 fps）
- 完整通关到结算（需要构造特定关卡或暴露调试钩子，本期不做）

**原则**：e2e hook 只为已经踩过的真实 bug 加 reproducer，每个 hook 必须在 `tests/e2e/helpers/vivo-strict.ts` 注释里写明对应的真机事故。不预测、不模拟没踩过的 bug。

**例子**：`installVivoStrictHooks` 里 `OES_element_index_uint = null` 这条 hook，对应 2026-05-13 真机事故（PieceSprite refill 后 drawElements failed / glType not correct）。未来加新 hook 时遵循同样格式：**日期 + 真机症状 + 关联 issue/commit**。

## 新 bug 修复流程

每次真机或测试发现 bug：

1. **先写 reproducer**：在 `src/test/*.test.ts`（纯逻辑）或 `tests/e2e/*.spec.ts`（渲染相关）加一个红色测试
2. **跑 `pnpm check:full` 确认它红**
3. **修代码**
4. **再跑 `pnpm check:full` 全绿**
5. **commit**（测试与修复同一 commit，未来回归时这条 bug 自动被守住）

## 字体资源（手动下载）

游戏所有 UI 文字走 **BitmapText + SDF atlas**（绕开 vivo Canvas2D fillText alpha 衰减 bug，见 `docs/vivo-quirks.md`）。字体源 OTF 因体积大不进 git，工具链 + atlas 生成是离线步骤。

**首次开发或重新生成 atlas 之前必须做：**

1. **下载字体源** —— 按 `assets/fonts/source/LICENSE.md` 步骤，从 adobe-fonts/source-han-sans 官方 release 拉 `SourceHanSansCN-Bold.otf`（8.1 MB）到 `assets/fonts/source/`
2. **装 atlas 工具链** —— `npm i -g msdf-bmfont-xml`（首次跑 `scripts/build-font-atlas.sh` 会自检并提示）
3. **生成 atlas** —— `sh scripts/build-font-atlas.sh`，产物落 `public-pack/fonts/main.{png,xml}`（约 1.5 MB PNG）
4. **CI 暂不跑这一步**（避免远程下载依赖），开发者本地手动维护

字符集 source of truth 在 `docs/font-charset.txt`（由 `scripts/scan-charset.mjs` 从源码 + 强制叠加 + Q2/Q3 预扩字符自动生成）。字符变化时：

```bash
node scripts/scan-charset.mjs       # 重扫，更新 docs/font-charset.txt
sh scripts/build-font-atlas.sh      # 重打 atlas
git add docs/font-charset.txt public-pack/fonts/
```

**绝不从中文字体下载站拉字体**（商用授权红线），详见 `assets/fonts/source/LICENSE.md`。

## PixiJS uint16 index patch

vivo runtime 的 WebGL 1 严格驱动不支持 `OES_element_index_uint` 扩展（2026-05-13 真机事故），PixiJS v8 默认用 32 位 index 会触发 `drawElements failed / glType not correct`。我们在 `patches/pixi.js+8.18.1.patch` 里强制 9 处 index buffer 走 Uint16Array，并在接近上限时打 warn 兜底。

**`pnpm install` 之后必须看到这一行才算装对**：

```
[pixi-patch] successfully applied 1 patches (pixi.js+8.18.1)
```

如果改为 `[pixi-patch] already applied (skip)` 也正常（说明上一次 install 已 apply、本次幂等跳过）。

**没看到这两行任何一行 = patch 没生效**，跑 `pnpm test:e2e`（启用了禁用 `OES_element_index_uint` 的 vivo 严格 hook）会立刻红，这时手动：

```bash
sh scripts/apply-pixi-patch.sh
```

**注意**：patch-package 在 devDeps 里但**不使用**——它的 JS apply 实现对手工构造的 unified diff 太严格识别不了。我们用 `scripts/apply-pixi-patch.sh`（标准 `patch -p1` + marker 字符串做幂等检测），跨 pnpm/npm/yarn 行为一致。详情见脚本顶部注释。

**单 batch index 上限变成 65535**（uint16 硬上限）。脚本注入的 `console.warn` 在 size > 60000 时触发（留 8% 余量），未来高复杂度游戏接入时会立刻在 console 暴露。

## 目录

```
game/
├── src/
│   ├── app/                业务逻辑（controller / campaign）
│   ├── audio/              声音引擎
│   ├── core/               棋盘核心算法（与渲染无关）
│   ├── config/             关卡数据
│   ├── pixi/               PixiJS 渲染层（app / renderer / screens / pieces / ui）
│   ├── render/             跨渲染层共享代码（visualBoard / animation / theme）
│   ├── test/               vitest 单测
│   └── main.ts             入口
├── tests/e2e/              Playwright e2e
│   ├── helpers/            vivo-strict hook / clickLogical / boardCellCenter
│   ├── core-loop.spec.ts   核心循环（启动→消除→0 错误）
│   └── jitter-loop.spec.ts 30 秒抖动（5 次随机消除 + fps 监控）
├── public-pack/            mini-pack 打包用静态资源（注意不是 public/）
├── playwright.config.ts
├── vite.config.ts
└── tsconfig.json
```
