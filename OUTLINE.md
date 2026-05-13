# 项目大纲

## 1. 基本情况

| 项 | 现状 |
|---|---|
| 项目类型 | pnpm workspace；小游戏全栈式前端项目 + 本地打包 CLI。包含 `mini-pack` 打包工具、`gonglian-fangxian` 主游戏、`difference-hunt` 第二个游戏。 |
| 语言/运行时 | TypeScript / JavaScript ESM；Node `>=20`（`mini-pack` 声明）。 |
| 前端/构建 | Vite `7.2.x`、TypeScript `5.9.3`、Vitest `4.x`、Playwright `1.60.0`。 |
| 主要运行依赖 | `pixi.js ^8.18.1`（主游戏渲染）；`mini-pack` 用 `commander`、`esbuild`、`fast-glob`、`fs-extra`、`picocolors`、`zod`。 |
| 小游戏平台 | 抖音、快手、vivo 渠道配置和模板；vivo 还有 RPK 打包、polyfill、adapter、证书目录。 |
| 代码量 | 扫描到约 306 个文件、92709 行（含资源/生成物）；排除常见构建产物和二进制后，文本代码文档约 36407 行，其中 `pnpm-lock.yaml` 8805 行。 |
| 测试 | 42 个 `*.test.ts` / `*.spec.ts`；Vitest 单测/集成测试 + Playwright e2e/browser verify。未发现覆盖率配置或 coverage 产物，覆盖率水平不确定。 |
| 工作区状态 | 当前已有多处未提交改动和新增目录；本文件按当前工作区现状扫描。 |

## 2. 目录结构（最多 4 层）

```text
.
├── .github/workflows/ci.yml
├── assets/fonts/source/...
├── debug/...
├── docs/...
├── games/
│   ├── difference-hunt/
│   │   ├── channels/{douyin,kuaishou,vivo}/
│   │   ├── game/{src,public-pack,index.html,package.json,vite.config.ts}
│   │   └── game.config.ts
│   └── gonglian-fangxian/
│       ├── assets/{raw,processed,generated,manifest.json}
│       ├── channels/{douyin,kuaishou,vivo}/
│       ├── docs/
│       ├── game/{src,tests,docs,public-pack,levels,config,patches,scripts}
│       └── game.config.ts
├── mini-pack/
│   ├── src/{cli.ts,commands,core,platforms,shared}
│   ├── tests/{unit,integration,fixtures}
│   └── package.json
├── scripts/*.mjs / *.sh
├── vivo-pem/*.pem
├── package.json
├── pnpm-workspace.yaml
└── 小游戏页面规范.md / vivo-client-api.zh-CN.md
```

| 一级/重要目录 | 作用 |
|---|---|
| `mini-pack` | 本地打包 CLI；读取游戏配置、校验素材、bundle、生成平台模板和报告。 |
| `games/gonglian-fangxian` | 主游戏项目；包含源代码、渠道素材、原始/处理后资源、打包配置和文档。 |
| `games/difference-hunt` | 另一个小游戏项目；结构较轻，偏 Canvas/WebGL 渲染和关卡数据。 |
| `scripts` | 仓库级构建、预检、全量验证、字符集/字体工具脚本。 |
| `docs` | 仓库级审计、视觉升级、音频、字体字符集、vivo quirks 文档；部分内容与主游戏 `game/docs` 重复。 |
| `assets` | 字体源文件与许可。 |
| `vivo-pem` | vivo 打包证书/私钥，属于敏感构建材料。 |

## 3. 入口和主要流程

| 入口/流程 | 经过的主要文件 |
|---|---|
| 根构建/验证 | `package.json` scripts -> `scripts/build-game.mjs` / `scripts/preflight.mjs` / `scripts/verify-full.mjs` -> `mini-pack` 或具体游戏脚本。 |
| `mini-pack` CLI | `mini-pack/src/cli.ts` -> `commands/{build,pack,preflight}.ts` -> `core/{config,schema,assets,bundle,report,paths}.ts` -> `platforms/{douyin,kuaishou,vivo}`。 |
| 主游戏启动 | `games/gonglian-fangxian/game/index.html` -> `src/main.ts` -> `platform/{web,minipack,douyin,vivo/*}` -> `pixi/app.ts` / `app/controller.ts`。 |
| 主游戏核心循环 | `app/controller.ts` -> `core/{board,session,types}.ts` -> `config/levels.ts` -> `pixi/screens/playing.ts` / `pixi/playing/presentation.ts` -> `audio` / `feedback` / `render`。 |
| 主游戏平台适配 | `platform/douyin.ts`、`platform/minipack.ts`、`platform/vivo/{dom-polyfill,event-bridge,pixi-adapter,strict-mode}` -> `mini-pack/src/platforms/*/template.ts`。 |
| `difference-hunt` 启动 | `games/difference-hunt/game/index.html` -> `src/main.ts` -> `app/controller.ts` -> `render/{canvasRenderer,webglRenderer}` -> `assets/levels.ts`。 |

## 4. 体检数据

### 最大的 10 个文件（排除常见构建产物和二进制）

