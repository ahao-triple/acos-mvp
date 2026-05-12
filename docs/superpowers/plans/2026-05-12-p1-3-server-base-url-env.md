# P1/3 `serverBaseUrl` 支持环境变量 fallback — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把两个游戏 `game.config.ts` 里硬编码的 `serverBaseUrl` 改成 `process.env.SERVER_BASE_URL || '<默认>'`，让切环境不再改源码。

**Architecture:** 仅利用现有 `withProjectEnv → importDefault` 链——`mini-pack/src/core/config.ts:43` 在加载 `game.config.ts` 之前已经把 `<projectRoot>/.env` 注入 `process.env`，bundle 出来的 mjs import 时执行模块顶层，`process.env.X` 求值得到 env 值；template 已经把 `loaded.game.serverBaseUrl` 字面量拼到产物。mini-pack 不动、schema 不动、template 不动。

**Tech Stack:** TypeScript（`process.env.X` 在 `@types/node` 类型下是 `string | undefined`）；mini-pack 现有 `.env` 注入链；pnpm workspaces。

**Spec:** `docs/superpowers/specs/2026-05-12-p1-3-server-base-url-env-design.md`

---

## File Structure

- **Modify**：
  - `games/gonglian-fangxian/game.config.ts:9`（一行）
  - `games/difference-hunt/game.config.ts:9`（一行）
  - `games/gonglian-fangxian/.env.example`（末尾追加 2 行注释 + 1 空行）
  - `CHANGES-BEFORE-AGENTS.md` P1/3 复选框 + 落地注脚（独立 commit）
- **不动**：`mini-pack/` 任何代码、`mini-pack/tests/`、`games/difference-hunt/.env.example`（不存在，P2/5 范围）

---

## Task 1: 在 worktree 隔离工作目录

**Files:** 无文件改动；仅 git worktree 操作

按 superpowers 工作流，所有非平凡改动应在 worktree 隔离。本次改动虽小，但 Verify 步骤 6（临时改 `.env`）会污染本机 `.env`——worktree 隔离让本机 `.env` 不受影响。

- [ ] **Step 1: 确认 main 干净**

Run:
```bash
git status
```

Expected: `位于分支 main`、`无文件要提交，干净的工作区`。如果有未提交改动停下报告。

- [ ] **Step 2: 创建 worktree**

Run:
```bash
git worktree add -b p1-3-server-base-url ../acos-mvp.p1-3 main
cd ../acos-mvp.p1-3
```

Expected: 输出 `Preparing worktree (new branch 'p1-3-server-base-url')`，路径切到 `../acos-mvp.p1-3`。

- [ ] **Step 3: 在 worktree 内 install**

Run:
```bash
pnpm install --frozen-lockfile
```

Expected: 输出 `Lockfile is up to date, resolution step is skipped`、`Done` 或类似；没有任何 ERROR；`pnpm-lock.yaml` 未被修改（`git status` 干净）。

> 注：worktree 共享主仓库 git 数据但有独立工作区。本机 `games/gonglian-fangxian/.env` 不会自动复制到 worktree——worktree 里 `.env` 不存在。

---

## Task 2: 改三个文件 + 原子 commit

**Files:**
- Modify: `games/gonglian-fangxian/game.config.ts:9`
- Modify: `games/difference-hunt/game.config.ts:9`
- Modify: `games/gonglian-fangxian/.env.example`

- [ ] **Step 1: 改 `games/gonglian-fangxian/game.config.ts`**

把第 9 行：

```ts
  serverBaseUrl: 'https://ks-games.xfyccm.cn/api',
```

改成：

```ts
  serverBaseUrl: process.env.SERVER_BASE_URL || 'https://ks-games.xfyccm.cn/api',
```

其它行不动。完成后文件总长 11 行，内容：

```ts
import { defineGameConfig } from '../../mini-pack/src/index';

export default defineGameConfig({
  title: '共联防线软件',
  entry: 'game/src/main.ts',
  publicDir: 'game/public-pack',
  orientation: 'portrait',
  canvas: { width: 750, height: 1334 },
  serverBaseUrl: process.env.SERVER_BASE_URL || 'https://ks-games.xfyccm.cn/api',
});
```

- [ ] **Step 2: 改 `games/difference-hunt/game.config.ts`**

把第 9 行：

```ts
  serverBaseUrl: 'https://ks-games.xfyccm.cn/api',
```

改成：

```ts
  serverBaseUrl: process.env.SERVER_BASE_URL || 'https://ks-games.xfyccm.cn/api',
```

其它行不动。完成后文件总长 11 行，内容：

```ts
import { defineGameConfig } from '../../mini-pack/src/index';

export default defineGameConfig({
  title: '就你眼神好',
  entry: 'game/src/main.ts',
  publicDir: 'game/public-pack',
  orientation: 'portrait',
  canvas: { width: 750, height: 1334 },
  serverBaseUrl: process.env.SERVER_BASE_URL || 'https://ks-games.xfyccm.cn/api',
});
```

