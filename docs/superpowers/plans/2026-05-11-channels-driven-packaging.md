# Channels-Driven 打包链路 实施计划

> 历史说明：本计划对应 2026-05-11 的 channels 迁移实施，已完成。后续已新增 `kuaishou` 平台；当前平台列表、命令和目录约定以 `README.md`、根 `AGENT.md` / `AGENT_CN.md` 和代码为准。本文件保留为历史执行记录，不再作为新的实施入口。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把每个游戏的渠道相关物料、配置、产物下沉到 `games/<game>/channels/<platform>/`，引入 preflight 校验，并修当前 vivo 打包的 schema 与 builder 接通缺失。

**Architecture:** mini-pack 的 schema 拆分为"游戏共性 + 渠道物料"两套；config 加载器同时加载并合并，输出新的 `LoadedGameConfig` 形状（`{ game, platform, materials, paths }`）；builder 读 `materials` 真正接通 `packageName / iconPath / appid` 等字段；CLI 在 build 前自动跑 preflight，缺项时一次性中文报告。

**Tech Stack:** TypeScript 5.9，zod 4.x（schema），esbuild 0.27（动态加载 .ts 配置），vitest 4.x（测试），pnpm 10.x。

**特别约定（与默认 writing-plans 模板的偏差）：**

- 仓库 AI 工作约定：**AI 不自主 commit**。每个 Task 末尾的 commit step 由用户授权后执行，subagent 与主会话都不自主提交。
- TDD 默认走：每个 Task 内先写失败测试 → 跑测试看红 → 实现 → 跑测试看绿 → commit 提案。
- 中英镜像：根 `AGENT.md / AGENT_CN.md` 与两个游戏的 `AGENT.md / AGENT_CN.md`（共 4 份）必须在同一 task 内同步更新。

**Spec 引用：** `docs/superpowers/specs/2026-05-11-channels-driven-packaging-design.md`

---

## File Structure

下面列出本计划改动到的所有文件（用绝对路径区分新建/修改/删除）：

**mini-pack 改造（Phase 1）**
- 修改：`mini-pack/.gitignore`（如不存在则在仓库根 `.gitignore` 加忽略）。
- 修改：`mini-pack/src/core/schema.ts`
- 修改：`mini-pack/src/core/config.ts`
- 修改：`mini-pack/src/core/paths.ts`（删除 outDir 安全检查中的过时路径，加入 channels 安全约束）
- 修改：`mini-pack/src/shared/types.ts`
- 修改：`mini-pack/src/platforms/index.ts`
- 修改：`mini-pack/src/platforms/vivo/index.ts`
- 修改：`mini-pack/src/platforms/vivo/template.ts`
- 修改：`mini-pack/src/platforms/vivo/rpk.ts`
- 修改：`mini-pack/src/platforms/douyin/index.ts`
- 修改：`mini-pack/src/platforms/douyin/template.ts`
- 修改：`mini-pack/src/commands/build.ts`
- 删除：`mini-pack/src/commands/validate.ts`（被 preflight 取代）
- 新建：`mini-pack/src/commands/preflight.ts`
- 修改：`mini-pack/src/cli.ts`
- 修改：`mini-pack/src/index.ts`（新增 defineDouyinMaterials/defineVivoMaterials 导出）
- 修改/新建：`mini-pack/tests/unit/schema.test.ts`、`mini-pack/tests/unit/config.test.ts`、`mini-pack/tests/unit/preflight.test.ts`、`mini-pack/tests/unit/vivo-rpk.test.ts`
- 修改/新建：`mini-pack/tests/integration/build.test.ts`、`mini-pack/tests/integration/preflight.test.ts`、`mini-pack/tests/integration/repo-build.test.ts`
- 删除：`mini-pack/tests/integration/validate.test.ts`
- 修改：`mini-pack/tests/fixtures/valid-douyin-game/`（按新结构重组）

**根脚本与忽略（Phase 1 末尾）**
- 修改：`scripts/build-game.mjs`
- 新建：`scripts/preflight.mjs`
- 修改：`package.json`
- 修改：`.gitignore`（仓库根）

**gonglian-fangxian 迁移（Phase 2）**
- 修改：`games/gonglian-fangxian/game.config.ts`
- 新建：`games/gonglian-fangxian/channels/douyin/materials.ts`
- 新建：`games/gonglian-fangxian/channels/douyin/icon.png`（从现有素材取一张拷贝）
- 删除：`games/gonglian-fangxian/platform/douyin/materials/.gitkeep` 及空父目录

**difference-hunt 迁移（Phase 3）**
- 修改：`games/difference-hunt/game.config.ts`
- 新建：`games/difference-hunt/channels/douyin/materials.ts`
- 新建：`games/difference-hunt/channels/douyin/icon.png`（从 `game/public-pack/icon.png` 拷贝）
- 新建：`games/difference-hunt/channels/vivo/materials.ts`
- 新建：`games/difference-hunt/channels/vivo/icon.png`（从 `game/public-pack/icon.png` 拷贝）
- 删除：`games/difference-hunt/platform/douyin/materials/.gitkeep` 及空父目录

**文档同步（Phase 4）**
- 修改：`AGENT.md`、`AGENT_CN.md`
- 修改：`games/gonglian-fangxian/AGENT.md`、`games/gonglian-fangxian/AGENT_CN.md`
- 修改：`games/difference-hunt/AGENT.md`、`games/difference-hunt/AGENT_CN.md`
- 修改：`README.md`

---

## Task 1: 根 `.gitignore` 增加 channels build 忽略

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/.gitignore`

**Why this task:** 在迁移真正写入 `channels/<platform>/build/` 产物之前，先把忽略规则加上，避免后续 task 跑构建时把产物当成"待提交"。

- [ ] **Step 1: 看当前 .gitignore**

Run:
```bash
cat /Users/apple/Documents/codex_projects/acos-mvp/.gitignore
```
记下当前文件内容；在末尾追加新条目。

- [ ] **Step 2: 用 Edit 在文件末尾追加 channels build 忽略**

Edit 操作。`old_string` 取当前 `.gitignore` 最后一行（用 cat 输出确定）；`new_string` 为该行 + 新内容。

例：若末尾是 `builds/`，则：

`old_string`:
```
builds/
```

`new_string`:
```
builds/

# Channels build outputs (per-game per-platform)
games/*/channels/*/build/
```

如末尾不是 `builds/`，则取实际最后一行作为 `old_string`，按相同模式追加。

- [ ] **Step 3: 校验**

Run:
```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp diff .gitignore
```
Expected：仅追加，无删除（`-` 行计数为 0）。

- [ ] **Step 4: Commit 提案（等待用户授权）**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add .gitignore
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "chore: ignore games/*/channels/*/build/"
```
执行器（subagent / 主会话）按"AI 不自主 commit"约定，不直接执行；改为暂存改动并通知用户在 Phase 末统一提交。

---

## Task 2: schema 重构（gameConfigSchema 瘦身 + 新增 materials schema）

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/core/schema.ts`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/index.ts`
- Test: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/unit/schema.test.ts`（新建）

**Why this task:** 把 `platform / outDir / douyin / vivo` 从 game.config 移除，建立独立的 douyin/vivo materials schema，解锁后续 config 加载器与 builder 改造。

- [ ] **Step 1: 写 schema 单元测试（先红）**

Create `mini-pack/tests/unit/schema.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  gameConfigSchema,
  douyinMaterialsSchema,
  vivoMaterialsSchema,
  defineGameConfig,
  defineDouyinMaterials,
  defineVivoMaterials,
} from '../../src/core/schema.js';

