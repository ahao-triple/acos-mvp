# P1/4 拆分 `verify` 与 `verify:full` — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `pnpm verify:full` 命令：跑 test:game + test:pack + 全矩阵 build（gonglian × {douyin, kuaishou} + difference-hunt × {douyin, kuaishou, vivo} = 5 组），vivo 用 fake rpk；`verify` 字段不动，发版前命令独立成层。

**Architecture:** 新增 `scripts/verify-full.mjs` 扫 `games/*/channels/<platform>/materials.ts` 推导矩阵，对每组 spawn `pnpm build games/<game> --platform <platform>`；vivo 组叠 `MINI_PACK_VIVO_FAKE_RPK=1`；任一组失败立即停、清晰报告"哪个游戏 × 哪个平台"。与已有 `scripts/build-game.mjs` 同样的 Windows-兼容 spawn 风格。

**Tech Stack:** Node ESM、`spawnSync`、`fs.readdirSync`；pnpm workspaces；不引入新依赖。

**Spec:** `docs/superpowers/specs/2026-05-12-p1-4-verify-full-design.md`

---

## File Structure

- **Create**: `scripts/verify-full.mjs`（约 50 行）
- **Modify**:
  - `package.json`（`scripts` 块加一条 `verify:full`，`verify` 不动）
  - `CHANGES-BEFORE-AGENTS.md` P1/4 复选框（独立 commit）
- **不动**：mini-pack、games/、`.github/workflows/ci.yml`、其它 `scripts/*.mjs`

---

## Task 1: 在 worktree 隔离工作目录

**Files:** 无文件改动；仅 git worktree 操作

按 superpowers 工作流，在隔离 worktree 工作让本地 main 不受影响。

- [ ] **Step 1: 确认 main 干净**

Run:
```bash
git status
```

Expected: `位于分支 main`、`无文件要提交，干净的工作区`。如果有未提交改动停下报告。

- [ ] **Step 2: 创建 worktree**

Run:
```bash
git worktree add -b p1-4-verify-full ../acos-mvp.p1-4 main
cd ../acos-mvp.p1-4
```

Expected: 输出 `Preparing worktree (new branch 'p1-4-verify-full')`，路径切到 `../acos-mvp.p1-4`。

- [ ] **Step 3: 在 worktree 内 install**

Run:
```bash
pnpm install --frozen-lockfile
```

Expected: 输出 `Lockfile is up to date, resolution step is skipped`、`Done`；无 ERROR；`pnpm-lock.yaml` 未被修改（`git status` 干净）。

> 注：worktree 默认没有 `.env`。`games/gonglian-fangxian/.env`、`games/difference-hunt/.env` 都不存在；本机的 KUAISHOU env 也不会跟过来。这是预期。

---

## Task 2: 新增 `verify-full.mjs` + 改 `package.json` + 原子 commit

**Files:**
- Create: `scripts/verify-full.mjs`
- Modify: `package.json:6-14`（在 `scripts` 块中加一行 `verify:full`）

- [ ] **Step 1: 创建 `scripts/verify-full.mjs`**

写入以下完整内容（字面量、不要改）：

