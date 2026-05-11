# ACOS MVP Project Conventions

本仓库是一个移动端小游戏生产和打包 MVP。目标不是维护单个小游戏，而是沉淀一套可复用的项目结构、运行时适配、资源约定和平台打包流程，让多个轻量小游戏可以用同一套 `mini-pack` 工具输出到不同小游戏平台。

## Project Shape

仓库分为两类代码：

- `mini-pack/`：共享打包器和平台运行时桥接层。
- `games/<game-project>/`：独立小游戏项目。

游戏项目：

- `games/gonglian-fangxian`：三消闯关小游戏，主要用于验证抖音、快手和 vivo 打包链路。
- `games/difference-hunt`：竖屏找不同小游戏，产品名为“就你眼神好”。

新游戏应参考已有项目的结构和规范。

## Game Project Layout

每个游戏项目应保持以下结构：

```text
games/<game-project>/
  AGENT.md
  AGENT_CN.md
  game.config.ts
  assets/
  docs/
  game/
    index.html
    package.json
    vite.config.ts
    public-pack/
    src/
      app/
      assets/
      core/
      platform/
      render/
      test/
  channels/
    douyin/
      materials.ts
      icon.png
      build/        # .gitignore
    kuaishou/
      materials.ts
      icon.png
      build/        # .gitignore
    vivo/
      materials.ts
      icon.png
      build/        # .gitignore
```

约定：

- `game.config.ts` 是游戏共性配置（`title` / `entry` / `publicDir` / `orientation` / `canvas`）；不再承载 `platform` / `outDir` / 渠道字段。
- `channels/<platform>/materials.ts` 是渠道字段（抖音/快手 `appid`、`projectName`、`rewardedAdUnitId`、`iconPath`；vivo `packageName`、`iconPath`、`versionName`、`versionCode`）。
- `channels/<platform>/icon.png` 是渠道图标（必填；抖音/快手用于后台提交，vivo 写入构建产物）。
- `channels/<platform>/build/` 是打包产物目录，已 `.gitignore`。
- `game/public-pack/` 是运行时静态资源目录，打包器会复制这里的内容。
- `game/src/main.ts` 暴露浏览器预览入口和 mini-pack 运行时入口。
- `game/src/platform/*` 隔离浏览器、抖音、快手、vivo 等平台能力。
- `game/src/app/*` 负责流程、存档、奖励、关卡状态等产品逻辑。
- `game/src/render/*` 负责 Canvas 绘制和交互命中。
- `AGENT.md` 是给 AI 使用的英文规则，`AGENT_CN.md` 是给用户查看的中文镜像。
- 开发时先读根目录 `AGENT.md`，再读当前游戏项目的 `AGENT.md`。
- 子游戏 `AGENT.md` 是该游戏内开发的局部规则，优先级高于本文件中的通用描述。
- 修改任意 `AGENT.md` 或 `AGENT_CN.md` 时，必须同步修改同目录另一份，保证两份语义一致。

不要让游戏逻辑依赖仓库外路径。跨游戏复用应通过明确复制、抽象或 `mini-pack` 能力完成。

## Game Product Rules

所有游戏默认按移动端竖屏小游戏设计，基础设计尺寸为 `750 x 1334`。

产品实现应优先满足：

- 短局、轻量、易理解、快速进入核心玩法。
- 界面文案使用规范简体中文。
- 首页、游戏页、结算页、关卡页、设置页等主要页面边界清晰。
- 广告入口必须由玩家主动触发，且明确展示激励视频标识和奖励结果。
- 存档需要兼容旧版本和异常数据，不能因坏存档导致游戏无法启动。
- 平台能力失败时应降级处理，不能阻塞核心玩法。
- 音效和音乐必须支持开关，音频失败不能阻断流程。

不要把关键 UI 文案、按钮文字、数值或可变信息画死在图片里，除非需求明确要求。

## Platform Support

`mini-pack` 支持的平台：

- `douyin`
- `kuaishou`
- `vivo`

根目录命令：

```bash
pnpm preflight games/<game-project> --platform douyin
pnpm preflight games/<game-project> --platform kuaishou
pnpm preflight games/<game-project> --platform vivo
pnpm build games/<game-project>
pnpm build games/<game-project> --platform douyin
pnpm build games/<game-project> --platform kuaishou
pnpm build games/<game-project> --platform vivo
```

不传 `--platform` 时默认使用 `douyin`。

`build` 命令会先跑 preflight，缺渠道物料时一次性中文报告并退出。打包产物输出到 `games/<game-project>/channels/<platform>/build/`（已 `.gitignore`）。

抖音构建会在构建后运行 smoke 检查。快手构建会生成可导入快手小游戏开发者工具的 `game.js` / `game.json` / `project.config.json` 工程。vivo 构建会生成 vivo/Quick Game 项目，并在环境可用时尝试生成 debug `.rpk`。

快手渠道配置位于 `games/<game-project>/channels/kuaishou/materials.ts`：

