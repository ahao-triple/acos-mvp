# P0/1 引入 pnpm workspaces 作为统一安装机制 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让仓库进入 pnpm workspaces 模式，根目录单一 lockfile，`pnpm install` 一次装好所有子包。

**Architecture:** 新增 `pnpm-workspace.yaml` 把 `mini-pack` 与 `games/*/game` 纳入 workspace；删除三个子包旧 lockfile；根目录生成统一 `pnpm-lock.yaml`；根 `package.json` 加 `"bootstrap": "pnpm install"`。改动作为单个原子 commit，便于一键 revert。

**Tech Stack:** pnpm 10、Node 22（本机）/ Node ≥20（mini-pack engines 要求）。

**Spec:** `docs/superpowers/specs/2026-05-12-pnpm-workspaces-bootstrap-design.md`

---

## File Structure

- **Create:** `pnpm-workspace.yaml`（workspace 配置）
- **Create（pnpm 自动生成）:** 根 `pnpm-lock.yaml`（统一 lockfile）
- **Modify:** `package.json:6-13`（在 `scripts` 块新增 `bootstrap`）
- **Delete:** `mini-pack/pnpm-lock.yaml`
- **Delete:** `games/gonglian-fangxian/game/pnpm-lock.yaml`
- **Delete:** `games/difference-hunt/game/pnpm-lock.yaml`
- **Modify（独立 commit）:** `CHANGES-BEFORE-AGENTS.md:14`（P0/1 复选框打勾）

---

## Task 1: 基线确认（不提交）

确认当前 `pnpm verify` 能跑通，避免把已有问题误归因为 workspaces 引入。

**Files:**
- 无改动

- [ ] **Step 1: 确认本地 pnpm 版本与 node 版本符合要求**

Run:
```bash
pnpm --version
node --version
```

Expected: pnpm `10.x` 或更高；node `v20` 或更高（mini-pack engines 要求 `>=20`）。本机已知 pnpm 10.33.0、node v22.14.0。

- [ ] **Step 2: 跑当前 verify 作为基线**

Run:
```bash
pnpm verify
```

Expected: 退出码 0；输出包含 `test:game` 通过、`test:pack` 通过、`build games/gonglian-fangxian` 完成并在 `games/gonglian-fangxian/channels/douyin/build/` 下生成产物。

如果失败：**停下，不要继续**。问题不属于本计划范围，要先单独排查（很可能是依赖未装）。可能的恢复手段：手动跑 `pnpm --dir mini-pack install`、`pnpm --dir games/gonglian-fangxian/game install` 等。基线通过后才能进入 Task 2。

---

## Task 2: 创建 workspace 配置（不提交）

**Files:**
- Create: `pnpm-workspace.yaml`

- [ ] **Step 1: 写 pnpm-workspace.yaml**

Create `pnpm-workspace.yaml` with this exact content:

```yaml
packages:
  - mini-pack
  - games/*/game
```

**关键约束：**
- 必须写 `games/*/game`，不能写 `games/*`。`games/<game>/` 目录本身没有 `package.json`，匹配上 pnpm 会报错。
- `mini-pack/stubs/puppeteer/` 不在通配里，会继续按 `file:` 依赖解析，符合预期。

- [ ] **Step 2: 验证 yaml 合法**

Run:
```bash
node -e "console.log(require('fs').readFileSync('pnpm-workspace.yaml','utf8'))"
```

Expected: 输出 yaml 内容；无错误。（不在这里跑 `pnpm install`，留到 Task 4 清理后一次性跑。）

---

## Task 3: 修改根 package.json 加 bootstrap script（不提交）

**Files:**
- Modify: `package.json:6-13`（`scripts` 块）

- [ ] **Step 1: 在 scripts 块加 bootstrap 字段**

当前 `package.json` 内容（参考）:

