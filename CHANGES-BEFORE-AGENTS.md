# CHANGES-BEFORE-AGENTS.md

> 写最终 AGENTS.md 之前建议先落地的仓库改造。
> 目的：让"仓库现状"和"我们希望 agent 遵守的规则"对齐，
> 避免 AGENTS.md 沦为一长串"打补丁"的告诫。
>
> 每条任务包含：**Why**（为什么）/ **What**（改什么）/ **Verify**（怎么验证完成）。
> 优先级：P0 强烈建议、P1 建议、P2 可选。完成后在框里打勾。

---

## [P0] 1. 加一个 `pnpm bootstrap` 脚本，统一安装所有子包

- [x] 完成

实际落地方案是 pnpm workspaces（spec 里的 C 方案，非清单原文的 mjs 包装器）。
根 `package.json` 的 `bootstrap` 即 `pnpm install`。
见 `docs/superpowers/specs/2026-05-12-pnpm-workspaces-bootstrap-design.md`。

**Why**
当前每个子包独立 install、根目录没 lockfile，新人/agent 第一步就会卡。
与其在 AGENTS.md 里反复警告"不要在根跑 `pnpm install`"，不如给个正确的一键命令。

**What**
在根 `package.json` 的 `scripts` 里加：

```jsonc
{
  "scripts": {
    "bootstrap": "pnpm --dir mini-pack install && pnpm --dir games/gonglian-fangxian/game install && pnpm --dir games/difference-hunt/game install"
  }
}
```

如果将来游戏数量增多，可以替换为一个 `scripts/bootstrap.mjs`，
用 `fast-glob` 扫 `games/*/game/package.json` + `mini-pack/package.json` 后挨个 spawn。

**Verify**
- 删掉所有 `node_modules` 后跑 `pnpm bootstrap`，三个子包都装好
- `pnpm verify` 在新机器上能直接通过

---

## [P0] 2. 加最小 CI：跑 `pnpm verify`

- [x] 完成

实际落地的命令不是 `pnpm verify`，而是 typecheck + test:game + test:pack。
原因：verify 末段 build 需要 DOUYIN_APPID env，CI 上没有 .env；test:pack
里 repo-build.test.ts 已经真实跑了三平台 build，是更强的 gate。
见 `docs/superpowers/specs/2026-05-12-p0-2-ci-design.md`。

**Why**
`pnpm verify` 已经是现成的 gate（`test:game && test:pack && build gonglian-fangxian`），
但只能靠自觉本地跑。`repo-build.test.ts` 这种端到端测试不上 CI 就是浪费。

**What**
新增 `.github/workflows/ci.yml`（如果用 GitLab 改成 `.gitlab-ci.yml`，逻辑一样）：

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm bootstrap          # 依赖任务 1
      - run: pnpm --dir mini-pack typecheck
      - run: pnpm verify
```

**Verify**
- 推一个故意打破 `test:pack` 的 commit，CI 应该红
- 还原后，CI 应该绿

---

## [P1] 3. `serverBaseUrl` 支持环境变量 fallback

- [x] 完成

落地走构建时 fallback（spec 里的 A 方案，与清单原文一致）：
两个 `game.config.ts` 的 `serverBaseUrl` 改成
`process.env.SERVER_BASE_URL || '<默认>'`，mini-pack 现有的
`withProjectEnv → importDefault` 链已经把 `.env` 注入到求值期；
模板把 `loaded.game.serverBaseUrl` 拼到三平台产物。
`gonglian-fangxian/.env.example` 加了 SERVER_BASE_URL 注释；
`difference-hunt/.env.example` 不存在，属 P2/5 范围。
见 `docs/superpowers/specs/2026-05-12-p1-3-server-base-url-env-design.md`。

**Why**
当前 `game.config.ts` 里硬编码 `https://ks-games.xfyccm.cn/api`，
切预发布/生产/本地 mock 都得改源码，很容易误提交。

**What**
两步：

1. `game.config.ts` 改成：
   ```ts
   serverBaseUrl: process.env.SERVER_BASE_URL ?? 'https://ks-games.xfyccm.cn/api',
   ```
   （注意：`game.config.ts` 在构建期被 mini-pack 读取，
   所以 `process.env` 是构建时注入而不是运行时。
   如果想运行时切换，要在 `mini-pack` 把 `serverBaseUrl` 经由 esbuild 的 `define`
   注入到产物里。两种方案选一种，我倾向先做构建时。）

2. 在 `games/<game>/.env.example` 里补一行：
   ```
   # 可选，覆盖默认 serverBaseUrl
   # SERVER_BASE_URL=https://staging.example.com/api
   ```

