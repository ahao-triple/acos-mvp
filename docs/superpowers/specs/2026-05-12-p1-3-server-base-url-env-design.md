# P1/3 `serverBaseUrl` 支持环境变量 fallback

> 对应 `CHANGES-BEFORE-AGENTS.md` 的 P1/3。
> 目标：切换预发布/生产/本地 mock 的后端地址不再需要改源码。

## 背景

两个游戏的 `game.config.ts` 当前都硬编码：

```ts
serverBaseUrl: 'https://ks-games.xfyccm.cn/api',
```

切换环境要直接改源码 → 容易误提交。仓库目前已经有 `.env` 注入链，但 `serverBaseUrl` 没接上去。

### 现有链路（已确认可复用）

`mini-pack/src/core/config.ts:43` 调用 `withProjectEnv(projectRoot, () => importDefault(configFileAbs))`：

1. `withProjectEnv` 先 `parseDotEnv` 读 `<projectRoot>/.env` 写入 `process.env`
2. `importDefault` 用 esbuild bundle `game.config.ts` 到临时 mjs，再 `import` 它
3. import 时执行 module 顶层 → 这一刻 `process.env.X` 已注入 → 求值得到 env 值
4. mini-pack 的 `template.ts` 在三平台都把 `loaded.game.serverBaseUrl` 字面量 JSON.stringify 拼到运行时模板 → 产物固化

**关键含义**：`game.config.ts` 里写 `process.env.SERVER_BASE_URL || '...'` 就够了，mini-pack 不需要任何改动。

## 决策

走"构建时 fallback"（A 方案，清单原文倾向）。

```ts
serverBaseUrl: process.env.SERVER_BASE_URL || 'https://ks-games.xfyccm.cn/api',
```

两个游戏的 `game.config.ts` 都改，保持一致。

### 关键选择

- **`||` 而非 `??`**：`SERVER_BASE_URL=` 留空时回退到默认 URL。`??` 会把空串穿透到产物，触发 `remoteConfig` 跳过逻辑（见 `games/gonglian-fangxian/game/src/app/remoteConfig.ts:32` 的 `if (!options.serverBaseUrl.trim())`），调试时容易踩坑。
- **两个游戏都改**：差异化对 agent 与新人更困惑；两个游戏共用同一后端这件事记在 memory 里。
- **mini-pack 不改、template 不改、schema 不改**：现有链路已支持，YAGNI。
- **保留 `serverBaseUrl: z.string().trim().optional()`**：不加 https 强校验或 trailing-slash 规整，超本次范围。
- **构建时求值，非运行时**：开发者改 `.env` 后必须 rebuild 才生效——和现有 `DOUYIN_APPID` 等 env 行为一致，不破坏现有心智。

### 不做的事

- 运行时切换（hostname 嗅探、wx.getStorage 读取）—— 超 MVP
- esbuild `--define` 通用编译期常量机制 —— 多一层无价值抽象
- `serverBaseUrl` 格式校验 —— 不在本次范围
- 给 `difference-hunt` 补 `.env.example` —— **P2/5 的范围**，本次不做

## 文件改动清单

### 修改

**`games/gonglian-fangxian/game.config.ts`**（第 9 行）

```ts
serverBaseUrl: process.env.SERVER_BASE_URL || 'https://ks-games.xfyccm.cn/api',
```

**`games/difference-hunt/game.config.ts`**（第 9 行）

同上。

**`games/gonglian-fangxian/.env.example`** 末尾追加（保留原有两行不动）：

```

# 可选：覆盖默认 serverBaseUrl（构建时注入，改完需重新 pnpm build）
# SERVER_BASE_URL=https://staging.example.com/api
```

### 不动

- `mini-pack/src/core/config.ts`、`mini-pack/src/core/schema.ts`、`mini-pack/src/shared/types.ts`
- `mini-pack/src/platforms/{douyin,kuaishou,vivo}/template.ts`
- 任何 vitest 测试文件（mini-pack 已通过 `repo-build.test.ts` 端到端验证三平台 build；本次改动不引入新分支逻辑，不加新单测）
- `games/difference-hunt/` 下任何文件（除 `game.config.ts` 那一行）
- `CHANGES-BEFORE-AGENTS.md` 在落地后单独 commit 打勾，不在本次 spec 范围里讲怎么改