```js
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = path.join(repoRoot, 'games');

const matrix = collectMatrix(gamesDir);
console.log(`[verify:full] 矩阵：${matrix.map((m) => `${m.gameName}×${m.platform}`).join(', ')}`);

runOrExit('pnpm', ['test:game'], 'test:game', process.env);
runOrExit('pnpm', ['test:pack'], 'test:pack', process.env);

for (const { gameName, platform } of matrix) {
  const env = platform === 'vivo'
    ? { ...process.env, MINI_PACK_VIVO_FAKE_RPK: '1' }
    : process.env;
  runOrExit(
    'pnpm',
    ['build', `games/${gameName}`, '--platform', platform],
    `${gameName} × ${platform}`,
    env,
  );
}

console.log(`[verify:full] 全部 ${matrix.length} 组通过`);

function collectMatrix(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const result = [];
  for (const gameName of fs.readdirSync(rootDir).sort()) {
    const channelsDir = path.join(rootDir, gameName, 'channels');
    if (!fs.existsSync(channelsDir) || !fs.statSync(channelsDir).isDirectory()) continue;
    for (const platform of fs.readdirSync(channelsDir).sort()) {
      if (fs.existsSync(path.join(channelsDir, platform, 'materials.ts'))) {
        result.push({ gameName, platform });
      }
    }
  }
  return result;
}

function runOrExit(command, args, label, env) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
  });
  if (result.status !== 0) {
    console.error(`[verify:full] ${label} 失败 (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

function resolveCommand(command, args) {
  if (process.platform === 'win32' && command === 'pnpm') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm', ...args] };
  }
  return { command, args };
}
```

要点：
- `resolveCommand` 复用 `scripts/build-game.mjs` 的 Windows 兼容写法
- `stdio: 'inherit'` 让 build 子进程的错误（含缺哪个 env）直通终端
- 矩阵按字典序排列（`gonglian-fangxian` 先、平台按字母 douyin → kuaishou → vivo）
- 不引入任何依赖；纯 node 内置模块

- [ ] **Step 2: 修改 `package.json`**

读当前 `package.json` 确认结构。当前 `scripts` 块（第 6-14 行）：

```jsonc
"scripts": {
  "bootstrap": "pnpm install",
  "build": "node scripts/build-game.mjs",
  "preflight": "node scripts/preflight.mjs",
  "smoke": "node scripts/smoke-douyin.mjs",
  "test:game": "pnpm --dir games/gonglian-fangxian/game test",
  "test:pack": "pnpm --dir mini-pack test",
  "verify": "pnpm test:game && pnpm test:pack && pnpm build games/gonglian-fangxian"
},
```

用 Edit 工具，把：

```
    "verify": "pnpm test:game && pnpm test:pack && pnpm build games/gonglian-fangxian"
  },
```

替换为：

```
    "verify": "pnpm test:game && pnpm test:pack && pnpm build games/gonglian-fangxian",
    "verify:full": "node scripts/verify-full.mjs"
  },
```

（注意：原 `"verify"` 行尾是没有逗号的最后一项；改后要加逗号、再添 `verify:full` 行。）

完成后 `scripts` 块变成：

```jsonc
"scripts": {
  "bootstrap": "pnpm install",
  "build": "node scripts/build-game.mjs",
  "preflight": "node scripts/preflight.mjs",
  "smoke": "node scripts/smoke-douyin.mjs",
  "test:game": "pnpm --dir games/gonglian-fangxian/game test",
  "test:pack": "pnpm --dir mini-pack test",
  "verify": "pnpm test:game && pnpm test:pack && pnpm build games/gonglian-fangxian",
  "verify:full": "node scripts/verify-full.mjs"
},
```

`pnpm` 块（`pnpm.overrides`）保持不变。

- [ ] **Step 3: 校验 `package.json` 是合法 JSON**

Run:
```bash
node -e "JSON.parse(require('node:fs').readFileSync('package.json','utf8')); console.log('package.json OK')"
```

Expected: 输出 `package.json OK`。如果 throw，说明 JSON 语法错——回 Step 2 检查逗号、引号。

- [ ] **Step 4: 校验 mjs 能被 node 解析**

Run:
```bash
node --check scripts/verify-full.mjs && echo "mjs syntax OK"
```

Expected: 输出 `mjs syntax OK`。任何语法错误必须先修。

- [ ] **Step 5: 看 git status 确认正好 2 个文件**

Run:
```bash
git status
```

Expected:
```
未跟踪的文件:
        scripts/verify-full.mjs