describe('gameConfigSchema', () => {
  it('accepts a minimal game config without platform/outDir', () => {
    const result = gameConfigSchema.safeParse({
      title: '就你眼神好',
      entry: 'game/src/main.ts',
      publicDir: 'game/public-pack',
      orientation: 'portrait',
      canvas: { width: 750, height: 1334 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects extra keys (strict)', () => {
    const result = gameConfigSchema.safeParse({
      title: 't',
      entry: 'e',
      publicDir: 'p',
      orientation: 'portrait',
      canvas: { width: 1, height: 1 },
      douyin: { appid: '' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = gameConfigSchema.safeParse({
      title: '',
      entry: 'e',
      publicDir: 'p',
      orientation: 'portrait',
      canvas: { width: 1, height: 1 },
    });
    expect(result.success).toBe(false);
  });
});

describe('douyinMaterialsSchema', () => {
  it('accepts valid douyin materials with default iconPath', () => {
    const result = douyinMaterialsSchema.safeParse({
      appid: 'tt12345',
      projectName: 'difference-hunt',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.iconPath).toBe('icon.png');
  });

  it('allows empty appid (preflight strictness, not schema)', () => {
    const result = douyinMaterialsSchema.safeParse({
      appid: '',
      projectName: 'difference-hunt',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty projectName', () => {
    const result = douyinMaterialsSchema.safeParse({
      appid: 'tt12345',
      projectName: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra keys', () => {
    const result = douyinMaterialsSchema.safeParse({
      appid: 'tt12345',
      projectName: 'difference-hunt',
      packageName: 'com.x.y',
    });
    expect(result.success).toBe(false);
  });
});

describe('vivoMaterialsSchema', () => {
  it('accepts valid vivo materials and applies defaults', () => {
    const result = vivoMaterialsSchema.safeParse({
      packageName: 'com.example.app',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.iconPath).toBe('icon.png');
      expect(result.data.versionName).toBe('1.0.0');
      expect(result.data.versionCode).toBe(1);
    }
  });

  it('rejects packageName missing dot', () => {
    const result = vivoMaterialsSchema.safeParse({ packageName: 'singletoken' });
    expect(result.success).toBe(false);
  });

  it('rejects packageName starting with digit', () => {
    const result = vivoMaterialsSchema.safeParse({ packageName: '1com.example.app' });
    expect(result.success).toBe(false);
  });

  it('rejects packageName with hyphen', () => {
    const result = vivoMaterialsSchema.safeParse({ packageName: 'com.example-app.x' });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive versionCode', () => {
    const result = vivoMaterialsSchema.safeParse({ packageName: 'com.x.y', versionCode: 0 });
    expect(result.success).toBe(false);
  });
});

describe('define*', () => {
  it('defineGameConfig returns its input', () => {
    const config = {
      title: 't',
      entry: 'e',
      publicDir: 'p',
      orientation: 'portrait' as const,
      canvas: { width: 1, height: 1 },
    };
    expect(defineGameConfig(config)).toBe(config);
  });

  it('defineDouyinMaterials returns its input', () => {
    const m = { appid: 'a', projectName: 'p', iconPath: 'icon.png' };
    expect(defineDouyinMaterials(m)).toBe(m);
  });

  it('defineVivoMaterials returns its input', () => {
    const m = { packageName: 'com.x.y', iconPath: 'icon.png', versionName: '1.0.0', versionCode: 1 };
    expect(defineVivoMaterials(m)).toBe(m);
  });
});
```

- [ ] **Step 2: 跑测试看红**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/schema.test.ts
```
Expected：FAIL，找不到 `douyinMaterialsSchema`、`vivoMaterialsSchema`、`defineDouyinMaterials`、`defineVivoMaterials`，且 gameConfigSchema 现行接受 `platform/douyin/outDir` 字段，新加的"无 platform"用例可能也会失败。

- [ ] **Step 3: 重写 `mini-pack/src/core/schema.ts`**

完整覆写 `mini-pack/src/core/schema.ts`：

```ts
import { z } from 'zod';

export const gameConfigSchema = z
  .object({
    title: z.string().trim().min(1, 'title must not be empty'),
    entry: z.string().trim().min(1, 'entry must not be empty'),
    publicDir: z.string().trim().min(1, 'publicDir must not be empty'),
    orientation: z.enum(['portrait', 'landscape']),
    canvas: z.object({
      width: z.number().positive('canvas.width must be greater than 0'),
      height: z.number().positive('canvas.height must be greater than 0'),
    }),
  })
  .strict();

export type GameConfig = z.infer<typeof gameConfigSchema>;

export function defineGameConfig(config: GameConfig): GameConfig {
  return config;
}

export const douyinMaterialsSchema = z
  .object({
    appid: z.string(),
    projectName: z.string().trim().min(1, 'douyin.projectName must not be empty'),
    rewardedAdUnitId: z.string().optional(),
    iconPath: z.string().trim().min(1).default('icon.png'),
  })
  .strict();

export type DouyinMaterials = z.infer<typeof douyinMaterialsSchema>;

export function defineDouyinMaterials(materials: DouyinMaterials): DouyinMaterials {
  return materials;
}

const PACKAGE_NAME_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export const vivoMaterialsSchema = z
  .object({
    packageName: z
      .string()
      .trim()
      .regex(PACKAGE_NAME_PATTERN, 'packageName must be a reverse domain (e.g. com.example.app)'),
    iconPath: z.string().trim().min(1).default('icon.png'),
    versionName: z.string().trim().min(1).default('1.0.0'),
    versionCode: z.number().int().positive().default(1),
  })
  .strict();

export type VivoMaterials = z.infer<typeof vivoMaterialsSchema>;

export function defineVivoMaterials(materials: VivoMaterials): VivoMaterials {
  return materials;
}
```

- [ ] **Step 4: 更新 `mini-pack/src/index.ts` 的导出**

完整覆写 `mini-pack/src/index.ts`：

```ts
export {
  defineGameConfig,
  defineDouyinMaterials,
  defineVivoMaterials,
} from './core/schema.js';
export type {
  GameConfig,
  DouyinMaterials,
  VivoMaterials,
} from './core/schema.js';
export type {
  GameApp,
  GameRuntime,
  RuntimeAds,
  RuntimeAudio,
  RuntimeLogger,
  RuntimeRewards,
  RuntimeStorage,
} from './shared/types.js';
```

- [ ] **Step 5: 跑 schema 测试看绿**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/schema.test.ts
```
Expected：所有用例 PASS（约 14 条）。

- [ ] **Step 6: 跑全套 mini-pack 测试**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test
```
Expected：schema.test.ts 全绿；其它测试因后续 task 还没改完会有大量失败（config/builder/validate 都依赖旧 schema）——这是预期，记录下来即可。本 task 不要求其它测试通过。

- [ ] **Step 7: Commit 提案（等待用户授权）**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  mini-pack/src/core/schema.ts \
  mini-pack/src/index.ts \
  mini-pack/tests/unit/schema.test.ts
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "refactor(mini-pack): split schema into game config + per-channel materials"
```
按 AI 工作约定不自主 commit。

---

## Task 3: config 加载器重构

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/core/config.ts`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/shared/types.ts`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/core/paths.ts`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/platforms/index.ts`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/unit/config.test.ts`
- Test: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/fixtures/valid-douyin-game/`（按新结构重组）

**Why this task:** 让 `loadGameConfig` 同时加载 `game.config.ts` 与 `channels/<platform>/materials.ts`，构造新的 `LoadedGameConfig`（`{ game, platform, materials, paths }`），并在共用基础设施层稳定 builder 接口。

- [ ] **Step 1: 重组测试 fixture**

旧 fixture：`mini-pack/tests/fixtures/valid-douyin-game/` 含 `game.config.ts`（带 `platform/douyin/outDir`），需要按新结构改：

新 fixture 结构：
```
mini-pack/tests/fixtures/valid-douyin-game/
  game.config.ts                           # 共性版（已无 platform/douyin/outDir）
  game/
    main.ts                                 # 空 entry
  game/public-pack/                        # 空目录（用 .gitkeep）
  channels/
    douyin/
      materials.ts
      icon.png                             # 1x1 占位 PNG
```

把现有 fixture 文件做以下改动（用 Read + Write/Edit 完成）：

`mini-pack/tests/fixtures/valid-douyin-game/game.config.ts`（覆写）：
```ts
import { defineGameConfig } from '../../../src/index';

export default defineGameConfig({
  title: 'Fixture Game',
  entry: 'game/main.ts',
  publicDir: 'game/public-pack',
  orientation: 'portrait',
  canvas: { width: 750, height: 1334 },
});
```

新建 `mini-pack/tests/fixtures/valid-douyin-game/game/main.ts`（如不存在）：
```ts
export function createGame() {
  return { start() {}, pause() {}, resume() {}, destroy() {} };
}
```

新建 `mini-pack/tests/fixtures/valid-douyin-game/game/public-pack/.gitkeep`（空文件）。

新建 `mini-pack/tests/fixtures/valid-douyin-game/channels/douyin/materials.ts`：
```ts
import { defineDouyinMaterials } from '../../../../../src/index';

export default defineDouyinMaterials({
  appid: 'tt-fixture-appid',
  projectName: 'fixture',
  iconPath: 'icon.png',
});
```

复制一个最小 1x1 PNG（如有，从 `games/difference-hunt/game/public-pack/icon.png` 取）到 `mini-pack/tests/fixtures/valid-douyin-game/channels/douyin/icon.png`。

如旧 fixture 还有别的子目录（如 `platform/douyin/...`），全部删除。

- [ ] **Step 2: 写 config 加载器测试（覆写或新建 `tests/unit/config.test.ts`）**

完整覆写：

```ts
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGameConfig } from '../../src/core/config.js';
import { isUserError } from '../../src/shared/errors.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const validGame = path.join(fixturesDir, 'valid-douyin-game');

describe('loadGameConfig', () => {
  it('loads game.config.ts and douyin materials.ts', async () => {
    const loaded = await loadGameConfig({
      projectRoot: validGame,
      platform: 'douyin',
    });

    expect(loaded.game.title).toBe('Fixture Game');
    expect(loaded.platform).toBe('douyin');
    expect(loaded.materials.appid).toBe('tt-fixture-appid');
    expect(loaded.materials.projectName).toBe('fixture');
    expect(loaded.paths.channelRoot).toBe(path.join(validGame, 'channels/douyin'));
    expect(loaded.paths.materialsAbs).toBe(path.join(validGame, 'channels/douyin/materials.ts'));
    expect(loaded.paths.iconAbs).toBe(path.join(validGame, 'channels/douyin/icon.png'));
    expect(loaded.paths.outDirAbs).toBe(path.join(validGame, 'channels/douyin/build'));
    expect(loaded.paths.entryAbs).toBe(path.join(validGame, 'game/main.ts'));
    expect(loaded.paths.publicDirAbs).toBe(path.join(validGame, 'game/public-pack'));
  });

  it('throws UserError when channels/<platform>/materials.ts is missing', async () => {
    await expect(
      loadGameConfig({
        projectRoot: validGame,
        platform: 'vivo', // valid fixture has no vivo channel
      }),
    ).rejects.toSatisfy((error) => isUserError(error));
  });

  it('throws UserError when project root has no game.config.ts', async () => {
    await expect(
      loadGameConfig({
        projectRoot: fixturesDir, // not a project
        platform: 'douyin',
      }),
    ).rejects.toSatisfy((error) => isUserError(error));
  });
});
```

- [ ] **Step 3: 跑测试看红**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/config.test.ts
```
Expected：FAIL（结构不存在 game/materials/platform/paths.channelRoot 等字段）。

- [ ] **Step 4: 重写 `mini-pack/src/shared/types.ts`**

修改 `LoadedGameConfig` 与 `ResolvedPaths`：

```ts
import type {
  DouyinMaterials,
  GameConfig,
  VivoMaterials,
} from '../core/schema.js';

export type PlatformName = 'douyin' | 'vivo';

export type ChannelMaterials = DouyinMaterials | VivoMaterials;

export interface ResolvedPaths {
  configFileAbs: string;
  entryAbs: string;
  publicDirAbs: string;
  channelRoot: string;
  materialsAbs: string;
  iconAbs: string;
  outDirAbs: string;
}

export interface LoadedGameConfig {
  game: GameConfig;
  platform: PlatformName;
  materials: ChannelMaterials;
  projectRoot: string;
  paths: ResolvedPaths;
  /** Convenience: same as `materials` narrowed to DouyinMaterials when platform === 'douyin'. */
  douyinMaterials?: DouyinMaterials;
  /** Convenience: same as `materials` narrowed to VivoMaterials when platform === 'vivo'. */
  vivoMaterials?: VivoMaterials;
}

export interface AssetStats {
  count: number;
  bytes: number;
}

export interface BundleResult {
  file: string;
  bytes: number;
}

export interface BuildReport {
  tool: 'mini-pack';
  platform: PlatformName;
  title: string;
  entry: string;
  publicDir: string;
  outDir: string;
  bundle: BundleResult;
  assets: AssetStats;
  warnings: string[];
}

export interface GameApp {
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export interface GameRuntime {
  canvas: HTMLCanvasElement;
  storage: RuntimeStorage;
  audio: RuntimeAudio;
  ads: RuntimeAds;
  haptics?: RuntimeHaptics;
  rewards: RuntimeRewards;
  logger: RuntimeLogger;
}

export interface RuntimeStorage {
  getString(key: string): string | null;
  setString(key: string, value: string): void;
  remove(key: string): void;
}

export interface RuntimeAudio {
  playSfx(name: string): Promise<void>;
  playMusic(name: string, loop: boolean): Promise<void>;
  stopMusic(): void;
  setMuted(muted: boolean): void;
}

export interface RuntimeAds {
  isRewardedVideoReady(slot: RewardedVideoSlot): boolean;
  showRewardedVideo(slot: RewardedVideoSlot): Promise<RewardedVideoResult>;
}

export interface RuntimeHaptics {
  trigger(kind: 'short' | 'long'): void;
}

export type RewardedVideoSlot = 'add-steps' | 'claim-reward';

export interface RewardedVideoResult {
  completed: boolean;
}

export interface RuntimeRewards {
  canAddDesktop(): Promise<boolean>;
  requestAddDesktop(): Promise<boolean>;
  canAddFavorite(): Promise<boolean>;
  requestAddFavorite(): Promise<boolean>;
  didEnterFromSidebar(): Promise<boolean>;
  requestSidebarEntry(): Promise<boolean>;
}

export interface RuntimeLogger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}
```

- [ ] **Step 5: 重写 `mini-pack/src/core/paths.ts`**

旧的 `assertSafeOutDir / assertSafeGeneratedOutDir` 不再用（outDir 由约定路径决定，不接受用户输入）。保留 `resolveProjectPath / isSameOrInside`。

完整覆写：

```ts
import path from 'node:path';

import { UserError } from '../shared/errors.js';

export function resolveProjectPath(projectRoot: string, value: string, fieldName: string): string {
  if (path.isAbsolute(value)) {
    throw new UserError(
      `${fieldName} must be relative to the project root: ${value}`,
      `Use a project-relative path in game.config.ts.`,
    );
  }

  const resolved = path.resolve(projectRoot, value);
  if (!isSameOrInside(resolved, projectRoot)) {
    throw new UserError(
      `${fieldName} must stay inside the project root: ${value}`,
      `Update ${fieldName} in game.config.ts to a path inside this project.`,
    );
  }

  return resolved;
}

export function isSameOrInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
```

- [ ] **Step 6: 重写 `mini-pack/src/core/config.ts`**

完整覆写。同时保留 `.env` 加载（`withProjectEnv`）；新增 `loadMaterials` 私有函数；`loadGameConfig` 改造：

```ts
import { build as esbuild } from 'esbuild';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  douyinMaterialsSchema,
  gameConfigSchema,
  vivoMaterialsSchema,
  type DouyinMaterials,
  type GameConfig,
  type VivoMaterials,
} from './schema.js';
import { resolveProjectPath } from './paths.js';
import { UserError } from '../shared/errors.js';
import type {
  ChannelMaterials,
  LoadedGameConfig,
  PlatformName,
} from '../shared/types.js';

export interface LoadGameConfigOptions {
  projectRoot?: string;
  platform: PlatformName;
  configFile?: string;
}

export async function loadGameConfig(options: LoadGameConfigOptions): Promise<LoadedGameConfig> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const configFileAbs = path.resolve(projectRoot, options.configFile ?? 'game.config.ts');
  const platform = options.platform;

  await assertPathExists(
    configFileAbs,
    'Config file not found',
    'Create game.config.ts in the project root.',
  );

  const rawGame = await withProjectEnv(projectRoot, () => importDefault(configFileAbs));
  const parsedGame = gameConfigSchema.safeParse(rawGame);

  if (!parsedGame.success) {
    throw new UserError(
      'Invalid game.config.ts.',
      parsedGame.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'),
    );
  }

  const game: GameConfig = parsedGame.data;
  const channelRoot = path.join(projectRoot, 'channels', platform);
  const materialsAbs = path.join(channelRoot, 'materials.ts');

  await assertPathExists(
    materialsAbs,
    `Channel materials not found: channels/${platform}/materials.ts`,
    `Create channels/${platform}/materials.ts before building or running preflight.`,
  );

  const rawMaterials = await withProjectEnv(projectRoot, () => importDefault(materialsAbs));
  const materials: ChannelMaterials =
    platform === 'douyin'
      ? parseMaterials(douyinMaterialsSchema, rawMaterials, 'douyin')
      : parseMaterials(vivoMaterialsSchema, rawMaterials, 'vivo');

  const entryAbs = resolveProjectPath(projectRoot, game.entry, 'entry');
  const publicDirAbs = resolveProjectPath(projectRoot, game.publicDir, 'publicDir');
  const iconAbs = path.resolve(channelRoot, materials.iconPath);
  const outDirAbs = path.join(channelRoot, 'build');

  return {
    game,
    platform,
    materials,
    projectRoot,
    paths: {
      configFileAbs,
      entryAbs,
      publicDirAbs,
      channelRoot,
      materialsAbs,
      iconAbs,
      outDirAbs,
    },
    douyinMaterials: platform === 'douyin' ? (materials as DouyinMaterials) : undefined,
    vivoMaterials: platform === 'vivo' ? (materials as VivoMaterials) : undefined,
  };
}

function parseMaterials<T>(schema: { safeParse: (input: unknown) => { success: boolean; data?: T; error?: { issues: Array<{ path: Array<string | number>; message: string }> } } }, raw: unknown, platform: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success || !parsed.data) {
    const detail = parsed.error?.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n') ?? 'unknown';
    throw new UserError(`Invalid channels/${platform}/materials.ts.`, detail);
  }
  return parsed.data;
}

async function withProjectEnv<T>(projectRoot: string, load: () => Promise<T>): Promise<T> {
  const env = await loadProjectEnv(projectRoot);
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  try {
    return await load();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function loadProjectEnv(projectRoot: string): Promise<Record<string, string>> {
  const envFile = path.join(projectRoot, '.env');
  try {
    return parseDotEnv(await fs.readFile(envFile, 'utf8'));
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

function parseDotEnv(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    values[key] = parseEnvValue(normalized.slice(equalsIndex + 1).trim());
  }

  return values;
}

function parseEnvValue(value: string): string {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }
  const commentIndex = value.indexOf(' #');
  return (commentIndex >= 0 ? value.slice(0, commentIndex) : value).trim();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

async function importDefault(fileAbs: string): Promise<unknown> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-config-'));
  const outfile = path.join(tempDir, 'module.mjs');

  try {
    await esbuild({
      entryPoints: [fileAbs],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      logLevel: 'silent',
    });

    const moduleUrl = `${pathToFileURL(outfile).href}?t=${Date.now()}`;
    const loaded = (await import(moduleUrl)) as { default?: unknown };
    if (!loaded.default || typeof loaded.default !== 'object') {
      throw new UserError(`${path.basename(fileAbs)} must export a default object.`);
    }
    return loaded.default;
  } catch (error) {
    if (error instanceof UserError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(
      `Failed to load ${path.relative(path.dirname(fileAbs), fileAbs)}: ${message}`,
      'Fix syntax errors or invalid imports.',
    );
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

async function assertPathExists(filePath: string, message: string, suggestion: string): Promise<void> {
  try {
    await fs.stat(filePath);
  } catch {
    throw new UserError(message, suggestion);
  }
}
```

- [ ] **Step 7: 同步 `mini-pack/src/platforms/index.ts`**

更新 `PlatformBuilder.build / validate` 签名以匹配新 `LoadedGameConfig`（结构变化但类型名相同，多数代码层面不动；但 builder 实现需要改读 `config.materials` 而不是 `config.douyin / config.vivo`）。

完整覆写 `mini-pack/src/platforms/index.ts`：

```ts
import { douyinPlatformBuilder } from './douyin/index.js';
import { vivoPlatformBuilder } from './vivo/index.js';
import { UserError } from '../shared/errors.js';
import type { BuildReport, LoadedGameConfig, PlatformName } from '../shared/types.js';

export interface PlatformBuildOptions {
  skipVivoRpk?: boolean;
}

export interface PlatformBuilder {
  name: PlatformName;
  build(loaded: LoadedGameConfig, options?: PlatformBuildOptions): Promise<BuildReport>;
}

const supportedPlatforms = ['douyin', 'vivo'] as const;

export function getPlatformBuilder(platform: string): PlatformBuilder {
  if (platform === 'douyin') return douyinPlatformBuilder;
  if (platform === 'vivo') return vivoPlatformBuilder;

  throw new UserError(
    `Unsupported platform: ${platform}`,
    `Supported platforms: ${supportedPlatforms.join(', ')}`,
  );
}
```

注意：`validate` 方法从 `PlatformBuilder` 接口删除（preflight 接管）。

- [ ] **Step 8: 跑 config 测试看绿**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/config.test.ts
```
Expected：所有 3 用例 PASS。

- [ ] **Step 9: 跑 schema + config 联合**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/schema.test.ts tests/unit/config.test.ts
```
Expected：全绿。其它测试（builder、validate）仍红，到对应 task 处理。

- [ ] **Step 10: Commit 提案（等待用户授权）**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  mini-pack/src/shared/types.ts \
  mini-pack/src/core/paths.ts \
  mini-pack/src/core/config.ts \
  mini-pack/src/platforms/index.ts \
  mini-pack/tests/unit/config.test.ts \
  mini-pack/tests/fixtures/valid-douyin-game/
git -C /Users/apple/Documents/codex_projects/acos-mvp rm -r \
  mini-pack/tests/fixtures/valid-douyin-game/platform 2>/dev/null || true
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "refactor(mini-pack): load game config + per-channel materials, drop outDir input"
```

---

## Task 4: build.ts 简化

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/commands/build.ts`

**Why this task:** `applyOutDirOverride` 与 `--out-dir` 不再需要——outDir 已是约定路径。

- [ ] **Step 1: 完整覆写 `mini-pack/src/commands/build.ts`**

```ts
import { loadGameConfig } from '../core/config.js';
import { getPlatformBuilder } from '../platforms/index.js';
import { logger } from '../shared/logger.js';
import type { PlatformName } from '../shared/types.js';

export interface BuildCommandOptions {
  platform: string;
  projectRoot?: string;
  skipVivoRpk?: boolean;
}

export async function runBuildCommand(options: BuildCommandOptions): Promise<void> {
  const builder = getPlatformBuilder(options.platform);
  const loaded = await loadGameConfig({
    projectRoot: options.projectRoot,
    platform: options.platform as PlatformName,
  });
  const report = await builder.build(loaded, {
    skipVivoRpk: options.skipVivoRpk === true,
  });

  for (const warning of report.warnings) {
    logger.warn(warning);
  }
  logger.success(`Built ${report.platform} package at ${report.outDir}`);
}
```

- [ ] **Step 2: 跑类型检查**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack run build
```
Expected：tsc 仅报"builders 未适配新接口"等错（vivo/index.ts 等 builder 改造在后续 task）。**记下错误位置**，预期都集中在 builders 内、validate.ts 内。

- [ ] **Step 3: Commit 提案**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add mini-pack/src/commands/build.ts
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "refactor(mini-pack): drop --out-dir override in build command"
```

---

## Task 5: vivo template + builder 接通 materials

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/platforms/vivo/template.ts`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/platforms/vivo/index.ts`
- Test: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/unit/vivo-template.test.ts`（新建）

**Why this task:** 让 vivo 真正使用 `materials.packageName / iconPath / versionName / versionCode`，并把图标从 base64 改为读 `iconAbs` 文件。

- [ ] **Step 1: 写 vivo template 单测**

新建 `mini-pack/tests/unit/vivo-template.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { createVivoManifest } from '../../src/platforms/vivo/template.js';
import type { LoadedGameConfig } from '../../src/shared/types.js';

function makeLoaded(): LoadedGameConfig {
  return {
    game: {
      title: '就你眼神好',
      entry: 'game/src/main.ts',
      publicDir: 'game/public-pack',
      orientation: 'portrait',
      canvas: { width: 750, height: 1334 },
    },
    platform: 'vivo',
    materials: {
      packageName: 'com.example.app',
      iconPath: 'icon.png',
      versionName: '2.5.0',
      versionCode: 7,
    },
    projectRoot: '/tmp/x',
    paths: {
      configFileAbs: '/tmp/x/game.config.ts',
      entryAbs: '/tmp/x/game/src/main.ts',
      publicDirAbs: '/tmp/x/game/public-pack',
      channelRoot: '/tmp/x/channels/vivo',
      materialsAbs: '/tmp/x/channels/vivo/materials.ts',
      iconAbs: '/tmp/x/channels/vivo/icon.png',
      outDirAbs: '/tmp/x/channels/vivo/build',
    },
    vivoMaterials: {
      packageName: 'com.example.app',
      iconPath: 'icon.png',
      versionName: '2.5.0',
      versionCode: 7,
    },
  };
}

describe('createVivoManifest', () => {
  it('uses materials.packageName / versionName / versionCode and game.title / orientation', () => {
    const manifest = createVivoManifest(makeLoaded());
    expect(manifest.package).toBe('com.example.app');
    expect(manifest.name).toBe('就你眼神好');
    expect(manifest.versionName).toBe('2.5.0');
    expect(manifest.versionCode).toBe(7);
    expect(manifest.deviceOrientation).toBe('portrait');
    expect(manifest.icon).toBe('/icon.png');
    expect(manifest.type).toBe('game');
    expect(manifest.minPlatformVersion).toBe(1060);
  });
});
```

- [ ] **Step 2: 跑测试看红**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/vivo-template.test.ts
```
Expected：FAIL（旧 `createVivoManifest(config)` 签名读 `config.douyin.projectName`）。

- [ ] **Step 3: 改造 `mini-pack/src/platforms/vivo/template.ts`**

把 `createVivoManifest` 改为读 `loaded.materials / loaded.game`。其余函数 `createVivoPackageJson / VIVO_ICON_BASE64 / createVivoPackageName / renderVivoGameJs` 保留。

只改 `createVivoManifest` 与导出入参类型，文件其余部分不动。具体 Edit：

`old_string`（取自 `template.ts:26-40` 当前实现，含完整函数体）：
```ts
export function createVivoManifest(config: LoadedGameConfig): Record<string, unknown> {
  return {
    package: createVivoPackageName(config.douyin.projectName),
    name: config.title,
    versionName: '1.0.0',
    versionCode: 1,
    minPlatformVersion: 1060,
    deviceOrientation: config.orientation,
    type: 'game',
    icon: '/icon.png',
    config: {
      logLevel: 'debug',
    },
  };
}
```

`new_string`：
```ts
export function createVivoManifest(loaded: LoadedGameConfig): Record<string, unknown> {
  if (loaded.platform !== 'vivo' || !loaded.vivoMaterials) {
    throw new Error('createVivoManifest requires a loaded vivo config');
  }
  const { vivoMaterials, game } = loaded;
  return {
    package: vivoMaterials.packageName,
    name: game.title,
    versionName: vivoMaterials.versionName,
    versionCode: vivoMaterials.versionCode,
    minPlatformVersion: 1060,
    deviceOrientation: game.orientation,
    type: 'game',
    icon: '/icon.png',
    config: {
      logLevel: 'debug',
    },
  };
}
```

- [ ] **Step 4: 改造 `mini-pack/src/platforms/vivo/index.ts`**

把 vivo builder 改为：
1. 读 `loaded.paths.iconAbs` 写入产物 `srcDir/icon.png`（替代 `VIVO_ICON_BASE64`）。
2. 调用 `createVivoManifest(loaded)`（已是 loaded 形参）。
3. `buildVivoRpk(outDir, loaded)`（签名见 Task 6）。

完整覆写 `mini-pack/src/platforms/vivo/index.ts`：

```ts
import fs from 'fs-extra';
import path from 'node:path';

import { copyAssets } from '../../core/assets.js';
import { bundleGameEntry } from '../../core/bundle.js';
import { createBuildReport, writeBuildReport } from '../../core/report.js';
import { UserError } from '../../shared/errors.js';
import type { BuildReport, LoadedGameConfig } from '../../shared/types.js';
import type { PlatformBuildOptions, PlatformBuilder } from '../index.js';
import { buildVivoRpk } from './rpk.js';
import { createVivoManifest, createVivoPackageJson, renderVivoGameJs } from './template.js';

export const vivoPlatformBuilder: PlatformBuilder = {
  name: 'vivo',

  async build(loaded: LoadedGameConfig, options: PlatformBuildOptions = {}): Promise<BuildReport> {
    if (loaded.platform !== 'vivo') {
      throw new UserError(`Vivo builder cannot build platform: ${loaded.platform}`);
    }

    const outDir = loaded.paths.outDirAbs;
    const srcDir = path.join(outDir, 'src');
    await fs.remove(outDir);
    await fs.ensureDir(srcDir);

    await fs.writeJson(path.join(outDir, 'package.json'), createVivoPackageJson(), { spaces: 2 });
    await fs.writeJson(path.join(srcDir, 'manifest.json'), createVivoManifest(loaded), { spaces: 2 });
    await fs.copyFile(loaded.paths.iconAbs, path.join(srcDir, 'icon.png'));

    const tempDir = path.join(outDir, '.mini-pack');
    const tempBundle = path.join(tempDir, 'game.bundle.js');
    await bundleGameEntry({
      entryAbs: loaded.paths.entryAbs,
      outfile: tempBundle,
    });

    const bundleCode = await fs.readFile(tempBundle, 'utf8');
    const finalGameJs = renderVivoGameJs(bundleCode);
    const gameJsPath = path.join(srcDir, 'game.js');
    await fs.writeFile(gameJsPath, finalGameJs);
    await fs.remove(tempDir);

    const assetStats = await copyAssets({
      sourceDir: loaded.paths.publicDirAbs,
      destinationDir: path.join(srcDir, 'assets'),
    });
    const bundleStats = await fs.stat(gameJsPath);

    const reportOutDir = path.relative(loaded.projectRoot, outDir).split(path.sep).join('/');

    const report = createBuildReport({
      platform: 'vivo',
      title: loaded.game.title,
      entry: loaded.game.entry,
      publicDir: loaded.game.publicDir,
      outDir: reportOutDir,
      bundleBytes: bundleStats.size,
      assetCount: assetStats.count,
      assetBytes: assetStats.bytes,
    });

    await writeBuildReport(path.join(outDir, 'build-report.json'), report);

    if (!options.skipVivoRpk) {
      await buildVivoRpk(outDir, loaded);
    }

    return report;
  },
};
```

- [ ] **Step 5: 跑 vivo template 测试看绿**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/vivo-template.test.ts
```
Expected：PASS。

- [ ] **Step 6: Commit 提案**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  mini-pack/src/platforms/vivo/template.ts \
  mini-pack/src/platforms/vivo/index.ts \
  mini-pack/tests/unit/vivo-template.test.ts
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "refactor(mini-pack/vivo): use materials packageName/version + iconAbs"
```

---

## Task 6: vivo rpk.ts 接通 materials.packageName

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/platforms/vivo/rpk.ts`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/unit/vivo-rpk.test.ts`

**Why this task:** `MINI_PACK_VIVO_FAKE_RPK=1` 测试路径与 `buildVivoRpk` 当前依赖 `config.douyin.projectName`，必须改为 `loaded.vivoMaterials.packageName`。

- [ ] **Step 1: 看现有 vivo-rpk.test.ts**

```bash
cat /Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/unit/vivo-rpk.test.ts
```
记下结构（多数测试 `createVivoCliCommand`，可能也覆盖 `MINI_PACK_VIVO_FAKE_RPK`）。

- [ ] **Step 2: 改写 vivo-rpk.test.ts 中的 fake-rpk 用例**

如果存在传 `config.douyin` 的测试用例，将 `config` 替换为 `loaded`（含 `vivoMaterials.packageName: 'com.example.app'`）。如不存在 fake-rpk 用例，新增一条：

```ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildVivoRpk } from '../../src/platforms/vivo/rpk.js';
import type { LoadedGameConfig } from '../../src/shared/types.js';

function makeLoaded(projectRoot: string): LoadedGameConfig {
  return {
    game: {
      title: 't',
      entry: 'e',
      publicDir: 'p',
      orientation: 'portrait',
      canvas: { width: 1, height: 1 },
    },
    platform: 'vivo',
    materials: {
      packageName: 'com.example.app',
      iconPath: 'icon.png',
      versionName: '1.0.0',
      versionCode: 1,
    },
    projectRoot,
    paths: {
      configFileAbs: path.join(projectRoot, 'game.config.ts'),
      entryAbs: path.join(projectRoot, 'e'),
      publicDirAbs: path.join(projectRoot, 'p'),
      channelRoot: path.join(projectRoot, 'channels/vivo'),
      materialsAbs: path.join(projectRoot, 'channels/vivo/materials.ts'),
      iconAbs: path.join(projectRoot, 'channels/vivo/icon.png'),
      outDirAbs: path.join(projectRoot, 'channels/vivo/build'),
    },
    vivoMaterials: {
      packageName: 'com.example.app',
      iconPath: 'icon.png',
      versionName: '1.0.0',
      versionCode: 1,
    },
  };
}

describe('buildVivoRpk fake mode', () => {
  it('writes a fake rpk named by materials.packageName', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vivo-rpk-fake-'));
    const loaded = makeLoaded(projectRoot);
    const buildDir = loaded.paths.outDirAbs;
    await fs.mkdir(buildDir, { recursive: true });

    const previous = process.env.MINI_PACK_VIVO_FAKE_RPK;
    process.env.MINI_PACK_VIVO_FAKE_RPK = '1';
    try {
      const result = await buildVivoRpk(buildDir, loaded);
      expect(result.rpkFiles).toHaveLength(1);
      expect(result.rpkFiles[0].endsWith('com.example.app.rpk')).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.MINI_PACK_VIVO_FAKE_RPK;
      else process.env.MINI_PACK_VIVO_FAKE_RPK = previous;
      await fs.rm(projectRoot, { recursive: true, force: true });
    }
  });
});
```

如旧文件已有重叠 describe，把这块测试合并进去；保留原有的 `createVivoCliCommand` 用例。

- [ ] **Step 3: 跑测试看红**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/vivo-rpk.test.ts
```
Expected：fake-rpk 用例 FAIL（旧实现读 `config.douyin.projectName`）。

- [ ] **Step 4: 改 `rpk.ts` 的 `buildVivoRpk` 与 `MINI_PACK_VIVO_FAKE_RPK` 路径**

Edit `mini-pack/src/platforms/vivo/rpk.ts`：

`old_string`（来自 `rpk.ts:28-34`）：
```ts
export async function buildVivoRpk(projectDir: string, config: LoadedGameConfig): Promise<VivoRpkBuildResult> {
  if (process.env.MINI_PACK_VIVO_FAKE_RPK === '1') {
    const fakeRpk = path.join(projectDir, 'dist/debug', `${createVivoPackageName(config.douyin.projectName)}.rpk`);
    await fs.mkdir(path.dirname(fakeRpk), { recursive: true });
    await fs.writeFile(fakeRpk, 'fake vivo rpk for tests\n');
    return { rpkFiles: [fakeRpk] };
  }
```

`new_string`：
```ts
export async function buildVivoRpk(projectDir: string, loaded: LoadedGameConfig): Promise<VivoRpkBuildResult> {
  if (loaded.platform !== 'vivo' || !loaded.vivoMaterials) {
    throw new UserError('buildVivoRpk requires a loaded vivo config');
  }
  if (process.env.MINI_PACK_VIVO_FAKE_RPK === '1') {
    const fakeRpk = path.join(projectDir, 'dist/debug', `${loaded.vivoMaterials.packageName}.rpk`);
    await fs.mkdir(path.dirname(fakeRpk), { recursive: true });
    await fs.writeFile(fakeRpk, 'fake vivo rpk for tests\n');
    return { rpkFiles: [fakeRpk] };
  }
```

文件顶部 import 中可移除 `import { createVivoPackageName } from './template.js';`（如该文件再没用到）。

- [ ] **Step 5: 跑 rpk 测试看绿**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/vivo-rpk.test.ts
```
Expected：所有用例 PASS。

- [ ] **Step 6: Commit 提案**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  mini-pack/src/platforms/vivo/rpk.ts \
  mini-pack/tests/unit/vivo-rpk.test.ts
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "refactor(mini-pack/vivo): use materials.packageName for rpk filename"
```

---

## Task 7: douyin template + builder 接通 materials

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/platforms/douyin/template.ts`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/platforms/douyin/index.ts`
- Test: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/unit/douyin-template.test.ts`（新建）

**Why this task:** 让 douyin 的 `createGameJson / createProjectConfigJson / renderDouyinGameJs` 改读 `materials`；builder 不复制 icon（按 spec 决定）。

- [ ] **Step 1: 写 douyin template 单测**

新建 `mini-pack/tests/unit/douyin-template.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  createGameJson,
  createProjectConfigJson,
  renderDouyinGameJs,
} from '../../src/platforms/douyin/template.js';
import type { LoadedGameConfig } from '../../src/shared/types.js';

function makeLoaded(): LoadedGameConfig {
  return {
    game: {
      title: '共联防线软件',
      entry: 'game/src/main.ts',
      publicDir: 'game/public-pack',
      orientation: 'portrait',
      canvas: { width: 750, height: 1334 },
    },
    platform: 'douyin',
    materials: {
      appid: 'tt-real-appid',
      projectName: 'gonglian-fangxian',
      rewardedAdUnitId: 'tt-rwd-001',
      iconPath: 'icon.png',
    },
    projectRoot: '/tmp/x',
    paths: {
      configFileAbs: '/tmp/x/game.config.ts',
      entryAbs: '/tmp/x/game/src/main.ts',
      publicDirAbs: '/tmp/x/game/public-pack',
      channelRoot: '/tmp/x/channels/douyin',
      materialsAbs: '/tmp/x/channels/douyin/materials.ts',
      iconAbs: '/tmp/x/channels/douyin/icon.png',
      outDirAbs: '/tmp/x/channels/douyin/build',
    },
    douyinMaterials: {
      appid: 'tt-real-appid',
      projectName: 'gonglian-fangxian',
      rewardedAdUnitId: 'tt-rwd-001',
      iconPath: 'icon.png',
    },
  };
}

describe('createGameJson', () => {
  it('uses game.orientation', () => {
    const json = createGameJson(makeLoaded());
    expect(json.deviceOrientation).toBe('portrait');
    expect(json.showStatusBar).toBe(false);
  });
});

describe('createProjectConfigJson', () => {
  it('uses materials.appid and materials.projectName', () => {
    const json = createProjectConfigJson(makeLoaded());
    expect(json.appid).toBe('tt-real-appid');
    expect(json.projectname).toBe('gonglian-fangxian');
  });
});

describe('renderDouyinGameJs', () => {
  it('embeds materials.rewardedAdUnitId via JSON.stringify', () => {
    const js = renderDouyinGameJs('var __MiniPackGameBundle = { createGame: () => ({ start(){} }) };', makeLoaded());
    expect(js).toContain('var rewardedAdUnitId = "tt-rwd-001";');
  });

  it('embeds empty string when materials.rewardedAdUnitId missing', () => {
    const loaded = makeLoaded();
    delete (loaded.douyinMaterials as { rewardedAdUnitId?: string }).rewardedAdUnitId;
    delete (loaded.materials as { rewardedAdUnitId?: string }).rewardedAdUnitId;
    const js = renderDouyinGameJs('var __MiniPackGameBundle = { createGame: () => ({ start(){} }) };', loaded);
    expect(js).toContain('var rewardedAdUnitId = "";');
  });
});
```

- [ ] **Step 2: 跑测试看红**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/douyin-template.test.ts
```
Expected：FAIL（旧 createGameJson/createProjectConfigJson 读 `config.douyin`，签名为 `LoadedGameConfig` 但字段路径不存在）。

- [ ] **Step 3: 改造 `mini-pack/src/platforms/douyin/template.ts`**

只改顶部 3 个函数，文件其余 IIFE 内容（`renderDouyinGameJs` 内嵌 JS）保持不变。

Edit 1（`createGameJson`）：

`old_string`：
```ts
export function createGameJson(config: LoadedGameConfig): { deviceOrientation: 'portrait' | 'landscape'; showStatusBar: false } {
  return {
    deviceOrientation: config.orientation,
    showStatusBar: false,
  };
}
```

`new_string`：
```ts
export function createGameJson(loaded: LoadedGameConfig): { deviceOrientation: 'portrait' | 'landscape'; showStatusBar: false } {
  return {
    deviceOrientation: loaded.game.orientation,
    showStatusBar: false,
  };
}
```

Edit 2（`createProjectConfigJson`）：

`old_string`：
```ts
export function createProjectConfigJson(config: LoadedGameConfig): {
  appid: string;
  projectname: string;
  setting: { es6: true };
  condition: Record<string, never>;
} {
  return {
    appid: config.douyin.appid,
    projectname: config.douyin.projectName,
    setting: {
      es6: true,
    },
    condition: {},
  };
}
```

`new_string`：
```ts
export function createProjectConfigJson(loaded: LoadedGameConfig): {
  appid: string;
  projectname: string;
  setting: { es6: true };
  condition: Record<string, never>;
} {
  if (loaded.platform !== 'douyin' || !loaded.douyinMaterials) {
    throw new Error('createProjectConfigJson requires a loaded douyin config');
  }
  return {
    appid: loaded.douyinMaterials.appid,
    projectname: loaded.douyinMaterials.projectName,
    setting: {
      es6: true,
    },
    condition: {},
  };
}
```

Edit 3（`renderDouyinGameJs` 仅顶部变量行）：

`old_string`：
```ts
export function renderDouyinGameJs(bundleCode: string, config: LoadedGameConfig): string {
  const rewardedAdUnitId = JSON.stringify(config.douyin.rewardedAdUnitId ?? '');
```

`new_string`：
```ts
export function renderDouyinGameJs(bundleCode: string, loaded: LoadedGameConfig): string {
  if (loaded.platform !== 'douyin' || !loaded.douyinMaterials) {
    throw new Error('renderDouyinGameJs requires a loaded douyin config');
  }
  const rewardedAdUnitId = JSON.stringify(loaded.douyinMaterials.rewardedAdUnitId ?? '');
```

文件其余部分完全保留。

- [ ] **Step 4: 改造 `mini-pack/src/platforms/douyin/index.ts`**

完整覆写：

```ts
import fs from 'fs-extra';
import path from 'node:path';

import { copyAssets } from '../../core/assets.js';
import { bundleGameEntry } from '../../core/bundle.js';
import { createBuildReport, writeBuildReport } from '../../core/report.js';
import { UserError } from '../../shared/errors.js';
import type { BuildReport, LoadedGameConfig } from '../../shared/types.js';
import type { PlatformBuilder } from '../index.js';
import { createGameJson, createProjectConfigJson, renderDouyinGameJs } from './template.js';

export const douyinPlatformBuilder: PlatformBuilder = {
  name: 'douyin',

  async build(loaded: LoadedGameConfig): Promise<BuildReport> {
    if (loaded.platform !== 'douyin') {
      throw new UserError(`Douyin builder cannot build platform: ${loaded.platform}`);
    }

    const outDir = loaded.paths.outDirAbs;
    await fs.remove(outDir);
    await fs.ensureDir(outDir);

    await fs.writeJson(path.join(outDir, 'game.json'), createGameJson(loaded), { spaces: 2 });
    await fs.writeJson(path.join(outDir, 'project.config.json'), createProjectConfigJson(loaded), { spaces: 2 });

    const tempDir = path.join(outDir, '.mini-pack');
    const tempBundle = path.join(tempDir, 'game.bundle.js');
    await bundleGameEntry({
      entryAbs: loaded.paths.entryAbs,
      outfile: tempBundle,
    });

    const bundleCode = await fs.readFile(tempBundle, 'utf8');
    const finalGameJs = renderDouyinGameJs(bundleCode, loaded);
    const gameJsPath = path.join(outDir, 'game.js');
    await fs.writeFile(gameJsPath, finalGameJs);
    await fs.remove(tempDir);

    const assetStats = await copyAssets({
      sourceDir: loaded.paths.publicDirAbs,
      destinationDir: path.join(outDir, 'assets'),
    });
    const bundleStats = await fs.stat(gameJsPath);

    const reportOutDir = path.relative(loaded.projectRoot, outDir).split(path.sep).join('/');

    const report = createBuildReport({
      platform: 'douyin',
      title: loaded.game.title,
      entry: loaded.game.entry,
      publicDir: loaded.game.publicDir,
      outDir: reportOutDir,
      bundleBytes: bundleStats.size,
      assetCount: assetStats.count,
      assetBytes: assetStats.bytes,
    });

    await writeBuildReport(path.join(outDir, 'build-report.json'), report);
    return report;
  },
};
```

注意：douyin 不复制 `icon.png` 到 build 产物（spec §3.3）；preflight 仍校验存在。

- [ ] **Step 5: 跑 douyin template 测试看绿**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/douyin-template.test.ts
```
Expected：PASS。

- [ ] **Step 6: Commit 提案**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  mini-pack/src/platforms/douyin/template.ts \
  mini-pack/src/platforms/douyin/index.ts \
  mini-pack/tests/unit/douyin-template.test.ts
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "refactor(mini-pack/douyin): use materials for appid/projectName/rewardedAdUnitId"
```

---

## Task 8: preflight 命令

**Files:**
- Create: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/commands/preflight.ts`
- Create: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/unit/preflight.test.ts`
- Create: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/integration/preflight.test.ts`

**Why this task:** 引入"用户准备物料"的硬约束。一次性收集所有问题并中文报告。

- [ ] **Step 1: 写 preflight 单元测试（行为）**

新建 `mini-pack/tests/unit/preflight.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPreflight } from '../../src/commands/preflight.js';

const indexPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/index');

async function makeProject(opts: {
  withGameConfig?: boolean;
  withMaterials?: boolean;
  withIcon?: boolean;
  appid?: string;
  packageName?: string;
}): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-test-'));
  await fs.mkdir(path.join(root, 'game'), { recursive: true });
  await fs.mkdir(path.join(root, 'game/public-pack'), { recursive: true });
  await fs.writeFile(path.join(root, 'game/main.ts'), 'export function createGame(){return{start(){},pause(){},resume(){},destroy(){}};}');

  if (opts.withGameConfig !== false) {
    await fs.writeFile(
      path.join(root, 'game.config.ts'),
      `import { defineGameConfig } from '${indexPath}';
       export default defineGameConfig({
         title: 'T', entry: 'game/main.ts', publicDir: 'game/public-pack',
         orientation: 'portrait', canvas: { width: 1, height: 1 },
       });`,
    );
  }

  return root;
}

describe('runPreflight', () => {
  it('reports missing game.config.ts', async () => {
    const root = await makeProject({ withGameConfig: false });
    const result = await runPreflight({ projectRoot: root, platform: 'douyin' });
    expect(result.issues.some((i) => i.code === 'MISSING_GAME_CONFIG')).toBe(true);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('reports missing materials.ts', async () => {
    const root = await makeProject({});
    const result = await runPreflight({ projectRoot: root, platform: 'douyin' });
    expect(result.issues.some((i) => i.code === 'MISSING_MATERIALS')).toBe(true);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('reports empty appid (douyin)', async () => {
    const root = await makeProject({});
    await fs.mkdir(path.join(root, 'channels/douyin'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'channels/douyin/materials.ts'),
      `import { defineDouyinMaterials } from '${indexPath}';
       export default defineDouyinMaterials({ appid: '', projectName: 'p', iconPath: 'icon.png' });`,
    );
    await fs.writeFile(path.join(root, 'channels/douyin/icon.png'), 'fakepng');

    const result = await runPreflight({ projectRoot: root, platform: 'douyin' });
    expect(result.issues.some((i) => i.code === 'EMPTY_FIELD' && i.message.includes('appid'))).toBe(true);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('collects multiple issues at once', async () => {
    const root = await makeProject({});
    // Materials missing AND icon missing AND game.config missing entry path resolution.
    const result = await runPreflight({ projectRoot: root, platform: 'vivo' });
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('passes with valid douyin setup', async () => {
    const root = await makeProject({});
    await fs.mkdir(path.join(root, 'channels/douyin'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'channels/douyin/materials.ts'),
      `import { defineDouyinMaterials } from '${indexPath}';
       export default defineDouyinMaterials({ appid: 'tt12345', projectName: 'p', iconPath: 'icon.png' });`,
    );
    await fs.writeFile(path.join(root, 'channels/douyin/icon.png'), 'fakepng');

    const result = await runPreflight({ projectRoot: root, platform: 'douyin' });
    expect(result.issues).toEqual([]);
    await fs.rm(root, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: 跑测试看红**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/preflight.test.ts
```
Expected：FAIL（runPreflight 不存在）。

- [ ] **Step 3: 实现 `mini-pack/src/commands/preflight.ts`**

```ts
import fs from 'node:fs/promises';
import path from 'node:path';

import { loadGameConfig } from '../core/config.js';
import { isUserError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import type { PlatformName } from '../shared/types.js';

export interface PreflightOptions {
  projectRoot: string;
  platform: PlatformName;
}

export interface PreflightIssue {
  code:
    | 'MISSING_GAME_CONFIG'
    | 'INVALID_GAME_CONFIG'
    | 'MISSING_MATERIALS'
    | 'INVALID_MATERIALS'
    | 'MISSING_ICON'
    | 'MISSING_ENTRY'
    | 'MISSING_PUBLIC_DIR'
    | 'EMPTY_FIELD';
  path: string;
  message: string;
}

export interface PreflightResult {
  issues: PreflightIssue[];
}

const PLATFORM_LABEL: Record<PlatformName, string> = {
  douyin: '抖音',
  vivo: 'vivo',
};

export async function runPreflight(options: PreflightOptions): Promise<PreflightResult> {
  const issues: PreflightIssue[] = [];
  const projectRoot = path.resolve(options.projectRoot);
  const platform = options.platform;

  // 1. game.config.ts 与 materials.ts 加载
  let loaded: Awaited<ReturnType<typeof loadGameConfig>> | null = null;
  try {
    loaded = await loadGameConfig({ projectRoot, platform });
  } catch (error) {
    if (isUserError(error)) {
      const message = error.message;
      const detail = (error as { detail?: string }).detail;
      const fullMessage = detail ? `${message}\n${detail}` : message;
      const code = inferLoadErrorCode(fullMessage);
      issues.push({
        code,
        path: codeToPath(code, platform),
        message: codeToCnMessage(code, platform, fullMessage),
      });
      return { issues };
    }
    throw error;
  }

  // 2. icon 文件存在
  try {
    await fs.access(loaded.paths.iconAbs);
  } catch {
    issues.push({
      code: 'MISSING_ICON',
      path: relPath(projectRoot, loaded.paths.iconAbs),
      message: `${PLATFORM_LABEL[platform]} 渠道图标不存在：${relPath(projectRoot, loaded.paths.iconAbs)}（请放置该 PNG 文件）`,
    });
  }

  // 3. 字段非空（按平台差异）
  if (platform === 'douyin' && loaded.douyinMaterials) {
    if (!loaded.douyinMaterials.appid.trim()) {
      issues.push({
        code: 'EMPTY_FIELD',
        path: relPath(projectRoot, loaded.paths.materialsAbs),
        message: 'materials.ts 中 appid 为空（请填入抖音小游戏 appid，或设置 DOUYIN_APPID 环境变量）',
      });
    }
    if (loaded.douyinMaterials.rewardedAdUnitId !== undefined && !loaded.douyinMaterials.rewardedAdUnitId.trim()) {
      issues.push({
        code: 'EMPTY_FIELD',
        path: relPath(projectRoot, loaded.paths.materialsAbs),
        message: 'materials.ts 中 rewardedAdUnitId 设置但为空（请填入激励视频广告位 id，或删除该字段）',
      });
    }
  }
  // vivo packageName 由 schema regex 强约束，无需在此再校验非空。

  // 4. entry / publicDir 物理存在
  try {
    await fs.access(loaded.paths.entryAbs);
  } catch {
    issues.push({
      code: 'MISSING_ENTRY',
      path: loaded.game.entry,
      message: `游戏入口文件不存在：${loaded.game.entry}（请检查 game.config.ts 的 entry 字段）`,
    });
  }
  try {
    const stat = await fs.stat(loaded.paths.publicDirAbs);
    if (!stat.isDirectory()) throw new Error('not a directory');
  } catch {
    issues.push({
      code: 'MISSING_PUBLIC_DIR',
      path: loaded.game.publicDir,
      message: `公共资源目录不存在：${loaded.game.publicDir}（请检查 game.config.ts 的 publicDir 字段）`,
    });
  }

  return { issues };
}

export function reportPreflightIssues(issues: PreflightIssue[], platform: PlatformName, gameLabel: string): void {
  if (issues.length === 0) return;
  logger.error(
    `${PLATFORM_LABEL[platform]} 渠道物料未准备好，无法打包（${gameLabel}/channels/${platform}/）：`,
  );
  for (const issue of issues) {
    logger.error(`  - ${issue.message}`);
  }
  logger.error('请补齐后重试。');
}

function relPath(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/');
}

function inferLoadErrorCode(message: string): PreflightIssue['code'] {
  if (message.includes('Config file not found')) return 'MISSING_GAME_CONFIG';
  if (message.includes('Channel materials not found')) return 'MISSING_MATERIALS';
  if (message.includes('Invalid game.config.ts')) return 'INVALID_GAME_CONFIG';
  if (message.includes('Invalid channels/')) return 'INVALID_MATERIALS';
  return 'INVALID_GAME_CONFIG';
}

function codeToPath(code: PreflightIssue['code'], platform: PlatformName): string {
  switch (code) {
    case 'MISSING_GAME_CONFIG':
    case 'INVALID_GAME_CONFIG':
      return 'game.config.ts';
    case 'MISSING_MATERIALS':
    case 'INVALID_MATERIALS':
      return `channels/${platform}/materials.ts`;
    default:
      return '';
  }
}

function codeToCnMessage(code: PreflightIssue['code'], platform: PlatformName, original: string): string {
  switch (code) {
    case 'MISSING_GAME_CONFIG':
      return 'game.config.ts 不存在（请在游戏根目录创建该文件）';
    case 'INVALID_GAME_CONFIG':
      return `game.config.ts 校验失败：${original.split('\n').slice(1).join('; ')}`;
    case 'MISSING_MATERIALS':
      return `channels/${platform}/materials.ts 不存在（请创建并填写渠道物料）`;
    case 'INVALID_MATERIALS':
      return `channels/${platform}/materials.ts 校验失败：${original.split('\n').slice(1).join('; ')}`;
    default:
      return original;
  }
}
```

- [ ] **Step 4: 跑 preflight 单测看绿**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/unit/preflight.test.ts
```
Expected：PASS。

- [ ] **Step 5: 写集成测试 `tests/integration/preflight.test.ts`**

新建：

```ts
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPreflight } from '../../src/commands/preflight.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const validGame = path.join(fixturesDir, 'valid-douyin-game');

describe('runPreflight (fixture)', () => {
  it('passes for the douyin fixture', async () => {
    const result = await runPreflight({ projectRoot: validGame, platform: 'douyin' });
    expect(result.issues).toEqual([]);
  });

  it('reports missing materials for vivo on the douyin-only fixture', async () => {
    const result = await runPreflight({ projectRoot: validGame, platform: 'vivo' });
    expect(result.issues.some((i) => i.code === 'MISSING_MATERIALS')).toBe(true);
  });
});
```

- [ ] **Step 6: 跑集成测试看绿**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test -- tests/integration/preflight.test.ts
```
Expected：PASS。

- [ ] **Step 7: Commit 提案**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  mini-pack/src/commands/preflight.ts \
  mini-pack/tests/unit/preflight.test.ts \
  mini-pack/tests/integration/preflight.test.ts
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "feat(mini-pack): add preflight command for channel materials"
```

---

## Task 9: CLI 集成 + 删除 validate

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/cli.ts`
- Delete: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/commands/validate.ts`
- Delete: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/integration/validate.test.ts`
- Modify/Create: `/Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/integration/build.test.ts` 与 `repo-build.test.ts` 适配新接口

**Why this task:** 集成 preflight 进入 build 命令；删除已被 preflight 取代的 validate 命令；适配 build 集成测试。

- [ ] **Step 1: 重写 `mini-pack/src/cli.ts`**

```ts
#!/usr/bin/env node
import { Command } from 'commander';

import { runBuildCommand } from './commands/build.js';
import { reportPreflightIssues, runPreflight } from './commands/preflight.js';
import { isUserError } from './shared/errors.js';
import { logger } from './shared/logger.js';
import type { PlatformName } from './shared/types.js';

export async function main(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('mini-pack')
    .description('Package controlled Canvas games into mini game platform outputs.')
    .version('0.1.0');

  program
    .command('preflight')
    .description('Validate channel materials before building.')
    .requiredOption('--platform <platform>', 'target platform')
    .requiredOption('--project-root <path>', 'project root that contains game.config.ts')
    .action(async (options: { platform: string; projectRoot: string }) => {
      const platform = options.platform as PlatformName;
      const result = await runPreflight({ projectRoot: options.projectRoot, platform });
      if (result.issues.length > 0) {
        reportPreflightIssues(result.issues, platform, options.projectRoot);
        process.exitCode = 1;
        return;
      }
      logger.success(`Preflight passed for ${platform}.`);
    });

  program
    .command('build')
    .description('Build the platform output package.')
    .requiredOption('--platform <platform>', 'target platform')
    .requiredOption('--project-root <path>', 'project root that contains game.config.ts')
    .option('--skip-vivo-rpk', 'generate vivo project files without invoking mg-service')
    .action(async (options: { platform: string; projectRoot: string; skipVivoRpk?: boolean }) => {
      const platform = options.platform as PlatformName;
      const result = await runPreflight({ projectRoot: options.projectRoot, platform });
      if (result.issues.length > 0) {
        reportPreflightIssues(result.issues, platform, options.projectRoot);
        process.exitCode = 1;
        return;
      }
      await runBuildCommand({
        platform,
        projectRoot: options.projectRoot,
        skipVivoRpk: options.skipVivoRpk,
      });
    });

  await program.parseAsync(argv);
}

main().catch((error: unknown) => {
  if (isUserError(error)) {
    logger.error(error.message);
    process.exitCode = error.exitCode;
    return;
  }

  logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 2;
});
```

- [ ] **Step 2: 删除 validate 命令源码与测试**

```bash
rm /Users/apple/Documents/codex_projects/acos-mvp/mini-pack/src/commands/validate.ts
rm /Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/integration/validate.test.ts
```

- [ ] **Step 3: 适配 `tests/integration/build.test.ts`**

读现有内容：
```bash
cat /Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/integration/build.test.ts
```

适配规则：
- 把任何 `loadGameConfig({ ..., platform: 'douyin' })` 加上 `platform` 必传项（已是必传）。
- 把 `runBuildCommand({ ..., outDir: ... })` 调用中的 `outDir` 字段全部移除。
- 把任何对 `loaded.douyin / loaded.vivo / loaded.title / loaded.entry / loaded.outDir` 的访问替换为 `loaded.game.title`、`loaded.game.entry`、`loaded.materials.X`、`loaded.paths.outDirAbs`。
- 用 fixture `valid-douyin-game` 跑 douyin builder，断言产物含 `game.json / project.config.json / game.js / build-report.json / assets/`，**不**断言 `icon.png`（douyin 不复制）。

如改动过大，直接覆写为：

```ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBuildCommand } from '../../src/commands/build.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const sourceFixture = path.join(fixturesDir, 'valid-douyin-game');

describe('runBuildCommand (fixture)', () => {
  let workingRoot: string;

  beforeAll(async () => {
    workingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-build-'));
    await fs.cp(sourceFixture, workingRoot, { recursive: true });
  });

  afterAll(async () => {
    if (workingRoot) await fs.rm(workingRoot, { recursive: true, force: true });
  });

  it('builds the douyin package into channels/douyin/build/', async () => {
    await runBuildCommand({ platform: 'douyin', projectRoot: workingRoot });
    const outDir = path.join(workingRoot, 'channels/douyin/build');
    const entries = await fs.readdir(outDir);
    expect(entries.sort()).toEqual(
      ['assets', 'build-report.json', 'game.js', 'game.json', 'project.config.json'].sort(),
    );
  });
});
```

- [ ] **Step 4: 适配 `tests/integration/repo-build.test.ts`**

```bash
cat /Users/apple/Documents/codex_projects/acos-mvp/mini-pack/tests/integration/repo-build.test.ts
```

repo-build 一般会跑真实游戏路径。在迁移之前，gonglian-fangxian 与 difference-hunt 还是旧结构，所以这条测试会失败——**Phase 1 末尾不要求 repo-build 通过**；用 `it.skip` 暂时跳过它，并在 Phase 2/3 完成后取消 skip。

修改 `repo-build.test.ts`：找到 `describe(..., () => { it(...)` 把 `it(` 改为 `it.skip(`（仅本测试），并在 it 上方加注释 `// TODO(channels-migration): unskip after games migrated to channels/`。

- [ ] **Step 5: 跑全套 mini-pack 测试**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test
```
Expected：除 repo-build 被 skip 外，其余 PASS（schema、config、douyin/vivo template、vivo-rpk、preflight unit/integration、build integration、validate 测试已删除）。

- [ ] **Step 6: 跑 mini-pack tsc 全量检查**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack run build
```
Expected：tsc 无错误。

- [ ] **Step 7: Commit 提案**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  mini-pack/src/cli.ts \
  mini-pack/tests/integration/build.test.ts \
  mini-pack/tests/integration/repo-build.test.ts
git -C /Users/apple/Documents/codex_projects/acos-mvp rm \
  mini-pack/src/commands/validate.ts \
  mini-pack/tests/integration/validate.test.ts
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "feat(mini-pack/cli): require preflight before build, drop validate command"
```

---

## Task 10: 根脚本（build-game.mjs 简化 + 新增 preflight.mjs + package.json）

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/scripts/build-game.mjs`
- Create: `/Users/apple/Documents/codex_projects/acos-mvp/scripts/preflight.mjs`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/package.json`

**Why this task:** 根脚本对齐新 CLI 接口（去掉 outDir 派生）；提供 `pnpm preflight games/<game>` 命令。

- [ ] **Step 1: 完整覆写 `scripts/build-game.mjs`**

```js
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supportedPlatforms = new Set(['douyin', 'vivo']);
const usage = 'Usage: pnpm build games/<game-project> [--platform douyin|vivo]';
const parsed = parseArgs(process.argv.slice(2));

if (!parsed.ok) {
  console.error(parsed.message);
  console.error(usage);
  process.exit(1);
}

const { gamePath, platform } = parsed;
const gameRoot = path.resolve(repoRoot, gamePath);
const configFile = path.join(gameRoot, 'game.config.ts');

if (!fs.existsSync(configFile)) {
  console.error(`Config file not found: ${path.relative(repoRoot, configFile)}`);
  process.exit(1);
}

run('pnpm', ['--dir', 'mini-pack', 'build']);
run(process.execPath, [
  'mini-pack/dist/cli.js',
  'build',
  '--platform',
  platform,
  '--project-root',
  gamePath,
]);
if (platform === 'douyin') {
  run(process.execPath, ['scripts/smoke-douyin.mjs', gamePath]);
}

function parseArgs(args) {
  let gamePath;
  let platform = 'douyin';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--platform') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) return { ok: false, message: 'Missing value for --platform.' };
      platform = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--platform=')) {
      platform = arg.slice('--platform='.length);
      if (!platform) return { ok: false, message: 'Missing value for --platform.' };
      continue;
    }
    if (arg.startsWith('--')) return { ok: false, message: `Unexpected argument: ${arg}` };
    if (gamePath) return { ok: false, message: `Unexpected argument: ${arg}` };
    gamePath = arg;
  }

  if (!gamePath) return { ok: false, message: 'Missing game project path.' };
  if (!supportedPlatforms.has(platform)) return { ok: false, message: `Unsupported platform: ${platform}\nSupported platforms: ${[...supportedPlatforms].join(', ')}` };
  return { ok: true, gamePath, platform };
}

function run(command, args) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function resolveCommand(command, args) {
  if (process.platform === 'win32' && command === 'pnpm') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm', ...args] };
  }
  return { command, args };
}
```

- [ ] **Step 2: 新建 `scripts/preflight.mjs`**

```js
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supportedPlatforms = new Set(['douyin', 'vivo']);
const usage = 'Usage: pnpm preflight games/<game-project> [--platform douyin|vivo]';
const parsed = parseArgs(process.argv.slice(2));

if (!parsed.ok) {
  console.error(parsed.message);
  console.error(usage);
  process.exit(1);
}

const { gamePath, platform } = parsed;
const gameRoot = path.resolve(repoRoot, gamePath);
const configFile = path.join(gameRoot, 'game.config.ts');

if (!fs.existsSync(configFile)) {
  console.error(`Config file not found: ${path.relative(repoRoot, configFile)}`);
  process.exit(1);
}

run('pnpm', ['--dir', 'mini-pack', 'build']);
run(process.execPath, [
  'mini-pack/dist/cli.js',
  'preflight',
  '--platform',
  platform,
  '--project-root',
  gamePath,
]);

function parseArgs(args) {
  let gamePath;
  let platform = 'douyin';
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--platform') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) return { ok: false, message: 'Missing value for --platform.' };
      platform = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--platform=')) {
      platform = arg.slice('--platform='.length);
      if (!platform) return { ok: false, message: 'Missing value for --platform.' };
      continue;
    }
    if (arg.startsWith('--')) return { ok: false, message: `Unexpected argument: ${arg}` };
    if (gamePath) return { ok: false, message: `Unexpected argument: ${arg}` };
    gamePath = arg;
  }
  if (!gamePath) return { ok: false, message: 'Missing game project path.' };
  if (!supportedPlatforms.has(platform)) return { ok: false, message: `Unsupported platform: ${platform}` };
  return { ok: true, gamePath, platform };
}

function run(command, args) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function resolveCommand(command, args) {
  if (process.platform === 'win32' && command === 'pnpm') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm', ...args] };
  }
  return { command, args };
}
```

- [ ] **Step 3: 修改 `package.json` 添加 preflight 脚本**

Edit：

`old_string`：
```
    "build": "node scripts/build-game.mjs",
    "smoke": "node scripts/smoke-douyin.mjs",
```

`new_string`：
```
    "build": "node scripts/build-game.mjs",
    "preflight": "node scripts/preflight.mjs",
    "smoke": "node scripts/smoke-douyin.mjs",
```

- [ ] **Step 4: Commit 提案**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  scripts/build-game.mjs \
  scripts/preflight.mjs \
  package.json
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "feat(scripts): add preflight script and drop --out-dir from build script"
```

---

## Task 11: 迁移 gonglian-fangxian 到 channels 结构

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/game.config.ts`
- Create: `/Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/channels/douyin/materials.ts`
- Create: `/Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/channels/douyin/icon.png`
- Delete: `/Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/platform/`（整目录）

**Why this task:** 让主项目按新结构跑通 douyin 构建。

- [ ] **Step 1: 备份取 icon**

从 `games/gonglian-fangxian/assets/raw/art/icon/` 选一张 PNG（如有）拷贝到 `channels/douyin/icon.png`：

```bash
ls /Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/assets/raw/art/icon/
```
若有 `icon-1024.png` 之类，执行：
```bash
mkdir -p /Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/channels/douyin
cp /Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/assets/raw/art/icon/<chosen>.png \
   /Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/channels/douyin/icon.png
```
若 `icon/` 目录为空，**停下**通知用户提供一张 douyin 提审图标（PNG，建议 192x192 或更大）。

- [ ] **Step 2: 覆写 `games/gonglian-fangxian/game.config.ts`**

```ts
import { defineGameConfig } from '../../mini-pack/src/index';

export default defineGameConfig({
  title: '共联防线软件',
  entry: 'game/src/main.ts',
  publicDir: 'game/public-pack',
  orientation: 'portrait',
  canvas: { width: 750, height: 1334 },
});
```

- [ ] **Step 3: 新建 `games/gonglian-fangxian/channels/douyin/materials.ts`**

```ts
import { defineDouyinMaterials } from '../../../../mini-pack/src/index';

export default defineDouyinMaterials({
  appid: process.env.DOUYIN_APPID ?? '',
  projectName: 'gonglian-fangxian',
  rewardedAdUnitId: process.env.DOUYIN_REWARDED_AD_UNIT_ID ?? '',
  iconPath: 'icon.png',
});
```

- [ ] **Step 4: 删除旧 `platform/` 目录**

```bash
rm -r /Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/platform
```

- [ ] **Step 5: 校验状态**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp status --short games/gonglian-fangxian
```
Expected：
```
?? games/gonglian-fangxian/channels/
 D games/gonglian-fangxian/platform/douyin/materials/.gitkeep
 M games/gonglian-fangxian/game.config.ts
```

- [ ] **Step 6: Commit 提案**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  games/gonglian-fangxian/game.config.ts \
  games/gonglian-fangxian/channels
git -C /Users/apple/Documents/codex_projects/acos-mvp rm -r \
  games/gonglian-fangxian/platform
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "refactor(gonglian-fangxian): migrate channel materials to channels/douyin"
```

---

## Task 12: 验证 gonglian-fangxian 构建

**Files:** 无（仅运行命令）。

- [ ] **Step 1: 跑游戏测试（玩法不受影响）**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/game test
```
Expected：通过。

- [ ] **Step 2: 跑 preflight**

```bash
DOUYIN_APPID=tt-test DOUYIN_REWARDED_AD_UNIT_ID=tt-rwd \
  pnpm preflight games/gonglian-fangxian --platform douyin
```
Expected：`Preflight passed for douyin.`，exit 0。

> 不设 env 时应该报"appid 为空"——可单独跑一次确认错误信息正常：
> ```bash
> pnpm preflight games/gonglian-fangxian --platform douyin || echo "expected to fail"
> ```

- [ ] **Step 3: 跑 build**

```bash
DOUYIN_APPID=tt-test DOUYIN_REWARDED_AD_UNIT_ID=tt-rwd \
  pnpm build games/gonglian-fangxian --platform douyin
```
Expected：build 成功 + smoke 检查通过；产物在 `games/gonglian-fangxian/channels/douyin/build/`。

- [ ] **Step 4: 校验产物清单**

```bash
ls /Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/channels/douyin/build/
```
Expected：包含 `assets/`、`build-report.json`、`game.js`、`game.json`、`project.config.json`，**不**包含 `icon.png`。

如有任何步骤失败，停下排查根因；不为通过测试而修改 fixture 数据或 schema。

---

## Task 13: 迁移 difference-hunt 到 channels 结构

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/game.config.ts`
- Create: `/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/channels/douyin/{materials.ts,icon.png}`
- Create: `/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/channels/vivo/{materials.ts,icon.png}`
- Delete: `/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/platform/`

**Why this task:** 用户的真实痛点——difference-hunt vivo 构建跑通。

- [ ] **Step 1: 准备 icon**

从 `games/difference-hunt/game/public-pack/icon.png` 拷贝到两个渠道：
```bash
mkdir -p /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/channels/douyin
mkdir -p /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/channels/vivo
cp /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/game/public-pack/icon.png \
   /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/channels/douyin/icon.png
cp /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/game/public-pack/icon.png \
   /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/channels/vivo/icon.png
```

- [ ] **Step 2: 覆写 `games/difference-hunt/game.config.ts`**

```ts
import { defineGameConfig } from '../../mini-pack/src/index';

export default defineGameConfig({
  title: '就你眼神好',
  entry: 'game/src/main.ts',
  publicDir: 'game/public-pack',
  orientation: 'portrait',
  canvas: { width: 750, height: 1334 },
});
```

- [ ] **Step 3: 新建 `channels/douyin/materials.ts`**

```ts
import { defineDouyinMaterials } from '../../../../mini-pack/src/index';

export default defineDouyinMaterials({
  appid: process.env.DOUYIN_APPID ?? '',
  projectName: 'difference-hunt',
  rewardedAdUnitId: process.env.DOUYIN_REWARDED_AD_UNIT_ID ?? '',
  iconPath: 'icon.png',
});
```

- [ ] **Step 4: 新建 `channels/vivo/materials.ts`**

```ts
import { defineVivoMaterials } from '../../../../mini-pack/src/index';

export default defineVivoMaterials({
  packageName: 'com.jnsy.jnysh.vivominigame',
  iconPath: 'icon.png',
  versionName: '1.0.0',
  versionCode: 1,
});
```

- [ ] **Step 5: 删除旧 `platform/`**

```bash
rm -r /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/platform
```

- [ ] **Step 6: 校验 git 状态**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp status --short games/difference-hunt
```
Expected：
- `?? games/difference-hunt/channels/`
- `D games/difference-hunt/platform/douyin/materials/.gitkeep`
- `M games/difference-hunt/game.config.ts`

- [ ] **Step 7: Commit 提案**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  games/difference-hunt/game.config.ts \
  games/difference-hunt/channels
git -C /Users/apple/Documents/codex_projects/acos-mvp rm -r \
  games/difference-hunt/platform
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "refactor(difference-hunt): migrate channels for douyin and vivo"
```

---

## Task 14: 验证 difference-hunt 构建（含 vivo——用户原始痛点）

**Files:** 无（仅运行命令）。

- [ ] **Step 1: 跑游戏测试**

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/game test
```
Expected：通过。

- [ ] **Step 2: douyin preflight**

```bash
DOUYIN_APPID=tt-test DOUYIN_REWARDED_AD_UNIT_ID=tt-rwd \
  pnpm preflight games/difference-hunt --platform douyin
```
Expected：通过。

- [ ] **Step 3: douyin build**

```bash
DOUYIN_APPID=tt-test DOUYIN_REWARDED_AD_UNIT_ID=tt-rwd \
  pnpm build games/difference-hunt --platform douyin
```
Expected：通过 + smoke 通过；产物在 `games/difference-hunt/channels/douyin/build/`。

- [ ] **Step 4: vivo preflight**

```bash
pnpm preflight games/difference-hunt --platform vivo
```
Expected：通过。

- [ ] **Step 5: vivo build（带假 rpk，避免依赖 vivo CLI 真实可用）**

```bash
MINI_PACK_VIVO_FAKE_RPK=1 \
  pnpm build games/difference-hunt --platform vivo
```
Expected：通过；产物在 `games/difference-hunt/channels/vivo/build/`，包含 `src/{game.js,manifest.json,icon.png}` 与 `dist/debug/com.jnsy.jnysh.vivominigame.rpk`。

如本地有真实 vivo CLI（`mgs` 可用），可去掉 `MINI_PACK_VIVO_FAKE_RPK=1` 跑一次真实 rpk 生成。

- [ ] **Step 6: 取消 repo-build 集成测试的 skip**

修改 `mini-pack/tests/integration/repo-build.test.ts`，把 Task 9 加的 `it.skip(` 改回 `it(` 并去掉 TODO 注释。

```bash
pnpm --dir /Users/apple/Documents/codex_projects/acos-mvp/mini-pack test
```
Expected：包含 repo-build 在内全部通过。

- [ ] **Step 7: Commit 提案**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  mini-pack/tests/integration/repo-build.test.ts
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "test(mini-pack): re-enable repo-build integration after channels migration"
```

---

## Task 15: 同步 4 份 AGENT.md / AGENT_CN.md

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/AGENT.md`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/AGENT_CN.md`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/AGENT.md`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/games/gonglian-fangxian/AGENT_CN.md`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/AGENT.md`
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/AGENT_CN.md`

**Why this task:** 文档里所有出现 `platform/<platform>/materials/` 与 `builds/` / `build/` 的位置都要更新到 `channels/<platform>/`，并补充新约定（preflight 必跑、materials.ts 与 game.config.ts 拆分）。中英镜像必须同次提交。

- [ ] **Step 1: 根 AGENT.md / AGENT_CN.md 路径表述更新**

读两份文件，搜索 `platform/`、`builds/douyin`、`builds/vivo` 的出现位置。对每处替换：

中英文对照如下（在 `游戏项目结构` / `Game Project Layout` 章节）：
- 旧：`game/`、`platform/`、`assets/raw/...` 等。
- 新：在结构示意图里把 `platform/` 改为 `channels/`，并把示例子目录改为 `channels/douyin/{materials.ts,icon.png,build/}`、`channels/vivo/{materials.ts,icon.png,build/}`。

具体 Edit：在 `AGENT_CN.md` 内找"项目边界"或"项目结构"小节中包含 `platform/` 的段落，改成 `channels/<platform>/`；如有 `builds/` 改为 `channels/<platform>/build/`。

如根 AGENT.md / AGENT_CN.md 当前没有结构示意图（只有规则文字），仅做以下增量：
- 在"AI 工作约定"或独立新增"Channel Materials"小节写约定（中英镜像同次）。

具体添加（如果尚无）。在 `AGENT_CN.md` 末尾追加：

```
## 渠道物料约定

每个游戏的渠道相关配置与产物集中在 `games/<game>/channels/<platform>/`：

- `materials.ts`：渠道字段（抖音 appid/projectName/rewardedAdUnitId/iconPath；vivo packageName/iconPath/versionName/versionCode）。
- `icon.png`：渠道图标（必填；抖音用于后台提交，vivo 写入构建产物）。
- `build/`：打包产物，已 .gitignore。

`game.config.ts` 仅放游戏共性（title/entry/publicDir/orientation/canvas），不含 platform/outDir 或渠道字段。

打包前必须通过 preflight：

- `pnpm preflight games/<game> --platform <platform>`：仅校验。
- `pnpm build games/<game> --platform <platform>`：先校验后打包；缺项会一次性中文报告并退出。
```

`AGENT.md` 末尾对应英文同义：

```
## Channel Materials Convention

Each game keeps its per-channel configuration and outputs under `games/<game>/channels/<platform>/`:

- `materials.ts`: channel-specific fields (douyin appid/projectName/rewardedAdUnitId/iconPath; vivo packageName/iconPath/versionName/versionCode).
- `icon.png`: channel icon (required; uploaded to the douyin console manually, written into the vivo build).
- `build/`: build output, already .gitignored.

`game.config.ts` carries only game-wide fields (title/entry/publicDir/orientation/canvas); platform / outDir / per-channel fields no longer live here.

Builds must pass preflight first:

- `pnpm preflight games/<game> --platform <platform>`: validation only.
- `pnpm build games/<game> --platform <platform>`: validates then builds; missing items are reported in Chinese as a single batch and exit non-zero.
```

`### 完成判定` 已存在的"验证规则"指针保持不变（preflight 是命令链路的一部分，已被新 channel materials 章节覆盖）。

- [ ] **Step 2: 校验根 AGENT 镜像条目数一致**

```bash
grep -c '^## ' /Users/apple/Documents/codex_projects/acos-mvp/AGENT.md
grep -c '^## ' /Users/apple/Documents/codex_projects/acos-mvp/AGENT_CN.md
```
Expected：两值相等（原 9 + 新 1 = 10）。

- [ ] **Step 3: gonglian-fangxian AGENT.md / AGENT_CN.md**

读两份；现有内容里搜 `平台/物料` `平台路径` 等表述，更新为 `channels/<platform>/`；新增"渠道物料"小节说明本游戏当前支持 douyin（如同步 vivo 在后续启用，再补 vivo materials）。

具体改动取决于现有文本，最小增量是：把 `验证` 小节里 `pnpm --dir games/gonglian-fangxian/game build` 之外补一行：
```
- 修改渠道物料后，运行 `pnpm preflight games/gonglian-fangxian --platform douyin`。
```
中英镜像同步加。

- [ ] **Step 4: difference-hunt AGENT.md / AGENT_CN.md**

类似 Step 3，但 difference-hunt 同时支持 douyin + vivo。在"验证"小节加：
```
- 修改 vivo 渠道物料后，运行 `pnpm preflight games/difference-hunt --platform vivo` 与 `MINI_PACK_VIVO_FAKE_RPK=1 pnpm build games/difference-hunt --platform vivo`。
```
中英镜像同步加。

- [ ] **Step 5: 中英镜像与改动规模交叉校验**

```bash
for f in AGENT.md AGENT_CN.md games/gonglian-fangxian/AGENT.md games/gonglian-fangxian/AGENT_CN.md games/difference-hunt/AGENT.md games/difference-hunt/AGENT_CN.md; do
  echo "==$f=="
  git -C /Users/apple/Documents/codex_projects/acos-mvp diff --stat "$f"
done
```

Expected：
- 同一对镜像（AGENT.md vs AGENT_CN.md）的 insertions/deletions 数量大致对齐（差异 < 5 行；不要求严格相等，因中英表述长度天然不同）。
- 不应出现某一对镜像只改一份（例如英文改了 30 行，中文 0 行）——这是镜像漂移，必须停下补齐。
- 既有 8 大章节（语言规则 / 项目边界 / 小游戏产品规则 / 稳定性规则 / 广告规则 / 关卡与资源规则 / 验证规则 / Git 规则）没有被整段重写，仅在原章节内做"`platform/` → `channels/`"等局部替换。
- 用 `grep '^## '` 校验章节标题数前后一致（仅新增"渠道物料约定 / Channel Materials Convention"一节，其余不动）。

- [ ] **Step 6: Commit 提案（一次性提交全部 6 份镜像，保持同步）**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  AGENT.md AGENT_CN.md \
  games/gonglian-fangxian/AGENT.md games/gonglian-fangxian/AGENT_CN.md \
  games/difference-hunt/AGENT.md games/difference-hunt/AGENT_CN.md
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "docs(agent): document channel materials convention and preflight workflow"
```

---

## Task 16: README.md 更新

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/README.md`

**Why this task:** README 的"打包命令""项目结构""完整验证矩阵"等小节需要对齐到 channels 结构。

- [ ] **Step 1: 读 README**

```bash
sed -n '1,200p' /Users/apple/Documents/codex_projects/acos-mvp/README.md
```

- [ ] **Step 2: 更新"打包命令"小节**

找到包含 `pnpm build games/<game-project>` 的代码块，在该块后追加（用 Edit）：

`old_string`（示例，按实际文本调整）：
```
pnpm build games/<game-project>
pnpm build games/<game-project> --platform douyin
pnpm build games/<game-project> --platform vivo
```

`new_string`：
```
pnpm preflight games/<game-project> --platform douyin
pnpm preflight games/<game-project> --platform vivo
pnpm build games/<game-project>
pnpm build games/<game-project> --platform douyin
pnpm build games/<game-project> --platform vivo
```

并在该小节末尾增补一段：
```
打包产物输出到 `games/<game-project>/channels/<platform>/build/`（已 .gitignore）。
build 命令会先跑 preflight，缺渠道物料时一次性中文报告并退出。
```

- [ ] **Step 3: 更新"游戏项目结构"小节**

找到 `games/<game-project>/` 的目录示意（如有），把 `platform/` 替换为 `channels/`，并加示例：
```
channels/
  douyin/
    materials.ts
    icon.png
    build/      # .gitignore
  vivo/
    materials.ts
    icon.png
    build/      # .gitignore
```
对应去掉旧 `platform/` 子树。

- [ ] **Step 4: 更新"完整验证矩阵"小节**

把 `pnpm build games/gonglian-fangxian` 之类代码块前后增补 preflight 指令（如有 DOUYIN_APPID 等示例 env，标注）：
```
DOUYIN_APPID=tt-test pnpm preflight games/gonglian-fangxian --platform douyin
DOUYIN_APPID=tt-test pnpm build games/gonglian-fangxian
DOUYIN_APPID=tt-test pnpm build games/difference-hunt --platform douyin
MINI_PACK_VIVO_FAKE_RPK=1 pnpm build games/difference-hunt --platform vivo
```

- [ ] **Step 5: 校验 diff**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp diff README.md | head -120
```
确认仅修改打包/结构相关章节。

- [ ] **Step 6: Commit 提案**

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add README.md
git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "docs(readme): channels/<platform>/ + preflight in build flow"
```

---

## 任务完成判定

- 所有 Task 1–14 验证步骤通过。
- 文档 Task 15–16 完成且 4 份 AGENT 镜像条目数对齐。
- 整体 git 工作区干净（或仅剩用户尚未授权的 commit 暂存）。
- `pnpm build games/difference-hunt --platform vivo`（带 `MINI_PACK_VIVO_FAKE_RPK=1`）能跑通，且产物含 `channels/vivo/build/src/icon.png` 与 `channels/vivo/build/dist/debug/com.jnsy.jnysh.vivominigame.rpk`。

如执行过程中发现 spec 与实际相悖，停下来回到 brainstorming，更新 spec 后重写 plan，不要在 plan 内偷偷扩展范围。