**Verify**
- `SERVER_BASE_URL=https://test/api pnpm build games/gonglian-fangxian`
  产物里 `serverBaseUrl` 是 `https://test/api`
- 不带变量时，产物仍是默认值

---

## [P1] 4. 拆分 `verify` 与 `verify:full`

- [x] 完成

落地用 `scripts/verify-full.mjs` 自动推导矩阵（A 方案，非清单原文的
inline 长串），与现有 `scripts/*.mjs` 风格一致；当前 5 组：
gonglian-fangxian × {douyin, kuaishou} + difference-hunt ×
{douyin, kuaishou, vivo}。vivo 组默认带 `MINI_PACK_VIVO_FAKE_RPK=1`
绕过 vivo CLI 真实 rpk 打包；任一失败立即停 + 清晰报告
"<游戏> × <平台>"。`verify` 字段未动。CI 不引入 verify:full
（需要 secrets，未来再说）。
见 `docs/superpowers/specs/2026-05-12-p1-4-verify-full-design.md`。

**Why**
现在 `pnpm verify` 只 build 一个游戏 × 一个平台（gonglian-fangxian × douyin）。
等再加一两款游戏 / 平台，verify 会越来越失真，但又不能让它跑太久。
分层：本地/CI 默认快验，发版前再跑全矩阵。

**What**
在根 `package.json` 增加：

```jsonc
{
  "scripts": {
    "verify": "pnpm test:game && pnpm test:pack && pnpm build games/gonglian-fangxian",
    "verify:full": "pnpm test:game && pnpm test:pack && pnpm build games/gonglian-fangxian --platform douyin && pnpm build games/gonglian-fangxian --platform kuaishou && pnpm build games/difference-hunt --platform douyin && pnpm build games/difference-hunt --platform kuaishou && pnpm build games/difference-hunt --platform vivo"
  }
}
```

> 如果命令太长，建议改成 `scripts/verify-full.mjs`，
> 从 `games/*/channels/*` 目录自动推导矩阵，避免漏游戏/漏平台。

**Verify**
- `pnpm verify` 时长接近改动前
- `pnpm verify:full` 能跑通所有"游戏 × 平台"组合

---

## [P2] 5. 给 `difference-hunt` 也加 `.env.example`

- [ ] 完成

**Why**
目前只有 `gonglian-fangxian` 有 `.env.example`，
`difference-hunt` 没有，新接手的人/agent 无从知道它需要哪些凭据。

**What**
在 `games/difference-hunt/.env.example` 写明这个游戏会用到的全部 env key
（至少抖音 / 快手 / vivo 对应的 AppID 和广告位 ID，能想到的全列上、给空值）。

**Verify**
- 仓库里两个游戏都有 `.env.example`
- 拿一个空 `.env` 跑 `pnpm preflight games/difference-hunt --platform douyin`
  能给出"哪些变量缺失"的清晰报错（如果 preflight 还没做这件事，可以在
  `mini-pack/src/commands/preflight.ts` 里补一层 env 校验）

---

## [P2] 6. 选一个最轻量的 formatter（可选）

- [ ] 完成（或主动决定不做）

**Why**
目前无 ESLint / Prettier / Biome。MVP 阶段没关系，
但 agent 写出来的代码风格会和你手写的不一致，长期看会有摩擦。
**注意**：这条不是必须做。如果你刻意不引入，请在 AGENTS.md 里明确"刻意不引入"，
我会写进最终版避免反复被建议。

**What（如果做）**
推荐 Biome（单一二进制，零配置可用）：

```bash
pnpm --dir mini-pack add -D @biomejs/biome
pnpm --dir games/gonglian-fangxian/game add -D @biomejs/biome
# 在仓库根新建 biome.json，统一规则
```

并在根 `package.json` 加 `"format": "biome format --write ."`、`"lint": "biome lint ."`。

**Verify**
- `pnpm format` / `pnpm lint` 能在每个子包跑通
- 或者：你**明确决定不做**，告诉我，我在最终 AGENTS.md 里写一句
  "Repository intentionally has no linter/formatter; do not add one without discussion."

---

## 完成后告诉我哪些做了 / 哪些跳过

我会根据最终状态产出 AGENTS.md：

- 做了 P0/1/2 → AGENTS.md 里 Setup 段会变成 `pnpm bootstrap`，NOT-do 删掉对应警告
- 做了 P0/2 → Testing 段会加一句 "CI runs `pnpm verify` on every PR"
- 做了 P1/3 → Security 段会更新 `serverBaseUrl` 描述
- 做了 P1/4 → Commands 段会列 `verify:full`
- 做了 P2/5 → 不再单独提 `gonglian-fangxian`
- P2/6 不论做不做，都会被明确写入最终版
