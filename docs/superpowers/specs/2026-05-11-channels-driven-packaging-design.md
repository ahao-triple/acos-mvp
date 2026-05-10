# Channels-Driven 打包链路 设计文档

- 日期：2026-05-11
- 主题：把每个游戏的渠道（douyin / vivo / 未来其它）相关物料、配置和打包产物全部下沉到 `games/<game>/channels/<platform>/`；引入 preflight 校验；修当前 vivo 打包失败的根因。
- 所属范围：跨游戏 + `mini-pack` + 平台接入 → spec 落根 `docs/superpowers/specs/`。
- 状态：已与用户对齐 §1–§4，等待用户审本文件后走 writing-plans。

## 背景

### 当前痛点

1. `mini-pack/src/core/schema.ts` 用 `.strict()` 模式只允许 8 个字段，没声明 `vivo`。`difference-hunt/game.config.ts` 写了 `vivo: { packageName, iconPath }` 触发 `Unrecognized key: "vivo"`，vivo 构建无法跑通。
2. mini-pack vivo 实现并未真正使用渠道字段：`createVivoManifest` 用 `config.douyin.projectName` 派生包名，绕过用户期望的 `vivo.packageName`；图标用硬编码 `VIVO_ICON_BASE64`，忽略 `vivo.iconPath`。换言之"渠道差异"在 mini-pack 里没有真实的承载位置。
3. 渠道相关的物料（appid、激励视频 id、品牌图标、提审材料）目前散落：部分在 `game.config.ts`（依赖环境变量），部分在 `games/<game>/platform/<platform>/materials/.gitkeep`（仅占位），打包产物在仓库根 `build/`。同一游戏的"渠道知识"没有集中。
4. 打包前没有"物料是否齐全"的校验。环境变量缺失会以 schema 默认值 `""` 通过，运行到 builder 中段才暴露问题。

### 目标

- 让每个渠道的"配置 + 资产 + 产物"集中到 `games/<game>/channels/<platform>/`，可审计、可隔离。
- 打包必须先通过 preflight 校验，缺什么用中文一次性告诉用户。
- 同时修复 vivo 构建失败：把 `vivo.packageName` 与 `iconPath` 在 mini-pack 里真正接通。

## 设计原则

- 单一权威源：每个渠道的可变字段集中在 `channels/<platform>/materials.ts`；游戏共性集中在 `game.config.ts`；不写两份。
- 与现有结构延续：保留 `games/<game>/game/`、`mini-pack/`、AGENT 镜像系列的既有规范，仅新增 `channels/` 一层；不重写运行时桥接代码。
- YAGNI：不引入 yaml/json5 依赖；不做 `materials.local.ts` 覆写机制；不做交互式 wizard；不开新平台。
- 失败明确：preflight 中文报错，路径 + 缺少什么 + 怎么补，**一次性**列出全部问题。
- AGENT 中英镜像与"AI 工作约定"已立的规则不动（路径表述跟随更新）。

## 目标目录结构

```
games/<game>/
  AGENT.md / AGENT_CN.md
  game.config.ts                    # 仅游戏共性
  game/                             # 玩法代码（不变）
    index.html
    src/
    public-pack/
    package.json
    vite.config.ts
    tsconfig.json
  channels/
    douyin/
      materials.ts                  # 抖音渠道字段
      icon.png                      # 抖音渠道图标
      build/                        # 打包产物（.gitignore）
    vivo/
      materials.ts
      icon.png
      build/                        # 含 src/、build-report.json、生成的 .rpk 等
  docs/superpowers/{specs,plans}/   # 已存在
```

**对应处置：**
- 删除 `games/<game>/platform/<platform>/materials/.gitkeep` 与父空目录（旧占位结构）。
- 仓库根 `build/` 与 `builds/` 不再使用；如有则移除。
- 根 `.gitignore` 增加 `games/*/channels/*/build/`。

## 配置职责拆分

### `game.config.ts`（游戏共性）

```ts
import { defineGameConfig } from "../../mini-pack/src/index";

export default defineGameConfig({
  title: "就你眼神好",
  entry: "game/src/main.ts",
  publicDir: "game/public-pack",
  orientation: "portrait",
  canvas: { width: 750, height: 1334 },
});
```

