# 项目大纲

> 本文按当前 `games/`、`mini-pack/`、`assets/` 和根脚本的实际状态整理；不沿用旧 phase 文档结论。

## 项目目标

| 项 | 当前状态 |
|---|---|
| 项目类型 | pnpm workspace，包含一个小游戏项目和一个内部打包 CLI。 |
| 游戏 | `gonglian-fangxian`，展示标题为 `全民爆梗游戏软件`，竖屏画布 `750x1334`。 |
| 打包工具 | `mini-pack`，从 `game.config.ts`、`build.<platform>.json` 和渠道物料生成小游戏工程，并可进一步打 `.rpk`。 |
| 发布目标 | vivo 小游戏为现有真实打包链路；OPPO 小游戏骨架已接入，可生成工程和 fake `.rpk`；浏览器/Vite 仅用于本地开发和自动化验证。 |
| 主要技术 | TypeScript ESM、PixiJS 8、Vite、Vitest、Playwright、esbuild、Zod、@vivo-minigame/cli；OPPO CLI 预留为 `@oppo-minigame/cli` / `quickgame`，当前未安装。 |
| 依赖管理 | 所有依赖和用户命令都集中在根 `package.json`。 |

## 目录布局

```text
.
├── package.json                    # 根依赖、根命令、postinstall Pixi patch
├── pnpm-workspace.yaml             # workspace: mini-pack + gonglian-fangxian/game
├── tsconfig.base.json              # 共享 TypeScript 基础配置
├── vitest.config.base.ts           # 共享 Vitest 基础配置
├── vitest.config.ts                # 根测试入口，覆盖 game + mini-pack
├── scripts/                        # 根命令封装和字体/字符集工具
├── assets/fonts/source/            # 字体源文件授权说明和本地字体源
├── mini-pack/                      # 内部 CLI 工具
│   ├── src/cli.ts                  # CLI 入口: preflight / build / pack
│   ├── src/commands/               # 命令实现
│   ├── src/core/                   # 配置加载、schema、bundle、assets、report
│   ├── src/platforms/vivo/         # vivo 工程模板、runtime adapter、RPK 调用
│   ├── src/platforms/oppo/         # OPPO 工程模板、runtime adapter、fake/真实 RPK 调用入口
│   ├── tests/                      # CLI 单测、集成测试、fixture
│   └── stubs/puppeteer/            # 让 vivo CLI 依赖可安装的本地 stub
└── games/gonglian-fangxian/
    ├── game.config.ts              # mini-pack 读取的游戏声明
    ├── build.vivo.json             # vivo 打包配置
    ├── build.oppo.json             # OPPO 打包配置
    ├── channels/vivo/              # vivo 图标和 materials.ts
    ├── channels/oppo/              # OPPO 图标和 materials.ts
    ├── assets/                     # 原始/处理后/生成素材目录和 manifest
    └── game/                       # PixiJS 游戏本体
        ├── src/main.ts             # 游戏入口，安装 vivo hooks 并启动 Pixi renderer
        ├── src/app/                # controller、campaign、save、rewards
        ├── src/core/               # 棋盘和 session 纯逻辑
        ├── src/pixi/               # Pixi app、stage、screens、pieces、ui、effects
        ├── src/platform/           # web dev adapter + vivo/minipack adapter
        ├── src/audio/              # SFX / sound engine
        ├── src/render/             # 渲染无关的动画、主题、visual board 工具
        ├── src/test/               # Vitest 游戏测试
        ├── tests/e2e/              # Playwright e2e
        ├── tests/browser-verify/   # 浏览器验证用例
        ├── public-pack/            # 打包进 vivo 工程的运行时静态资源
        ├── patches/                # PixiJS vivo 兼容 patch
        └── docs/                   # 游戏侧当前文档索引和专题文档
```

## 当前支持的平台

| 平台 | 用途 | 入口/配置 | 产物 |
|---|---|---|---|
| vivo | 现有真实发布平台 | `channels/vivo/materials.ts`、`build.vivo.json`、`mini-pack/src/platforms/vivo/` | `channels/vivo/build/` 工程、`dist/com.jnsy.qmbg.vivominigame.rpk` |
| oppo | 新增骨架平台，当前用于工程生成和 fake RPK 验证；真实 CLI 待 Phase 4 | `channels/oppo/materials.ts`、`build.oppo.json`、`mini-pack/src/platforms/oppo/` | `channels/oppo/build/` 工程、fake `dist/com.jnsy.qmbg.oppominigame.rpk` |
| web | 本地开发/测试 | `games/gonglian-fangxian/game/src/platform/web.ts`、Vite dev server | 不作为发布产物 |

当前代码中没有抖音、快手、微信等平台实现；`mini-pack` 的 platform builder 当前注册 vivo 和 oppo。

## 构建与运行命令

所有命令从仓库根目录执行。