```jsonc
{
  "name": "acos-mvp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build-game.mjs",
    "preflight": "node scripts/preflight.mjs",
    "smoke": "node scripts/smoke-douyin.mjs",
    "test:game": "pnpm --dir games/gonglian-fangxian/game test",
    "test:pack": "pnpm --dir mini-pack test",
    "verify": "pnpm test:game && pnpm test:pack && pnpm build games/gonglian-fangxian"
  }
}
```

在 `scripts` 块**顶部**添加 `bootstrap` 字段（顶部还是底部不影响行为，置顶是为了 AGENTS.md 里能强调"先 bootstrap"）。改完后 `scripts` 块应当形如：

```jsonc
{
  "scripts": {
    "bootstrap": "pnpm install",
    "build": "node scripts/build-game.mjs",
    "preflight": "node scripts/preflight.mjs",
    "smoke": "node scripts/smoke-douyin.mjs",
    "test:game": "pnpm --dir games/gonglian-fangxian/game test",
    "test:pack": "pnpm --dir mini-pack test",
    "verify": "pnpm test:game && pnpm test:pack && pnpm build games/gonglian-fangxian"
  }
}
```

其它字段（`name` / `version` / `private` / `type`）不动。

- [ ] **Step 2: 验证 json 合法**

Run:
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).scripts.bootstrap)"
```

Expected: 输出 `pnpm install`。

---

## Task 4: 清理旧 lockfile 与 node_modules，重新安装（不提交）

这一步是 workspaces 切换的核心：让 pnpm 在干净环境下按新 workspace 配置生成统一 lockfile。

**Files:**
- Delete: `mini-pack/pnpm-lock.yaml`
- Delete: `games/gonglian-fangxian/game/pnpm-lock.yaml`
- Delete: `games/difference-hunt/game/pnpm-lock.yaml`
- Create（pnpm 自动生成）: `pnpm-lock.yaml`（根目录）

- [ ] **Step 1: 删除三个子 lockfile**

Run:
```bash
rm mini-pack/pnpm-lock.yaml \
   games/gonglian-fangxian/game/pnpm-lock.yaml \
   games/difference-hunt/game/pnpm-lock.yaml
```

Expected: 三个文件被删除，无报错。

- [ ] **Step 2: 删除所有 node_modules**

Run:
```bash
rm -rf node_modules \
       mini-pack/node_modules \
       games/gonglian-fangxian/game/node_modules \
       games/difference-hunt/game/node_modules
```

Expected: 四个目录被清空（其中根 `node_modules/` 当前可能本来就不存在，无所谓）。

- [ ] **Step 3: 在根目录跑 pnpm install**

Run:
```bash
pnpm install
```

Expected:
- 退出码 0
- 输出包含 `Done in ...s`
- 三处 workspace 被识别：`mini-pack`、`gonglian-fangxian-game`、`difference-hunt-game`
- 根目录出现新的 `pnpm-lock.yaml`
- `mini-pack/node_modules/`、`games/gonglian-fangxian/game/node_modules/`、`games/difference-hunt/game/node_modules/` 都被填充

如果有 warning 关于 peer dependency / engine 不匹配等：先记录但不阻塞，留到 Task 5 看 verify 是否真受影响。

如果有 error（比如 `EUNSUPPORTEDENGINE`、`ERR_PNPM_RECURSIVE_INSTALL_FIRST`、解析失败）：停下排查。常见原因：`pnpm-workspace.yaml` 通配写错（参考 Task 2/Step 1 的关键约束）。

- [ ] **Step 4: 确认根 lockfile 存在**

Run:
```bash
ls -la pnpm-lock.yaml
```

Expected: 文件存在，大小非零。

---

## Task 5: Verify 全流程（不提交）

按 spec 的 5 条 Verify 步骤跑完。任何一步失败：诊断；30 分钟内查不出原因则按 Task 8 回退。

**Files:**
- 无改动

- [ ] **Step 1: pnpm verify**

Run:
```bash
pnpm verify
```

Expected: 退出码 0；输出与基线（Task 1/Step 2）形态相同：test:game 通过、test:pack 通过、build gonglian-fangxian (douyin) 完成；`games/gonglian-fangxian/channels/douyin/build/` 下产物齐全。

特别要注意 `test:pack` 内含 `mini-pack/tests/integration/repo-build.test.ts`，它会真实跑三平台 build，覆盖 douyin、kuaishou、vivo 三个产物，是最强的回归 gate。

- [ ] **Step 2: kuaishou 平台 build**

Run:
```bash
pnpm build games/gonglian-fangxian --platform kuaishou
```

Expected: 退出码 0；`games/gonglian-fangxian/channels/kuaishou/build/` 下生成 `game.js`、`game.json`、`project.config.json`。

- [ ] **Step 3: vivo 平台 build（fake rpk）**

Run:
```bash
MINI_PACK_VIVO_FAKE_RPK=1 pnpm build games/difference-hunt --platform vivo
```

Expected: 退出码 0；`games/difference-hunt/channels/vivo/build/` 下生成 `package.json`、`src/manifest.json`、`src/main.js`、`dist/debug/com.jnsy.jnysh.vivominigame.rpk`（fake）。

这一步是为了验证 spec 中标识的"风险 1：vivo CLI bin 在 workspaces 下定位"——如果 vivo CLI 在 workspaces 下 bin 链接断裂，这一步会失败。

- [ ] **Step 4: 清理 verify 留下的产物**

Run:
```bash
rm -rf games/gonglian-fangxian/channels/douyin/build \
       games/gonglian-fangxian/channels/kuaishou/build \
       games/difference-hunt/channels/vivo/build