修改：     package.json
```

不应有任何其它改动。如果有，先排查。

- [ ] **Step 6: 看 git diff 复核 package.json**

Run:
```bash
git diff package.json
```

Expected: diff 显示 `"verify": "..."` 末尾加了逗号；新增 `"verify:full": "node scripts/verify-full.mjs"` 这一行；其它字段未动。

- [ ] **Step 7: Stage 并 commit**

Run:
```bash
git add scripts/verify-full.mjs package.json
git status
```

Expected: 两个文件都在 staged 列表，工作区其它干净。

然后 commit：

```bash
git commit -m "$(cat <<'EOF'
feat(scripts): 加 pnpm verify:full 跑全矩阵 build

新增 scripts/verify-full.mjs：扫 games/*/channels/<platform>/materials.ts
推导矩阵（当前 5 组：gonglian-fangxian × {douyin, kuaishou} +
difference-hunt × {douyin, kuaishou, vivo}），对每组 spawn
pnpm build；vivo 默认带 MINI_PACK_VIVO_FAKE_RPK=1 绕过 vivo CLI
真实 rpk 打包；任一失败立即停 + 打印 "[verify:full] <game> × <platform>
失败 (exit N)" 让定位清晰。

package.json 加 "verify:full" 命令，verify 字段不动。
verify:full 是开发者本地发版前命令，需配齐所有 .env，不上 CI
（与 P0/2 决定一致）。

对应 CHANGES-BEFORE-AGENTS.md 的 P1/4。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: commit 成功；`git log --oneline -1` 显示这个 commit。

---

## Task 3: Verify 全套

**Files:** 无文件改动；只跑命令观察输出与产物

- [ ] **Step 1: `verify` 字段未动**

Run:
```bash
grep -n '"verify":' package.json
```

Expected: 命中 `"verify": "pnpm test:game && pnpm test:pack && pnpm build games/gonglian-fangxian"`——逐字与改动前一致。如果不同，回 Task 2 检查。

- [ ] **Step 2: 矩阵推导输出**

Run:
```bash
pnpm verify:full 2>&1 | head -1
```

Expected: 输出 `[verify:full] 矩阵：gonglian-fangxian×douyin, gonglian-fangxian×kuaishou, difference-hunt×douyin, difference-hunt×kuaishou, difference-hunt×vivo`。

如果顺序不同（排序问题），停下报告。

> 注：`head -1` 会让 SIGPIPE 终止子进程；后续 build 不会跑完。这是预期——本 step 只测矩阵推导。

- [ ] **Step 3: 全 5 组通过**

> 背景：本 worktree 没有任何 `.env`。看 `games/*/channels/*/materials.ts` 都用 `process.env.X ?? ''` 或固定占位（kuaishou 默认 `'kwai_game_test_appid'`），schema `z.string()` 接受空串——所以即使没 env，5 组也应该都能 build 通过（产物 appid 为空、但 schema 通过、build 退出 0）。

Run:
```bash
pnpm verify:full
```

Expected: 终端能看到：
1. 第一行 `[verify:full] 矩阵：...` 列 5 组
2. `pnpm test:game` 输出 142 passed
3. `pnpm test:pack` 输出 72 passed（1 skipped）
4. 5 个 `pnpm build games/<game> --platform <platform>` 依次成功（每个最后通常输出 `🏁 Build complete` 或类似）
5. 最后一行 `[verify:full] 全部 5 组通过`
6. 进程退出码 0（用 `echo $?` 二次确认）

如果某一组失败：保留终端最后 30-50 行日志报告，特别注意是不是 `materials.ts` 校验或 build 链路本身的问题（**不**是 mjs 的 bug）。

- [ ] **Step 4: 故意失败演示——验证定位输出**

为了证明 mjs 的失败定位真的有效，临时把一个 build 弄坏。最简洁方式：临时改 `games/gonglian-fangxian/game.config.ts` 让它语法错。

Run（备份原文件后改坏）：
```bash
cp games/gonglian-fangxian/game.config.ts /tmp/p1-4-game-config-backup
echo "intentional syntax error;" >> games/gonglian-fangxian/game.config.ts
cat games/gonglian-fangxian/game.config.ts
```

Expected: cat 显示文件末尾多了一行 `intentional syntax error;`。

然后跑 verify:full：
```bash
pnpm verify:full
```

Expected:
- test:game 通过（不读 game.config.ts）
- test:pack 失败（`repo-build.test.ts` spawn build 会读坏掉的 game.config.ts）—— 这里会停
- mjs 输出最后一行 `[verify:full] test:pack 失败 (exit N)`
- 进程退出码非 0

> 注：这里失败是落在 `test:pack`，不是矩阵 build。仍然验证了 `runOrExit` 的失败定位逻辑——任何步骤的 label 都会被打印。

**立即还原 `game.config.ts`**：

```bash
cp /tmp/p1-4-game-config-backup games/gonglian-fangxian/game.config.ts
rm /tmp/p1-4-game-config-backup
git status
git diff games/gonglian-fangxian/game.config.ts
```

Expected: `git status` 干净（除了本任务前已 staged 的——但 Task 2 已 commit，所以应完全干净）；`git diff` 无输出（文件已还原）。

如果 `git status` 显示 game.config.ts 仍脏，**停下排查**，不要继续。

- [ ] **Step 5: 矩阵自动推导扩展验证**

临时建一个新 channel 目录看 mjs 是否自动纳入。

Run:
```bash
mkdir -p games/gonglian-fangxian/channels/vivo
cat > games/gonglian-fangxian/channels/vivo/materials.ts <<'EOF'
// placeholder for matrix discovery test, will be removed
export default {};
EOF
ls games/gonglian-fangxian/channels/vivo/materials.ts
```

Expected: ls 命中该文件。

Run（只看矩阵那一行）：
```bash
pnpm verify:full 2>&1 | head -1
```

Expected: 矩阵输出现在包含 `gonglian-fangxian×vivo`，共 6 组——`[verify:full] 矩阵：difference-hunt×douyin, difference-hunt×kuaishou, difference-hunt×vivo, gonglian-fangxian×douyin, gonglian-fangxian×kuaishou, gonglian-fangxian×vivo` 或类似（排序按 `gameName` 然后 `platform`）。

> 注：`head -1` 同样会 SIGPIPE 提前终止，后续 test:game/build 不跑。

**删除临时目录**：

```bash
rm -rf games/gonglian-fangxian/channels/vivo
git status
```

Expected: `git status` 干净——临时目录从未被 git tracked（直接 rm 即可）。

- [ ] **Step 6: 最终 git status 干净**

Run:
```bash
git status
```

Expected: `位于分支 p1-4-verify-full`、`无文件要提交，干净的工作区`。如果有脏文件，回到对应 Step（最常见：忘删 vivo 临时目录、忘恢复 game.config.ts）。

---

## Task 4: `CHANGES-BEFORE-AGENTS.md` P1/4 打勾（独立 commit）

**Files:**
- Modify: `CHANGES-BEFORE-AGENTS.md`（P1/4 段，目前位于约第 122-148 行）

- [ ] **Step 1: 改 P1/4 复选框**

`CHANGES-BEFORE-AGENTS.md` 当前 P1/4 段开头：

```markdown
## [P1] 4. 拆分 `verify` 与 `verify:full`

- [ ] 完成
```

把 `- [ ] 完成` 改为：

```markdown
- [x] 完成

落地用 `scripts/verify-full.mjs` 自动推导矩阵（A 方案，非清单原文的
inline 长串），与现有 `scripts/*.mjs` 风格一致；当前 5 组：
gonglian-fangxian × {douyin, kuaishou} + difference-hunt ×
{douyin, kuaishou, vivo}。vivo 组默认带 `MINI_PACK_VIVO_FAKE_RPK=1`
绕过 vivo CLI 真实 rpk 打包；任一失败立即停 + 清晰报告
"<游戏> × <平台>"。`verify` 字段未动。CI 不引入 verify:full
（需要 secrets，未来再说）。
见 `docs/superpowers/specs/2026-05-12-p1-4-verify-full-design.md`。
```

只改 P1/4 这一条，其它任务（P0/1 已勾、P0/2 已勾、P1/3 已勾、P2/5、P2/6）保持原样。

- [ ] **Step 2: Commit**

Run:
```bash
git add CHANGES-BEFORE-AGENTS.md
git status
```

Expected: 只有 `CHANGES-BEFORE-AGENTS.md` staged。

然后 commit：

```bash
git commit -m "$(cat <<'EOF'
docs: 标记 CHANGES-BEFORE-AGENTS.md P1/4 完成

scripts/verify-full.mjs 已落地（见上一 commit）。自动推导矩阵的
A 方案，与现有 scripts/*.mjs 风格一致；vivo 默认 fake rpk；verify
字段未动；CI 不引入 verify:full。

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
- merge 到本地 main，**暂不** push
- merge 到本地 main 后 push origin main（推荐，触发 CI 再绿一次）
- 在 GitHub 开 PR

参考 P0/2、P1/3 收尾：用户都选了 push origin main。

- [ ] **Step 2（controller 执行）: 合并并清理 worktree**

```bash
cd /Users/apple/Documents/codex_projects/acos-mvp
git merge --ff-only p1-4-verify-full
git log --oneline -3
```

Expected: fast-forward merge 成功，主仓库 main 含 P1/4 的两个 commit。

清理 worktree 与分支：

```bash
git worktree remove ../acos-mvp.p1-4
git branch -d p1-4-verify-full
```

Expected: worktree 与分支都消失；`git worktree list` 只剩主仓库。

- [ ] **Step 3（controller 执行，按用户决定）: push origin main**

如果用户选 push：

```bash
git push origin main
```

Expected: push 成功；GitHub Actions CI 自动触发（CI 仍只跑 typecheck + test:game + test:pack，verify:full 不在 CI 范围），全绿。

---

## Self-Review 结果

- **Spec 覆盖**：
  - "新增 `scripts/verify-full.mjs` 推导矩阵 + 5 组 build" → Task 2 Step 1（完整字面量）
  - "vivo 默认 `MINI_PACK_VIVO_FAKE_RPK=1`" → mjs 内联条件
  - "失败立即停 + `[verify:full] <game> × <platform> 失败`" → mjs 的 `runOrExit` 函数；Task 3 Step 4 演示验证
  - "package.json 加 verify:full、verify 不动" → Task 2 Step 2 + Task 3 Step 1 grep 验证
  - "矩阵自动推导" → mjs 的 `collectMatrix`；Task 3 Step 5 临时目录验证
  - "CI 不动" → 改动清单不含 `.github/workflows/`
  - Spec Verify 1-6 → Task 3 Step 1-6 + Task 4
- **Placeholder 扫描**：
  - 无 TBD/TODO；mjs 内容是完整字面量
  - commit message 用 HEREDOC 完整给出
  - Verify 步骤每一步都有 Run + Expected
- **类型/字段一致性**：
  - `[verify:full] 矩阵：...`、`[verify:full] 全部 N 组通过`、`[verify:full] <label> 失败 (exit N)` 三个输出 pattern 在 mjs 与 spec 与 plan 三处一致
  - `gonglian-fangxian × douyin` 等组名格式（用 `×` 与 spaces）在 mjs 输出与 plan Verify Expected 一致
  - 矩阵 5 组成员（gonglian × {douyin, kuaishou} + difference-hunt × {douyin, kuaishou, vivo}）在 spec 与 plan 一致
  - `MINI_PACK_VIVO_FAKE_RPK` 拼写与 P0/1 spec、repo-build.test.ts 一致