- [ ] **Step 3: 改 `games/gonglian-fangxian/.env.example`**

当前文件 2 行（看起来无尾换行）。读一下确认：

Run:
```bash
cat games/gonglian-fangxian/.env.example
wc -l games/gonglian-fangxian/.env.example
```

Expected：内容是
```
DOUYIN_APPID=
DOUYIN_REWARDED_AD_UNIT_ID=
```
行数 `2`（或 `3` 如果有尾换行——任一都接受）。

然后用 Edit 工具，把：

```
DOUYIN_REWARDED_AD_UNIT_ID=
```

替换为：

```
DOUYIN_REWARDED_AD_UNIT_ID=

# 可选：覆盖默认 serverBaseUrl（构建时注入，改完需重新 pnpm build）
# SERVER_BASE_URL=https://staging.example.com/api
```

完成后文件内容：

```
DOUYIN_APPID=
DOUYIN_REWARDED_AD_UNIT_ID=

# 可选：覆盖默认 serverBaseUrl（构建时注入，改完需重新 pnpm build）
# SERVER_BASE_URL=https://staging.example.com/api
```

- [ ] **Step 4: 看 git status，确认正好这 3 个文件**

Run:
```bash
git status
```

Expected:
```
修改：     games/difference-hunt/game.config.ts
修改：     games/gonglian-fangxian/.env.example
修改：     games/gonglian-fangxian/game.config.ts
```

不应有任何其它文件改动。如果有，先排查。

- [ ] **Step 5: 看 git diff 复核内容**

Run:
```bash
git diff
```

Expected: 每个文件的 diff 都恰好是上面 Step 1-3 描述的那一行（或 `.env.example` 末尾追加的三行）。其它内容（缩进、引号、其它字段）必须未变。如果 diff 显示有"误伤"行（例如多了空白改动），用 `git checkout -- <file>` 还原后重做。

- [ ] **Step 6: Stage 并 commit**

Run:
```bash
git add games/gonglian-fangxian/game.config.ts games/difference-hunt/game.config.ts games/gonglian-fangxian/.env.example
git status
```

Expected: 三个文件都在 staged 列表，工作区其它干净。

然后 commit：

```bash
git commit -m "$(cat <<'EOF'
feat(config): serverBaseUrl 支持 SERVER_BASE_URL env 覆盖

两个游戏 game.config.ts 改成 process.env.SERVER_BASE_URL || '<默认>'。
mini-pack 不动——现有 withProjectEnv → importDefault 链已经在
加载 game.config.ts 之前注入 .env，template 已经把
loaded.game.serverBaseUrl 拼到三平台产物。

用 || 而非 ??：SERVER_BASE_URL= 空串等价于不设置，避免空串
穿透到产物触发 remoteConfig 跳过逻辑。

games/gonglian-fangxian/.env.example 加 SERVER_BASE_URL 注释；
difference-hunt/.env.example 不存在，属 P2/5 范围。

对应 CHANGES-BEFORE-AGENTS.md 的 P1/3。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit 成功；`git log --oneline -1` 显示这个 commit。

---

## Task 3: Verify 全套

**Files:** 无文件改动；只跑命令观察产物

> **重要前置**：Verify 步骤里有"在 `games/gonglian-fangxian/.env` 加 SERVER_BASE_URL"这种临时改动。`.env` 在 `.gitignore` 里，**不能用 `git checkout`** 还原。每个 .env 改动后必须**显式删除**该行，并跑 `cat` 确认 .env 内容回到改动前。

- [ ] **Step 1: 基线 build（不带 env）**

Run:
```bash
cd ../acos-mvp.p1-3   # 确认在 worktree
pnpm build games/gonglian-fangxian
```

构建必须成功。然后检查产物里 `serverBaseUrl` 是默认值：

```bash
grep -r "ks-games.xfyccm.cn" games/gonglian-fangxian/channels/douyin/build/ | head -3
```

Expected: 至少一行命中默认 URL `https://ks-games.xfyccm.cn/api`，且没有其它 URL。如果 grep 没命中，build 没把字面量打进去——回 Task 2 检查改动。

- [ ] **Step 2: 命令行 env 覆盖**

Run:
```bash
SERVER_BASE_URL=https://test/api pnpm build games/gonglian-fangxian
grep -r "https://test/api" games/gonglian-fangxian/channels/douyin/build/ | head -3
```

Expected: grep 必须命中 `https://test/api`。再确认默认 URL **不**出现：

```bash
grep -r "ks-games.xfyccm.cn" games/gonglian-fangxian/channels/douyin/build/ | head -3
```