```

Expected: 三个 build 目录被清空（这些路径已在 `.gitignore` 里，不会影响 commit）。

---

## Task 6: 原子 commit

整个 workspaces 切换作为一个 commit 提交，便于一键 revert。

**Files:**
- Add: `pnpm-workspace.yaml`
- Add: `pnpm-lock.yaml`
- Modify: `package.json`
- Remove from tracking: `mini-pack/pnpm-lock.yaml`、`games/gonglian-fangxian/game/pnpm-lock.yaml`、`games/difference-hunt/game/pnpm-lock.yaml`

- [ ] **Step 1: 检查工作区状态**

Run:
```bash
git status
```

Expected:
- 新文件：`pnpm-workspace.yaml`、`pnpm-lock.yaml`
- 修改：`package.json`
- 删除：`mini-pack/pnpm-lock.yaml`、`games/gonglian-fangxian/game/pnpm-lock.yaml`、`games/difference-hunt/game/pnpm-lock.yaml`
- **不应**出现 `node_modules` 相关项（已在 `.gitignore`）
- **不应**出现 `channels/*/build` 相关项（已在 `.gitignore`）

如果出现意外文件（如 `.pnpm-store/`、`.npmrc` 等），先核对是 ignore 漏洞还是真实变更，再决定是否纳入本 commit。

- [ ] **Step 2: 分别 stage 新增/修改/删除**

Run:
```bash
git add pnpm-workspace.yaml pnpm-lock.yaml package.json
git add -u mini-pack/pnpm-lock.yaml games/gonglian-fangxian/game/pnpm-lock.yaml games/difference-hunt/game/pnpm-lock.yaml
```

第二条 `git add -u <path>` 处理删除（也可用 `git rm` 但要在删除前调用——既然文件已经删了，用 `git add -u` 把删除登记进 index 更稳）。

- [ ] **Step 3: 二次确认 staged diff**

Run:
```bash
git status
git diff --cached --stat
```

Expected:
- `pnpm-workspace.yaml`：新增
- `pnpm-lock.yaml`：新增（行数较大）
- `package.json`：修改（+1 行）
- 三个子 lockfile：删除（行数较大）

- [ ] **Step 4: 提交**

Run:
```bash
git commit -m "$(cat <<'EOF'
feat(infra): 引入 pnpm workspaces 统一安装

- 新增 pnpm-workspace.yaml，纳入 mini-pack 与 games/*/game
- 根 package.json 加 "bootstrap": "pnpm install"
- 删除三个子包旧 lockfile，根目录生成统一 pnpm-lock.yaml
- pnpm --dir <子包> 写法在 workspaces 下保持兼容，build/preflight/test:* 脚本不动