## 已知风险与缓解

**风险 1：本地 `.env` 误覆盖打进发版产物**

开发者本机为了联调改了 `SERVER_BASE_URL`，忘记还原就跑 `pnpm build` 发版。

**缓解**：`.env.example` 注释明确"改完需重新 pnpm build"；commit message 同样强调；不增加运行时校验（保持 mini-pack 单一职责）。`.env` 已经在 gitignore 里，本身不会进仓库。

**风险 2：空字符串歧义**

选了 `||` ⇒ `SERVER_BASE_URL=` 与不设置等价。如果未来某天要支持"显式空"作为有效输入（让 game 跳过 remoteConfig），要切回 `??`。

**缓解**：当前 `remoteConfig.ts:32` 用 `!options.serverBaseUrl.trim()` 判空，等价于"`||` 默认值"——本次行为不变。如果将来真的要"显式空"，单独跟进。

**风险 3：`process.env.SERVER_BASE_URL` 的 TS 类型**

`@types/node` 把 `process.env.X` 标为 `string | undefined`。`||` 配合默认字符串能拿到 `string`，无需 `as string` 断言。

**缓解**：无需额外动作；mini-pack typecheck 会兜底。

## 验证步骤

按顺序在干净状态下跑通：

1. **基线**（不设置 env）：`pnpm build games/gonglian-fangxian` → 检查产物里 `serverBaseUrl` 仍是 `https://ks-games.xfyccm.cn/api`

2. **命令行 env 覆盖**：`SERVER_BASE_URL=https://test/api pnpm build games/gonglian-fangxian` → 检查产物里 `serverBaseUrl` 是 `https://test/api`

3. **`.env` 覆盖**：在 `games/gonglian-fangxian/.env` 加 `SERVER_BASE_URL=https://dotenv/api`（验完即删），跑 `pnpm build games/gonglian-fangxian` → 产物里 `serverBaseUrl` 是 `https://dotenv/api`。这一步验证 mini-pack 已有的 `.env` 注入链对 `serverBaseUrl` 也生效。

4. **空字符串回退**：`SERVER_BASE_URL= pnpm build games/gonglian-fangxian` → 产物里仍是默认 URL（验证 `||` 而非 `??`）

5. **两个游戏的 `game.config.ts` 都被加载并 build 一次**：`pnpm test:pack` 含 `repo-build.test.ts`，抽样覆盖 gonglian-fangxian × douyin、gonglian-fangxian × kuaishou、difference-hunt × vivo —— 每个 `game.config.ts` 都至少在一个平台跑过

6. **typecheck 与单测**：`pnpm --dir mini-pack typecheck && pnpm test:game` 全绿

7. **打勾**：`CHANGES-BEFORE-AGENTS.md` 里 P1/3 的复选框

任一步失败：保留现场分析。改动只有两行核心代码，回退成本极低。

## 范围之外

- P2/5 给 `difference-hunt` 加 `.env.example`：本次只动 `gonglian-fangxian/.env.example`，因为它已经存在；`difference-hunt` 不存在 `.env.example`，单独建文件属于 P2/5 范围
- `serverBaseUrl` 强格式校验（必须 https、trailing-slash 规整）：等真的踩坑再加
- esbuild `--define` 通用编译期常量注入：超 MVP
- 运行时 host 切换：超 MVP

## 完成定义

- 两个 `game.config.ts` 的 `serverBaseUrl` 都改成 `process.env.SERVER_BASE_URL || '<默认>'`
- `games/gonglian-fangxian/.env.example` 末尾有 `SERVER_BASE_URL` 注释行
- 上述 7 条 Verify 步骤全通
- `CHANGES-BEFORE-AGENTS.md` 里 P1/3 的复选框打勾