Expected: 无输出（命令行 env 完全覆盖了默认值）。如果默认值还在，说明 `||` 没生效或 mini-pack template 把两份都拼了——回 Task 2 / spec 检查。

- [ ] **Step 3: `.env` 覆盖（关键 verify，验完立即还原）**

先**备份** `.env`（如果存在）：

```bash
ls games/gonglian-fangxian/.env 2>/dev/null && cp games/gonglian-fangxian/.env /tmp/p1-3-env-backup || echo "no .env to backup"
```

> worktree 默认没有 .env（本机 .env 不会跟过来）。如果输出 `no .env to backup`，往下 Step 写入新文件、还原即删除。

然后写入临时 .env：

```bash
cat > games/gonglian-fangxian/.env <<'EOF'
SERVER_BASE_URL=https://dotenv/api
EOF
cat games/gonglian-fangxian/.env
```

Expected: cat 输出 `SERVER_BASE_URL=https://dotenv/api`。

然后 build（**不带**命令行 env）：

```bash
pnpm build games/gonglian-fangxian
grep -r "https://dotenv/api" games/gonglian-fangxian/channels/douyin/build/ | head -3
```

Expected: grep 必须命中 `https://dotenv/api`。这验证了 mini-pack 已有的 `withProjectEnv` 链对 `SERVER_BASE_URL` 也生效。

**立即还原 `.env`**：

```bash
# 如果原本有 backup，恢复；否则删除临时文件
if [ -f /tmp/p1-3-env-backup ]; then
  cp /tmp/p1-3-env-backup games/gonglian-fangxian/.env
  rm /tmp/p1-3-env-backup
else
  rm games/gonglian-fangxian/.env
fi
ls games/gonglian-fangxian/.env 2>/dev/null && cat games/gonglian-fangxian/.env || echo "no .env (restored)"
```

Expected: 输出 `no .env (restored)`（worktree 默认没 .env 的话）。如果原本有 backup 应该输出原内容。`git status` 必须仍干净（.env 在 gitignore，git 不应跟踪它）。

- [ ] **Step 4: 空字符串回退**

Run:
```bash
SERVER_BASE_URL= pnpm build games/gonglian-fangxian
grep -r "ks-games.xfyccm.cn" games/gonglian-fangxian/channels/douyin/build/ | head -3
```

Expected: grep 命中默认 URL `https://ks-games.xfyccm.cn/api`（验证 `||` 让空串回退）。再确认空串没穿透：

```bash
grep -r "serverBaseUrl: ''" games/gonglian-fangxian/channels/douyin/build/ | head -3
grep -r 'serverBaseUrl: ""' games/gonglian-fangxian/channels/douyin/build/ | head -3
```

Expected: 两个 grep 都无输出。

- [ ] **Step 5: 确认 `.env` 已干净，跑 typecheck + test:game + test:pack**

**强制**先看 `.env` 是不是干净的（避免 Step 3 没还原干净导致 test:pack 污染）：

```bash
ls games/gonglian-fangxian/.env 2>/dev/null && cat games/gonglian-fangxian/.env || echo "(no .env)"
```

Expected: 输出 `(no .env)` 或原始备份内容；**绝不**应该看到 `SERVER_BASE_URL=...`。如果还看到，回 Step 3 还原。

然后跑全套：

```bash
pnpm --dir mini-pack typecheck
pnpm test:game
pnpm test:pack
```

Expected:
- typecheck: 无错误退出 0
- test:game: 142 passed（gonglian-fangxian 的 vitest）
- test:pack: 72 passed（mini-pack 的 vitest，含 `repo-build.test.ts` 跑 gonglian-fangxian × douyin / kuaishou + difference-hunt × vivo 三组真实 build）

任一失败：保留日志、看是不是 .env 污染（重新跑 Step 5 开头的 `cat .env`），或 `process.env.SERVER_BASE_URL` 求值错误（回 Task 2 检查）。

- [ ] **Step 6: 最终 git status 确认 worktree 干净**

Run:
```bash
git status
```

Expected: `位于分支 p1-3-server-base-url`、`无文件要提交，干净的工作区`。Verify 过程产生的 build 产物在 `games/<game>/channels/*/build/`，已在 gitignore；`.env` 已还原；不应有任何脏文件。

如果有，停下排查（最常见原因是忘删 `.env`）。

---

## Task 4: `CHANGES-BEFORE-AGENTS.md` P1/3 打勾（独立 commit）

**Files:**
- Modify: `CHANGES-BEFORE-AGENTS.md:92`

- [ ] **Step 1: 改 P1/3 复选框**

`CHANGES-BEFORE-AGENTS.md` 当前 P1/3 段：

```markdown
## [P1] 3. `serverBaseUrl` 支持环境变量 fallback

- [ ] 完成
```

把 `- [ ] 完成` 改为：