对应 CHANGES-BEFORE-AGENTS.md 的 P0/1。
Verify: pnpm verify + 三平台 build（douyin/kuaishou/vivo fake rpk）均已通过。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: 提交成功；`git status` 干净。

---

## Task 7: 在 CHANGES-BEFORE-AGENTS.md 里把 P0/1 打勾（独立 commit）

**Files:**
- Modify: `CHANGES-BEFORE-AGENTS.md:14`

- [ ] **Step 1: 把 P0/1 复选框打勾**

把 `CHANGES-BEFORE-AGENTS.md` 第 14 行：

```markdown
- [ ] 完成
```

改为：

```markdown
- [x] 完成
```

只改 P0/1 那一条，其它任务（P0/2、P1/3、P1/4、P2/5、P2/6）的复选框保持 `[ ]`。

- [ ] **Step 2: Commit**

Run:
```bash
git add CHANGES-BEFORE-AGENTS.md
git commit -m "$(cat <<'EOF'
docs: 标记 CHANGES-BEFORE-AGENTS.md P0/1 完成

pnpm workspaces 已落地（见上一 commit）。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: 提交成功。

---

## Task 8: 失败回退预案（仅在 Task 5 失败且 30 分钟内查不出原因时执行）

**Files:**
- 通过 git revert / git restore 回到 Task 1 基线

- [ ] **Step 1: 还未 commit 时（Task 5 失败、Task 6 未执行）**

Run:
```bash
git restore --staged pnpm-workspace.yaml pnpm-lock.yaml package.json 2>/dev/null || true
git restore package.json
rm -f pnpm-workspace.yaml pnpm-lock.yaml
git checkout -- mini-pack/pnpm-lock.yaml games/gonglian-fangxian/game/pnpm-lock.yaml games/difference-hunt/game/pnpm-lock.yaml
rm -rf node_modules mini-pack/node_modules games/gonglian-fangxian/game/node_modules games/difference-hunt/game/node_modules
pnpm --dir mini-pack install
pnpm --dir games/gonglian-fangxian/game install
pnpm --dir games/difference-hunt/game install
pnpm verify
```

Expected: 工作区干净；`pnpm verify` 通过；仓库回到 Task 1 基线。

- [ ] **Step 2: 已 commit 时（Task 6 已执行、后续才发现问题）**

Run:
```bash
git revert HEAD --no-edit
rm -rf node_modules mini-pack/node_modules games/gonglian-fangxian/game/node_modules games/difference-hunt/game/node_modules
pnpm --dir mini-pack install
pnpm --dir games/gonglian-fangxian/game install
pnpm --dir games/difference-hunt/game install
pnpm verify
```

Expected: `git revert` 干净；旧三 lockfile 与 package.json 恢复；`pnpm verify` 通过。

回退后停下来分析失败原因，更新 spec 后再尝试。

---

## Self-Review 结果

- **Spec 覆盖**：spec 的 5 条 Verify 全部对应到 Task 5（其中"清空 node_modules + 旧 lockfile"在 Task 4；vivo / kuaishou 单独平台 build 在 Task 5 Step 2/3）。spec 的"完成定义"5 条全部对应：`pnpm-workspace.yaml` → Task 2；旧 lockfile 删除 + 根 lockfile commit → Task 4 + Task 6；`bootstrap` script → Task 3；Verify 5 条 → Task 5；`CHANGES-BEFORE-AGENTS.md` 打勾 → Task 7。
- **Placeholder 扫描**：无 TBD/TODO；每个 Step 给了具体命令或精确 diff。
- **类型/字段一致性**：`bootstrap` 字段名在 Task 3 与 commit message（Task 6）中一致；`pnpm-workspace.yaml` 的 packages 通配在 Task 2 与 spec 一致；删除的 lockfile 路径在 Task 4 / Task 6 / Task 8 三处一致。