去除字段：
- `platform`：由命令行 `--platform` 决定，每个游戏可同时支持多渠道。
- `outDir`：约定为 `channels/<platform>/build/`，不可配置。
- `douyin`、`vivo`：迁到 `channels/<platform>/materials.ts`。

### `channels/douyin/materials.ts`

```ts
import { defineDouyinMaterials } from "../../../../mini-pack/src/index";

export default defineDouyinMaterials({
  appid: process.env.DOUYIN_APPID ?? "",
  projectName: "difference-hunt",
  rewardedAdUnitId: process.env.DOUYIN_REWARDED_AD_UNIT_ID ?? "",
  iconPath: "icon.png",
});
```

### `channels/vivo/materials.ts`

```ts
import { defineVivoMaterials } from "../../../../mini-pack/src/index";

export default defineVivoMaterials({
  packageName: "com.jnsy.jnysh.vivominigame",
  iconPath: "icon.png",
  versionName: "1.0.0",
  versionCode: 1,
});
```

### 敏感字段策略

- `materials.ts` 入仓，可写常量，可写 `process.env.X`。
- 不引入 `.local.ts` 或 `.env.local` 机制。
- preflight 校验"加载后值非空"，env 缺失即等同物料未准备。

## mini-pack 改造

### schema（`mini-pack/src/core/schema.ts`）

```ts
gameConfigSchema = strict({
  title: z.string().trim().min(1),
  entry: z.string().trim().min(1),
  publicDir: z.string().trim().min(1),
  orientation: z.enum(["portrait", "landscape"]),
  canvas: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
});
```

新增：

```ts
douyinMaterialsSchema = strict({
  appid: z.string(),
  projectName: z.string().trim().min(1),
  rewardedAdUnitId: z.string().optional(),
  iconPath: z.string().trim().min(1).default("icon.png"),
});

vivoMaterialsSchema = strict({
  packageName: z.string().trim().regex(
    /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/,
    "packageName 必须是合法的反向域名（如 com.example.app）"
  ),
  iconPath: z.string().trim().min(1).default("icon.png"),
  versionName: z.string().trim().min(1).default("1.0.0"),
  versionCode: z.number().int().positive().default(1),
});
```

新导出：`defineDouyinMaterials`、`defineVivoMaterials`、对应类型。

> 注：`appid`、`rewardedAdUnitId` 在 schema 层允许空字符串通过，"必须非空"由 preflight 强制——这样保留 `process.env.X ?? ""` 的语法可用，但实际打包前会被拒。

### 配置加载（`mini-pack/src/core/config.ts`）

`loadGameConfig` 改造为加载并合并：

```ts
{
  game: GameConfig,                              // games/<game>/game.config.ts
  platform: "douyin" | "vivo",
  materials: DouyinMaterials | VivoMaterials,    // channels/<platform>/materials.ts
  paths: {
    projectRoot,                                 // 仓库根
    gameRoot,                                    // games/<game>/
    channelRoot,                                 // games/<game>/channels/<platform>/
    entryAbs,                                    // gameRoot/<game.entry>
    publicDirAbs,                                // gameRoot/<game.publicDir>
    materialsAbs,                                // channelRoot/materials.ts
    iconAbs,                                     // channelRoot/<materials.iconPath>
    outDirAbs,                                   // channelRoot/build/
  }
}
```

变化：
- `outDirAbs` 由约定派生，**不再支持 `--out-dir`**（CLI 移除）。
- `materials.ts` 不存在 → 抛 `UserError`，由 preflight 收集器吞下并加进总报告。

### Platform builder 接通物料

**`mini-pack/src/platforms/vivo/index.ts` + `template.ts`**
- `createVivoManifest(config)` 改签名 `createVivoManifest(loaded)`，从 `loaded.materials.packageName / versionName / versionCode` 与 `loaded.game.title / orientation` 读取。
- `vivoPlatformBuilder.build`：`fs.writeFile(path.join(srcDir, 'icon.png'), await fs.readFile(loaded.paths.iconAbs))`，**移除** `VIVO_ICON_BASE64` 写入路径（保留常量供测试桩 / 默认 fallback 使用，但不在生产路径里走）。
- 不再需要 `createVivoPackageName(config.douyin.projectName)` 派生包名；保留函数仅作 fallback 工具，但 builder 不调用。