| 命令 | 作用 |
|---|---|
| `pnpm install` | 安装依赖，并通过 postinstall 应用 PixiJS vivo 兼容 patch。 |
| `pnpm dev` | 启动 `gonglian-fangxian/game` 的 Vite dev server。 |
| `pnpm build` | 默认生成 vivo 工程；可用 `pnpm build --platform oppo` 生成 OPPO 工程。 |
| `pnpm pack` | 默认走 vivo 打包；保留但会和 pnpm 内置 pack 语义混淆，建议用显式平台命令。 |
| `pnpm pack:vivo` | 按 `build.vivo.json` 打真实 vivo `.rpk`。 |
| `MINI_PACK_OPPO_FAKE_RPK=1 pnpm pack:oppo` | 按 `build.oppo.json` 打 OPPO fake `.rpk`；未安装 OPPO CLI 时真实打包会清晰报错。 |
| `pnpm preflight` | 校验默认游戏的渠道配置和物料；可用 `--platform vivo|oppo` 指定平台。 |
| `pnpm test` | 跑全部 Vitest 测试。 |
| `pnpm test:game` | 只跑游戏侧测试。 |
| `pnpm test:cli` | 只跑 `mini-pack` 测试。 |
| `pnpm typecheck` | 对 `mini-pack` 和游戏执行 TypeScript 类型检查。 |
| `pnpm verify` | 顺序执行 install、build、test、pack。 |
| `pnpm clean` | 清理构建、测试和打包产物。 |

## 主要流程

| 流程 | 经过的关键文件 |
|---|---|
| 本地开发 | `scripts/dev-game.mjs` → `games/gonglian-fangxian/game/vite.config.ts` → `src/main.ts` |
| vivo 工程构建 | `scripts/build-game.mjs --platform vivo` → `mini-pack/dist/cli.js build` → `mini-pack/src/commands/build.ts` → `mini-pack/src/platforms/vivo/index.ts` |
| OPPO 工程构建 | `scripts/build-game.mjs --platform oppo` → `mini-pack/dist/cli.js build` → `mini-pack/src/commands/build.ts` → `mini-pack/src/platforms/oppo/index.ts` |
| vivo RPK 打包 | `scripts/pack-game.mjs --platform vivo` → `mini-pack/dist/cli.js pack` → `mini-pack/src/commands/pack.ts` → `mini-pack/src/platforms/vivo/rpk.ts` |
| OPPO RPK 打包 | `scripts/pack-game.mjs --platform oppo` → `mini-pack/dist/cli.js pack` → `mini-pack/src/commands/pack.ts` → `mini-pack/src/platforms/oppo/rpk.ts` |
| 游戏启动 | `src/main.ts` → `src/platform/vivo/*` hooks → `src/pixi/app.ts` / `src/pixi/renderer.ts` → `src/app/controller.ts` |
| 测试 | 根 `vitest.config.ts` → `game/src/test/*.test.ts` + `mini-pack/tests/**/*.test.ts`；Playwright 用 `game/tests/` 下配置。 |
| 字体维护 | `scripts/scan-charset.mjs`、`scripts/build-font-atlas.sh`、`game/docs/font-charset.txt`、`game/public-pack/fonts/` |

## 还在 WIP 的部分

| 区域 | 现状 |
|---|---|
| BGM | `soundEngine.ts` 明确把 BGM 保持 no-op；音频文件存在，但真音乐启用等待版权/素材决策。 |
| 法务/上架文案 | `loading.ts` 里仍有著作权人和软著号 placeholder，上线前需要替换并重打字体 atlas。 |
| 部分屏幕 | `src/pixi/screens/stub.ts` 仍是占位屏实现，界面完整度需要按实际产品范围继续补。 |
| 视觉素材 | `pieceSprite.ts` 注释显示棋子详细 icon 仍是后续阶段；当前更偏几何/文字化表达。 |
| 平台能力奖励 | `rewards.ts` / `platform/minipack.ts` 对添加桌面、常用、侧边栏等能力有失败/未完成反馈，依赖 vivo 能力和真机验证。 |
| vivo 字体/渲染兼容 | `src/platform/vivo/` 保留大量 runtime workaround；OPPO 运行时 game adapter 尚未进入游戏代码。 |
| OPPO 真机接入 | `mini-pack/src/platforms/oppo/` 已能生成工程和 fake RPK；尚未安装/验证 `@oppo-minigame/cli`，也未新增 `game/src/platform/oppo/`。 |
| 测试打包 | `mini-pack` 中保留 `MINI_PACK_VIVO_FAKE_RPK=1` 和 `MINI_PACK_OPPO_FAKE_RPK=1` 的 fake RPK 路径，只用于测试，不代表真实打包。 |
| 文档 | 游戏侧 docs 仍包含历史总结/方案类材料，是否继续保留需要按当前维护价值再筛。 |