| 行数 | 路径 |
|---:|---|
| 8805 | `pnpm-lock.yaml` |
| 1952 | `games/gonglian-fangxian/game/public-pack/fonts/main.fnt` |
| 949 | `games/difference-hunt/game/src/assets/levels.ts` |
| 853 | `mini-pack/src/platforms/vivo/template.ts` |
| 697 | `mini-pack/src/platforms/douyin/template.ts` |
| 679 | `games/difference-hunt/game/src/render/webglRenderer.ts` |
| 668 | `mini-pack/src/platforms/kuaishou/template.ts` |
| 620 | `games/difference-hunt/game/src/render/canvasRenderer.ts` |
| 565 | `games/gonglian-fangxian/game/src/app/controller.ts` |
| 507 | `games/gonglian-fangxian/game/src/platform/vivo/dom-polyfill.ts` |

### 最长的 10 个函数/方法（静态粗略扫描，排除构建产物）

| 行数 | 位置 | 名称 |
|---:|---|---|
| 134 | `games/gonglian-fangxian/game/src/pixi/screens/loading.ts:41` | `constructor` |
| 103 | `games/gonglian-fangxian/game/src/pixi/screens/menu.ts:22` | `constructor` |
| 71 | `mini-pack/src/platforms/douyin/template.ts:144` | `installTouchEventShim` |
| 71 | `mini-pack/src/platforms/kuaishou/template.ts:84` | `installTouchEventShim` |
| 64 | `games/gonglian-fangxian/game/src/pixi/screens/settings.ts:21` | `constructor` |
| 63 | `games/gonglian-fangxian/game/src/pixi/screens/playing.ts:107` | `constructor` |
| 60 | `mini-pack/src/platforms/douyin/template.ts:375` | `showRewardedVideoAd` |
| 52 | `mini-pack/src/platforms/vivo/template.ts:464` | `attachCanvasToDocument` |
| 49 | `games/gonglian-fangxian/game/src/pixi/screens/levels.ts:19` | `constructor` |
| 49 | `mini-pack/src/platforms/vivo/template.ts:379` | `createCanvas` |

### 依赖使用概况

| 依赖 | 使用情况 |
|---|---|
| `vitest` | 约 39 处导入，测试主体。 |
| `pixi.js` | 约 19 处导入，主游戏渲染核心。 |
| `@playwright/test` | 约 6 处导入，e2e/browser verify。 |
| `fs-extra` | 约 5 处导入，`mini-pack` 文件操作。 |
| `esbuild`、`zod` | 各约 2 处导入，bundle/schema。 |
| `commander`、`fast-glob`、`picocolors` | 各约 1 处导入，CLI/文件扫描/日志输出。 |
| `vite`、`typescript`、`jsdom`、`patch-package`、`tsx` | 主要作为脚本/构建/测试工具使用，源码导入少或没有。 |
| `@vivo-minigame/cli` | package/override 中存在，源码未直接导入；可能由打包脚本或 CLI 运行期调用，是否闲置不确定。 |

### 重复或可疑命名

| 类型 | 现状 |
|---|---|
| `template.ts` | `mini-pack/src/platforms/{douyin,kuaishou,vivo}/template.ts` 三个大文件，职责相近但平台分叉明显。 |
| `types.ts` | 多处存在：游戏 core/platform、`mini-pack/shared`、`difference-hunt/assets/platform`；命名通用，需结合目录判断职责。 |
| `config.ts` / `game.config.ts` | 仓库、游戏、fixture、Vite/Playwright 多种 config 并存，正常但认知负担偏高。 |
| 文档重复 | 根 `docs/*` 与 `games/gonglian-fangxian/game/docs/*` 有同名审计/升级/quirks 文档，来源和权威版本不确定。 |
| `.DS_Store` / 构建产物 | 多处存在 `.DS_Store`、`dist`、`.mini-pack`、`test-results` 等，部分被扫描到但不应算业务代码。 |

## 5. 直觉（只描述现状）

- 项目不是单一应用，而是“打包工具 + 多个小游戏 + 多平台适配”的组合，边界比普通 Vite 项目复杂。
- 主游戏 `gonglian-fangxian` 模块分层较清楚：`app/core/platform/pixi/render/audio/feedback` 都有独立目录；但 UI screen 构造函数偏长，`app/controller.ts` 也是明显中心文件。
- `mini-pack` 的平台模板文件体积大，尤其 vivo/douyin/kuaishou 三个平台有相似 shim/adapter 逻辑，看起来有重复风险，但是否能合并取决于平台差异，不确定。
- `difference-hunt` 的 `levels.ts`、`canvasRenderer.ts`、`webglRenderer.ts` 较大，像是数据和渲染细节集中在少数文件里。
- 文档和产物混在仓库中较多：根 docs 与 game docs 重复、`.mini-pack`/`dist`/`test-results`/`.DS_Store` 可见，现状上会干扰扫描和新人理解。
- 测试数量不少，覆盖 CLI、核心逻辑、平台、e2e；但没有覆盖率报告，不能判断实际覆盖率高低。
- 我拿不准的点：`difference-hunt` 是否仍是活跃产品、根 `docs` 与游戏内 `docs` 哪个是权威、`@vivo-minigame/cli` 是运行期必需还是遗留依赖、当前未提交改动是否代表最新设计方向。