**`mini-pack/src/platforms/vivo/rpk.ts`**
- `MINI_PACK_VIVO_FAKE_RPK=1` 测试路径里 `createVivoPackageName(config.douyin.projectName)` 改为 `loaded.materials.packageName`。
- `buildVivoRpk(projectDir, loaded)` 签名同步调整。

**`mini-pack/src/platforms/douyin/index.ts` + `template.ts`**
- `createGameJson(config)` / `createProjectConfigJson(config)` 改签名为 `(loaded)`，从 `loaded.materials.appid / projectName / rewardedAdUnitId` 与 `loaded.game.title` 读取。
- `renderDouyinGameJs(bundleCode, config)` 改签名为 `(bundleCode, loaded)`，`rewardedAdUnitId` 从 `loaded.materials.rewardedAdUnitId` 读。
- douyin builder **不复制** `icon.png` 到 `build/`（抖音小游戏提审图标在开放平台后台上传，开发包内不需要）；但 `channels/douyin/icon.png` 仍作为渠道资产由 preflight 校验存在，用于人工提交后台时取用。

### Preflight（`mini-pack/src/commands/preflight.ts`）

```ts
export interface PreflightOptions {
  projectRoot: string;     // games/<game>
  platform: "douyin" | "vivo";
}

export interface PreflightIssue {
  code: string;            // "MISSING_MATERIALS" | "MISSING_ICON" | "EMPTY_FIELD" | "INVALID_FIELD" | ...
  path: string;            // 用户视角的相对路径
  message: string;         // 中文，含路径 + 缺什么 + 怎么补
}

export async function runPreflight(options: PreflightOptions): Promise<{ issues: PreflightIssue[] }>
```

校验项（**一次性**收集，不 fail-fast）：
1. `game.config.ts` 存在且通过 `gameConfigSchema`。
2. `channels/<platform>/materials.ts` 存在且通过对应 schema。
3. `channels/<platform>/<materials.iconPath>` 文件存在。
4. 平台特定字段非空：
   - douyin：`appid`、`projectName` 非空；`rewardedAdUnitId` 若有则非空。
   - vivo：`packageName`、`versionName` 非空（regex 已在 schema 强约束）。
5. `<game.entry>`、`<game.publicDir>` 路径存在。

错误消息格式（中文）：
```
[平台名] 渠道物料未准备好，无法打包（games/<game>/channels/<platform>/）：
  - <issue 1>
  - <issue 2>
  ...
请补齐后重试。
```

每条 issue 包含路径与补齐建议，例如：
```
- materials.ts 缺少 packageName（请在该文件中设置非空字符串，例如 "com.example.app"）
- icon.png 不存在（请放置 games/difference-hunt/channels/vivo/icon.png；建议 192x192 PNG）
- DOUYIN_APPID 环境变量未设置，appid 为空（请 export DOUYIN_APPID=... 后重试）
```

### CLI（`mini-pack/src/cli.ts`）

- `mini-pack build --platform <p> --project-root <game>`：先跑 `runPreflight`，有 issue 则打印汇总并 `exit 1`；通过则跑 `runBuildCommand`。**移除 `--out-dir`**。
- 新增 `mini-pack preflight --platform <p> --project-root <game>`：仅跑 preflight，打印汇总后退出（无 issue → exit 0；有 issue → exit 1）。

### `mini-pack/src/commands/build.ts`

- 删除 `applyOutDirOverride` 与 `BuildCommandOptions.outDir`：outDir 由 `loadGameConfig` 内部约定派生为 `<gameRoot>/channels/<platform>/build/`，不再支持 CLI 覆盖。
- `runBuildCommand` 直接把 `loaded` 传给 `builder.build`。

### 根目录脚本与命令

- `scripts/build-game.mjs`：移除 `outDir` 计算与 `--out-dir` 透传，仅传 `--project-root` 与 `--platform`。
- 新增 `scripts/preflight.mjs`：调用 `mini-pack preflight`。
- `package.json` 新增 `"preflight": "node scripts/preflight.mjs"`。

## 迁移路径

按依赖方向倒推，每步可独立验证：