```markdown
- [x] 完成

落地走构建时 fallback（spec 里的 A 方案，与清单原文一致）：
两个 `game.config.ts` 的 `serverBaseUrl` 改成
`process.env.SERVER_BASE_URL || '<默认>'`，mini-pack 现有的
`withProjectEnv → importDefault` 链已经把 `.env` 注入到求值期；
模板把 `loaded.game.serverBaseUrl` 拼到三平台产物。
`gonglian-fangxian/.env.example` 加了 SERVER_BASE_URL 注释；
`difference-hunt/.env.example` 不存在，属 P2/5 范围。
见 `docs/superpowers/specs/2026-05-12-p1-3-server-base-url-env-design.md`。
```

只改 P1/3 那一条，其它任务（P0/1 已勾、P0/2 已勾、P1/4、P2/5、P2/6）保持原样。

- [ ] **Step 2: Commit**

Run:
```bash
git add CHANGES-BEFORE-AGENTS.md
git commit -m "$(cat <<'EOF'
docs: 标记 CHANGES-BEFORE-AGENTS.md P1/3 完成

serverBaseUrl 已支持 SERVER_BASE_URL env 覆盖（见上一 commit）。
落地走构建时 fallback，与清单原文一致；mini-pack 无改动，靠
现有 withProjectEnv 链。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit 成功；`git log --oneline -2` 显示这条 + 上一条 feat commit。

---

## Task 5: 合并回 main 与推送（controller 与用户共同决定）

> 注：本 task 不在 implementer 范围；它需要影响主仓库与远端共享状态，由 controller 在 review 通过后与用户对齐再执行。implementer 完成 Task 1–4 后 STOP 报告。

**Files:** 无文件改动；仅 git 操作

- [ ] **Step 1（controller 执行）: 与用户对齐合并策略**

可选：
- merge 到本地 main，**暂不** push（仅本地保留）
- merge 到本地 main 后 push origin main（推荐——CI 已在跑，触发一次完整流程作为额外回归 gate）
- 在 GitHub 开 PR（更正式，但本仓库目前 push to main 流程已建立）

参考 P0/2 收尾：用户当时选了 push origin main。

- [ ] **Step 2（controller 执行）: 合并并清理 worktree**

合并：

```bash
cd /Users/apple/Documents/codex_projects/acos-mvp   # 切回主仓库
git merge --ff-only p1-3-server-base-url
git log --oneline -3
```

Expected: fast-forward merge 成功，主仓库 main 包含 P1/3 的两个 commit。

清理 worktree 与分支：

```bash
git worktree remove ../acos-mvp.p1-3
git branch -d p1-3-server-base-url
```

Expected: worktree 与分支都消失；`git worktree list` 只剩主仓库。

- [ ] **Step 3（controller 执行，按用户决定）: push origin main**

如果用户选 push：

```bash
git push origin main
```

Expected: push 成功；GitHub Actions 自动触发 CI workflow，按 P0/2 链路跑 typecheck + test:game + test:pack 全绿。

如果用户选不 push：跳过此步。

---

## Self-Review 结果

- **Spec 覆盖**：
  - "两个 `game.config.ts` 都改 `process.env.SERVER_BASE_URL || '<默认>'`" → Task 2 Step 1 + Step 2
  - "`gonglian-fangxian/.env.example` 加 SERVER_BASE_URL 注释" → Task 2 Step 3
  - "mini-pack 不动、schema 不动、template 不动" → 不在改动清单里（即"什么都不做"）；Task 2 Step 4 `git status` 检查正好 3 个文件
  - "构建时 fallback、`||` 而非 `??`" → Task 2 Step 1/2 写死 `||`；Task 3 Step 4 验证空串行为
  - "`difference-hunt/.env.example` 不补（P2/5 范围）" → 不在改动清单；Task 2 commit message 显式声明
  - Verify 7 条 → Task 3 Step 1–6 + Task 4（打勾）
  - "构建时求值、改 .env 需 rebuild" → Task 2 Step 3 `.env.example` 注释明确
- **Placeholder 扫描**：无 TBD/TODO；每条代码块都是字面量；commit message 完整 HEREDOC
- **类型/字段一致性**：
  - `serverBaseUrl: process.env.SERVER_BASE_URL || 'https://ks-games.xfyccm.cn/api'` 在两个 game.config.ts、spec、plan 内逐字一致
  - 默认 URL `https://ks-games.xfyccm.cn/api` 在所有引用处一致
  - 风险（`.env` 还原）在 Task 3 Step 3 已具体化为 backup/restore 流程，避免 P0/1 期间踩过的"controller 改 .env 触发 test 污染"陷阱
- **范围 sanity**：plan 是单一变更，subagent-driven-development 一次 implementer 就够（不像 P0/1 那样分组）