- `KUAISHOU_APPID`：正式快手小游戏 appid；不设置时默认使用开发测试 appid `kwai_game_test_appid`。
- `KUAISHOU_REWARDED_AD_UNIT_ID`：快手激励视频广告位 id；不设置时广告能力降级。
- 快手运行时桥接已接入 `ks.createCanvas`、触摸、存储、音频、激励视频、震动、添加桌面（`ks.checkShortcut` / `ks.addShortcut`）和设为常用（`ks.checkCommonUse` / `ks.addCommonUse`）。

不在本 MVP 范围内的平台：

- 微信小游戏
- 其它快应用联盟渠道

新增平台时应在 `mini-pack/src/platforms/<platform>/` 中实现 builder 和运行时模板，并补充 schema、CLI、测试和根构建脚本支持。不要把平台专用打包逻辑散落到单个游戏项目里。

## Development Commands

安装依赖：

```bash
pnpm --dir mini-pack install
pnpm --dir games/<game-project>/game install
```

浏览器预览：

```bash
pnpm --dir games/<game-project>/game dev
```

单个游戏测试和构建：

```bash
pnpm --dir games/<game-project>/game test
pnpm --dir games/<game-project>/game build
```

共享打包器测试：

```bash
pnpm --dir mini-pack test
```

完整验证矩阵：

```bash
pnpm --dir mini-pack test
pnpm --dir games/gonglian-fangxian/game test
pnpm --dir games/difference-hunt/game test
pnpm --dir games/gonglian-fangxian/game build
pnpm --dir games/difference-hunt/game build
DOUYIN_APPID=tt-test DOUYIN_REWARDED_AD_UNIT_ID=tt-rwd \
  pnpm preflight games/gonglian-fangxian --platform douyin
DOUYIN_APPID=tt-test DOUYIN_REWARDED_AD_UNIT_ID=tt-rwd \
  pnpm build games/gonglian-fangxian
DOUYIN_APPID=tt-test DOUYIN_REWARDED_AD_UNIT_ID=tt-rwd \
  pnpm build games/difference-hunt --platform douyin
KUAISHOU_APPID=kwai_game_test_appid \
  pnpm build games/gonglian-fangxian --platform kuaishou
KUAISHOU_APPID=kwai_game_test_appid \
  pnpm build games/difference-hunt --platform kuaishou
MINI_PACK_VIVO_FAKE_RPK=1 pnpm build games/difference-hunt --platform vivo
```

根目录 `pnpm verify` 只覆盖一部分流程，不替代完整矩阵。

## Resource Rules

运行时资源放在 `game/public-pack/`。

资源引用建议：

- 浏览器预览使用 `/audio/...`、`/assets/...` 这类 public 根路径。
- mini-pack 平台包内由运行时桥接层映射到生成包的 `assets/` 目录。
- 资源清单、配置和文档中的运行时目录应统一写 `game/public-pack`。

资源生成或替换时必须服务当前游戏风格。不要引入明显无关素材，不要把临时预览和工具缓存提交到仓库。

## Testing Expectations

改动验证按风险决定范围：

- 修改游戏玩法或存档：跑对应游戏测试。
- 修改渲染和交互：跑对应游戏测试和浏览器预览。
- 修改资源目录或 Vite 配置：跑对应游戏构建和平台打包。
- 修改 `mini-pack`：跑 `pnpm --dir mini-pack test`，并至少验证一个真实游戏平台包。
- 修改根构建脚本：跑根目录 `pnpm build games/<game-project>`。

Windows 是受支持开发环境。测试中处理本地路径时应使用 `fileURLToPath()`，不要直接使用 `URL.pathname` 拼 Windows 路径。

## Git Hygiene

仓库可能处在脏工作区。修改前先看 `git status --short`。

约定：

- 不回退别人已有改动。
- 不把 `node_modules/`、`dist/`、`build/`、`builds/`、本地工具配置和临时目录提交。
- 大规模删除旧项目之前必须确认没有活动引用。
- 一次提交应表达一个清晰意图，例如“新增平台支持”“清理旧实验项目”“统一资源目录”。

## New Game Checklist

新增游戏时至少完成：

- 创建 `games/<game-project>/game.config.ts`（仅游戏共性字段）。
- 创建 `games/<game-project>/AGENT.md` 和 `games/<game-project>/AGENT_CN.md`，并保持两份语义一致。
- 创建 `game/public-pack/` 并放入运行时资源。
- 创建 `game/src/main.ts`，支持浏览器预览和 mini-pack runtime。
- 提供 `platform/web.ts` 和 `platform/minipack.ts`。
- 为每个支持的渠道创建 `channels/<platform>/materials.ts` 与 `channels/<platform>/icon.png`。
- 提供核心玩法测试、存档测试和资源数据测试。
- 跑通浏览器预览、`pnpm preflight games/<game> --platform <p>` 与至少一个平台打包。

新游戏不应依赖仓库外路径或未纳入仓库规范的目录。