1. **mini-pack 侧改造**（一次完成 schema、config、builder、preflight、CLI、build-game.mjs；TDD 先行，新测试覆盖 schema/preflight/builder）。
2. **gonglian-fangxian 迁移**：
   - 拆 `game.config.ts` 为共性版。
   - 新建 `channels/douyin/{materials.ts,icon.png}`（icon 从既有 `assets/raw/art/icon` 取一张；缺则交还用户准备）。
   - 删 `platform/douyin/materials/` 与父空目录。
   - 跑 preflight + build + smoke 通过。
3. **difference-hunt 迁移**：
   - 拆 `game.config.ts`。
   - 新建 `channels/{douyin,vivo}/{materials.ts,icon.png}`（vivo icon 复制 `game/public-pack/icon.png`）。
   - 删旧 `platform/`。
   - 跑两条 preflight + build；尤其 vivo 跑通（用户原始痛点）。
4. **`.gitignore` 更新**：`games/*/channels/*/build/`。
5. **AGENT.md / AGENT_CN.md 更新**：根 + 两个游戏 AGENT 共 4 份，调整结构描述与 checklist；中英镜像同次更新；指向 `channels/`。
6. **README.md 更新**：打包命令、目录约定、验证矩阵对齐到新结构。

## 验证

```bash
pnpm --dir mini-pack test                                  # 含新增 schema / preflight / builder 测试
pnpm --dir games/gonglian-fangxian/game test
pnpm --dir games/difference-hunt/game test

pnpm preflight games/gonglian-fangxian --platform douyin
pnpm preflight games/difference-hunt --platform douyin
pnpm preflight games/difference-hunt --platform vivo

pnpm build games/gonglian-fangxian --platform douyin       # 含 smoke
pnpm build games/difference-hunt --platform douyin
pnpm build games/difference-hunt --platform vivo           # 用户原始诉求
```

mini-pack 新增测试覆盖：
- `gameConfigSchema` 接受/拒绝（无 `platform`、`outDir`；多余字段被 strict 拒）。
- `douyinMaterialsSchema` / `vivoMaterialsSchema` 接受/拒绝；包名 regex 正面/反面用例。
- `runPreflight` 一次性收集多 issue（缺 materials.ts + 缺 icon + 字段空）。
- vivo builder 用 `materials.packageName` 写 manifest（替代旧 `createVivoPackageName`）；用 `iconAbs` 写 icon（替代 `VIVO_ICON_BASE64`）。
- douyin builder 用 `materials.appid / iconPath`。
- `MINI_PACK_VIVO_FAKE_RPK=1` 路径仍可走通且使用 `materials.packageName`。

## 风险与对策

- **`createVivoPackageName` 历史依赖**：搜全部引用并迁移，保留函数仅供测试或默认 fallback；prod 路径不再依赖。
- **`VIVO_ICON_BASE64`**：保留常量便于回归测试，但生产路径不再写入。
- **AGENT.md 4 份镜像**：根 AGENT.md/AGENT_CN.md + 两个游戏的 AGENT.md/AGENT_CN.md 都涉路径。plan 把这 4 份作为同一 task 的子步骤，禁止只改一份提交。
- **Git 不识别为 rename**：`platform/<platform>/` 删除并新建 `channels/<platform>/` 时，git 视为删 + 新建。可接受，commit message 写明"重组到 channels"即可。
- **运行时桥接 `game/src/platform/{web,minipack}.ts`**：不依赖 game.config / materials；本次不动游戏 src/。
- **环境变量空值**：`?? ""` 现状会被 preflight "EMPTY_FIELD" 拒；错误消息明确指出哪个 env 没设、对应字段是什么。
- **`channels/*/build/` 入仓**：必须 .gitignore 兜底；plan 第一步即更新 .gitignore，避免后续 commit 时污染。

## 非目标（明确不做）

- 不引入 yaml / json5 / toml 依赖。
- 不做 `materials.local.ts` 或 `.env.local` 覆写。
- 不接入新平台（快手 / 微信 / 快应用联盟仍在范围外）。
- 不重写游戏运行时（`game/src/` 不动）。
- 不引入签名 / 混淆 / CI 集成。
- 不做 `mini-pack init` 之类的交互式 wizard。
- 不动"AI 工作约定"章节（上次刚立）。
- 不改既有 spec / plan 文档结构与命名规范。
