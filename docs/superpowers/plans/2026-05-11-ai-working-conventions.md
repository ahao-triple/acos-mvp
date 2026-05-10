# AI 工作约定 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AI 在本仓库工作时需要遵守的额外行为规范、specs/plans 放置规则与命名约定写入根 `AGENT.md / AGENT_CN.md`，并补齐 `games/difference-hunt/docs/superpowers/` 目录骨架。

**Architecture:** 单一权威源原则——AI 工作约定与既有规则合在 `AGENT.md / AGENT_CN.md` 中，新增章节放在 Git 章节之后。镜像同步：中英两份 AGENT 文件必须在同一次提交中同步更新。本计划仅修改文档与新建空目录占位文件，不动代码、配置、资源。

**Tech Stack:** Markdown 文档；`.gitkeep` 占位文件；纯 Git/文件系统操作。

**特别约定（与默认 writing-plans 模板的偏差）：**
- 本仓库现有 AI 工作约定要求 "AI 不自主 commit"。计划中所有 commit 步骤均改为"由用户授权后统一提交"，AI 不自行执行 `git commit`。
- 文档/目录改动不适用 TDD，验证手段改为：`git diff` 比对、`ls` 校验目录、人工对照中英镜像条目。
- 改动量小且耦合（中英镜像必须同次提交），不拆分多次提交；最终一次提交即可。

**Spec 引用：** `docs/superpowers/specs/2026-05-11-ai-working-conventions-design.md`

---

## File Structure

本计划改动如下文件（全部用绝对路径）：

- 新建：`/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/specs/.gitkeep`
- 新建：`/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/plans/.gitkeep`
- 修改：`/Users/apple/Documents/codex_projects/acos-mvp/AGENT_CN.md`（末尾追加 "AI 工作约定" 章节）
- 修改：`/Users/apple/Documents/codex_projects/acos-mvp/AGENT.md`（末尾追加 "AI Working Conventions" 章节）
- 已存在（前序产物，无需再改）：`/Users/apple/Documents/codex_projects/acos-mvp/docs/superpowers/specs/2026-05-11-ai-working-conventions-design.md`
- 已存在（本文件）：`/Users/apple/Documents/codex_projects/acos-mvp/docs/superpowers/plans/2026-05-11-ai-working-conventions.md`

---

## Task 1: 补 difference-hunt 的 docs/superpowers 目录骨架

**Files:**
- Create: `/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/specs/.gitkeep`
- Create: `/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/plans/.gitkeep`

**Why this task:** 当前 `games/difference-hunt/` 下没有 `docs/superpowers/`；按 spec 的影响范围拆分规则，`difference-hunt` 也需要本地 specs/plans 落地能力。先把骨架补齐，写 AGENT.md 章节时即可直接引用。

- [ ] **Step 1: 校验起点状态**

Run:
```bash
ls /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs 2>&1
```
Expected: `ls: ...: No such file or directory`（说明 `docs/` 还不存在），或 `docs/` 存在但下面没有 `superpowers/`。两种情况都视为起点正确。

- [ ] **Step 2: 创建 specs/.gitkeep（用 Write 工具，不要用 mkdir/touch；Write 会自动创建父目录）**

文件路径：`/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/specs/.gitkeep`

文件内容：空文件（不写任何字节）。

- [ ] **Step 3: 创建 plans/.gitkeep**

文件路径：`/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/plans/.gitkeep`

文件内容：空文件。

- [ ] **Step 4: 校验目录已建好**

Run:
```bash
ls /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/specs /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/plans
```
Expected:
```
/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/plans:
.gitkeep

/Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/specs:
.gitkeep
```

- [ ] **Step 5: 校验 git 已识别新文件**

Run:
```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp status --short games/difference-hunt
```
Expected：输出包含两行 `?? games/difference-hunt/docs/superpowers/{plans,specs}/.gitkeep`。

---

## Task 2: 在 AGENT_CN.md 末尾追加 "AI 工作约定" 章节（中文先行）

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/AGENT_CN.md`（末尾追加，不动既有 6 个章节）

**Why this task:** 用户优先语言是中文，先写中文版避免后续翻译漂移。AGENT_CN.md 当前以 "## Git 规则" 章节结尾（最后一行：`- 大规模删除旧项目之前，必须确认没有活动引用。`）；新章节追加在文件末尾、紧接 Git 规则之后。

- [ ] **Step 1: 确认 AGENT_CN.md 末尾内容**

Run:
```bash
tail -5 /Users/apple/Documents/codex_projects/acos-mvp/AGENT_CN.md
```
Expected：最后几行包含：
```
- 不回退无关改动。
- 不提交 `node_modules/`、`dist/`、`build/`、`builds/`、本地工具配置或临时目录。
- 大规模删除旧项目之前，必须确认没有活动引用。
```

- [ ] **Step 2: 用 Edit 工具在 Git 规则章节最后一项之后追加新章节**

Edit 操作（同一文件）：

`old_string`（取自当前文件末尾，确保唯一）：
```
- 大规模删除旧项目之前，必须确认没有活动引用。
```

`new_string`（保留原行，之后新增空行 + 新章节，章节顶用 `## AI 工作约定`，五块小节）：
```
- 大规模删除旧项目之前，必须确认没有活动引用。

## AI 工作约定

本章节集中说明 AI 在本仓库工作时需要遵守的额外行为规范，与上文 `语言规则`、`验证规则`、`Git 规则` 等章节中已存在的条目不重复表述，必要时归位重申。

### 改动前的准备

- 必先读根 `AGENT.md`，再读对应 `games/<game>/AGENT.md`；规则冲突时以更靠近改动目录的为准。
- 改动前跑 `git status --short` 查看工作区，避免覆盖未提交改动。详见 `Git 规则`。

### 不可逆操作必须用户授权

- AI 不自主执行：`git push`、合并 PR、`git push --force` / `--force-with-lease`、`git reset --hard`、删除分支、`git rebase` 改写已发布历史。
- `git commit` 仅在用户明确要求时执行；钩子失败时新建提交，不使用 `--amend`。
- `--no-verify`、`--no-gpg-sign` 等绕过钩子或签名的开关只在用户明确要求时使用。

### 完成判定（不表演式完成）

- 在跑过对应验证之前，不得声称"完成 / 修复 / 通过"。仅跑 `tsc --noEmit` 不算验证。
- 验证范围依据上文 `验证规则`：玩法 / 存档 / 广告 → 对应游戏 `pnpm test`；资源目录 / Vite 配置 / 平台配置 → 加跑对应游戏 `pnpm build`；改 `mini-pack` → 加跑 `pnpm --dir mini-pack test` 与至少一个真实游戏的平台包。
- 无法本地验证的项（如 UI 浏览器预览不可达、真机不可达）必须显式说明"未验证项"，不得隐去。

### 文档与镜像

- 修改任意 `AGENT.md` 必须在同次提交同步修改同目录 `AGENT_CN.md`，反之亦然。详见 `语言规则`。

### specs / plans 放置与命名

- 跨游戏 / `mini-pack` / 平台接入 / 仓库级规则 → 根 `docs/superpowers/{specs,plans}/`。
- 单游戏的玩法 / 关卡 / UI / 存档 / 资源 / 游戏内平台桥接 → `games/<game>/docs/superpowers/{specs,plans}/`。
- 同时跨多个游戏的改动 → 根。
- 命名：`specs/YYYY-MM-DD-<主题>-design.md`、`plans/YYYY-MM-DD-<主题>.md`；`<主题>` 用英文连字符短串。
- `specs/plans` 默认使用规范简体中文，不需要中英镜像。
```

- [ ] **Step 3: 校验改动**

Run:
```bash
tail -45 /Users/apple/Documents/codex_projects/acos-mvp/AGENT_CN.md
```
Expected：输出包含 `## AI 工作约定` 与五个 `### ...` 小节标题，且最后一行是 ``- `specs/plans` 默认使用规范简体中文，不需要中英镜像。``

- [ ] **Step 4: 校验既有章节未被破坏**

先确认起点章节数：
```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp show HEAD:AGENT_CN.md | grep -c '^## '
```
Expected：`8`（现有章节：`语言规则`、`项目边界`、`小游戏产品规则`、`稳定性规则`、`广告规则`、`关卡与资源规则`、`验证规则`、`Git 规则`）。

再确认改后章节数：
```bash
grep -c '^## ' /Users/apple/Documents/codex_projects/acos-mvp/AGENT_CN.md
```
Expected：`9`（8 + 新增 `AI 工作约定` = 9）。

如果起点不是 8 或改后不是 9，停下来检查是否误删/误改既有章节。

---

## Task 3: 在 AGENT.md 末尾追加 "AI Working Conventions" 章节（英文镜像）

**Files:**
- Modify: `/Users/apple/Documents/codex_projects/acos-mvp/AGENT.md`（末尾追加，与 Task 2 同次提交）

**Why this task:** 镜像同步要求中英两份在同次提交中同步更新。Task 2 完成后立即追加英文章节，确保条目数和顺序与中文版完全对齐。

- [ ] **Step 1: 确认 AGENT.md 末尾内容**

Run:
```bash
tail -5 /Users/apple/Documents/codex_projects/acos-mvp/AGENT.md
```
Expected：最后几行包含：
```
- Do not revert unrelated changes.
- Do not commit `node_modules/`, `dist/`, `build/`, `builds/`, local tool config, or temporary directories.
- Before deleting a legacy project at scale, confirm that no active references remain.
```

- [ ] **Step 2: 用 Edit 工具在 Git Rules 章节最后一项之后追加新章节**

Edit 操作（同一文件）：

`old_string`：
```
- Before deleting a legacy project at scale, confirm that no active references remain.
```

`new_string`：
```
- Before deleting a legacy project at scale, confirm that no active references remain.

## AI Working Conventions

This section collects the additional rules an AI must follow when working in this repository. Items already covered in `Language Rules`, `Verification Rules`, or `Git Rules` are restated here only as pointers — the canonical wording stays in those sections.

### Preparation Before Edits

- Read the root `AGENT.md` first, then the relevant `games/<game>/AGENT.md`. When rules conflict, the file closer to the working directory wins.
- Run `git status --short` before editing, to avoid overwriting uncommitted work. See `Git Rules`.

### Irreversible Operations Require User Approval

- The AI must not run unprompted: `git push`, PR merges, `git push --force` / `--force-with-lease`, `git reset --hard`, branch deletion, or `git rebase` that rewrites published history.
- `git commit` only runs when the user explicitly asks for it. If a hook fails, create a new commit instead of using `--amend`.
- Flags that bypass hooks or signatures (`--no-verify`, `--no-gpg-sign`, etc.) are only used when the user explicitly requests them.

### Completion Bar (No Performative "Done")

- Do not claim "done / fixed / passing" before the corresponding verification has actually run. Running `tsc --noEmit` alone does not count as verification.
- Verification scope follows `Verification Rules`: gameplay / saves / ads → that game's `pnpm test`; resource directories / Vite config / platform config → also run that game's `pnpm build`; `mini-pack` changes → also run `pnpm --dir mini-pack test` and at least one real game's platform package.
- When something cannot be verified locally (UI browser preview unreachable, device unreachable, etc.), explicitly call it out as an unverified item — do not hide it.

### Documentation And Mirroring

- Any change to an `AGENT.md` must be paired in the same commit with the matching change to its sibling `AGENT_CN.md`, and vice versa. See `Language Rules`.

### specs / plans Location And Naming

- Cross-game work, `mini-pack`, platform integration, and repo-level rules → root `docs/superpowers/{specs,plans}/`.
- Gameplay / level / UI / save / asset / in-game platform bridge work for a single game → `games/<game>/docs/superpowers/{specs,plans}/`.
- A single change that spans multiple games → root.
- Naming: `specs/YYYY-MM-DD-<topic>-design.md`, `plans/YYYY-MM-DD-<topic>.md`; `<topic>` uses an English hyphen-joined slug.
- `specs/plans` are written in standard Simplified Chinese by default and do not need an English mirror.
```

- [ ] **Step 3: 校验改动**

Run:
```bash
tail -50 /Users/apple/Documents/codex_projects/acos-mvp/AGENT.md
```
Expected：输出包含 `## AI Working Conventions` 与五个 `### ...` 小节标题，最后一行是 ``- `specs/plans` are written in standard Simplified Chinese by default and do not need an English mirror.``

- [ ] **Step 4: 中英镜像比对（条目数）**

Run:
```bash
grep -c '^### ' /Users/apple/Documents/codex_projects/acos-mvp/AGENT.md /Users/apple/Documents/codex_projects/acos-mvp/AGENT_CN.md
```
Expected：两个文件都新增 5 个 `### ` 子标题。两个文件 `### ` 总数应相等（即 AGENT.md 总数 == AGENT_CN.md 总数）。

如果不相等，停下来人工对比中英镜像。

- [ ] **Step 5: 中英镜像比对（顶级章节数）**

Run:
```bash
grep -c '^## ' /Users/apple/Documents/codex_projects/acos-mvp/AGENT.md /Users/apple/Documents/codex_projects/acos-mvp/AGENT_CN.md
```
Expected：两个文件 `## ` 章节数相等。

---

## Task 4: 整体校验

**Files:** 无文件改动，仅运行校验命令。

**Why this task:** 在交还用户前，对全部改动做最后一次自检：改动文件清单与 spec 一致，中英镜像无漂移，目录骨架完整。

- [ ] **Step 1: 检查工作区改动清单与 spec 一致**

Run:
```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp status --short
```
Expected 输出（顺序可能不同）：
```
?? docs/superpowers/plans/2026-05-11-ai-working-conventions.md
?? docs/superpowers/specs/2026-05-11-ai-working-conventions-design.md
?? games/difference-hunt/docs/superpowers/plans/.gitkeep
?? games/difference-hunt/docs/superpowers/specs/.gitkeep
 M AGENT.md
 M AGENT_CN.md
```

如出现额外文件或缺失文件，停下来排查。

- [ ] **Step 2: 检查 AGENT.md / AGENT_CN.md 的 diff 仅在末尾追加**

Run:
```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp diff --stat AGENT.md AGENT_CN.md
```
Expected：两文件均只有插入行（`+` 行），无删除行（`-` 行）。如果有删除行，说明误改了既有章节，停下来回滚。

进一步检查：
```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp diff AGENT.md | grep -c '^-[^-]'
git -C /Users/apple/Documents/codex_projects/acos-mvp diff AGENT_CN.md | grep -c '^-[^-]'
```
Expected：两条命令输出都是 `0`。

- [ ] **Step 3: 中英镜像逐节对照**

Run:
```bash
grep '^### ' /Users/apple/Documents/codex_projects/acos-mvp/AGENT.md | tail -5
grep '^### ' /Users/apple/Documents/codex_projects/acos-mvp/AGENT_CN.md | tail -5
```
Expected：分别输出 5 行英文小节标题与 5 行中文小节标题，顺序对应一致：

```
### Preparation Before Edits
### Irreversible Operations Require User Approval
### Completion Bar (No Performative "Done")
### Documentation And Mirroring
### specs / plans Location And Naming
```
```
### 改动前的准备
### 不可逆操作必须用户授权
### 完成判定（不表演式完成）
### 文档与镜像
### specs / plans 放置与命名
```

如果顺序不对应或条目数不一致，停下来修复镜像。

- [ ] **Step 4: 校验 difference-hunt 目录**

Run:
```bash
ls /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/specs /Users/apple/Documents/codex_projects/acos-mvp/games/difference-hunt/docs/superpowers/plans
```
Expected：两个目录都包含 `.gitkeep`。

---

## Task 5: 等待用户授权后统一提交

**Files:** 无文件改动；仅当用户明确要求时执行 commit。

**Why this task:** 仓库 AI 工作约定（即本次添加的内容）规定 "AI 不自主 commit"。改动完成后由用户决定是否提交、是否拆 commit；AI 只负责告知改动内容并等待授权。

- [ ] **Step 1: 通知用户改动已完成，等待提交决策**

输出给用户的内容（直接发文本，不调工具）：

```
所有改动已完成：
- 新增：docs/superpowers/plans/2026-05-11-ai-working-conventions.md
- 新增：docs/superpowers/specs/2026-05-11-ai-working-conventions-design.md
- 新增：games/difference-hunt/docs/superpowers/{specs,plans}/.gitkeep
- 修改：AGENT.md / AGENT_CN.md（末尾追加 "AI 工作约定" 章节，中英镜像）

按本次定下的 AI 工作约定，未自主 commit。
是否要我现在按以下方式统一提交？或者你打算自己提交、或拆分 commit？

建议提交信息（一次性提交全部）：

  chore: add AI working conventions and difference-hunt superpowers skeleton

  - 在根 AGENT.md / AGENT_CN.md 新增 "AI 工作约定" 章节（中英镜像同步）
  - 补 games/difference-hunt/docs/superpowers/{specs,plans}/ 目录骨架
  - 落地配套 spec 与 plan 文档

  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

- [ ] **Step 2: 仅在用户明确同意后执行提交**

如果用户授权"按上述提交"，运行：

```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp add \
  AGENT.md \
  AGENT_CN.md \
  docs/superpowers/specs/2026-05-11-ai-working-conventions-design.md \
  docs/superpowers/plans/2026-05-11-ai-working-conventions.md \
  games/difference-hunt/docs/superpowers/specs/.gitkeep \
  games/difference-hunt/docs/superpowers/plans/.gitkeep \
  && git -C /Users/apple/Documents/codex_projects/acos-mvp commit -m "$(cat <<'EOF'
chore: add AI working conventions and difference-hunt superpowers skeleton

- 在根 AGENT.md / AGENT_CN.md 新增 "AI 工作约定" 章节（中英镜像同步）
- 补 games/difference-hunt/docs/superpowers/{specs,plans}/ 目录骨架
- 落地配套 spec 与 plan 文档

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

如果用户要求其他提交策略（例如拆分、修改 message、自己提交、暂不提交），按用户指示执行；本步骤的默认命令仅在用户明确同意默认建议时使用。

- [ ] **Step 3: 如已提交，做最后确认**

Run（仅在 Step 2 执行了的前提下）：
```bash
git -C /Users/apple/Documents/codex_projects/acos-mvp log -1 --stat
git -C /Users/apple/Documents/codex_projects/acos-mvp status --short
```
Expected：
- `git log -1 --stat` 显示 6 个文件改动（2 个新建 .gitkeep + 1 spec + 1 plan + AGENT.md + AGENT_CN.md）。
- `git status --short` 输出为空（工作区干净）。

---

## 任务完成判定

全部 Task 1–4 通过后即视为"实现完成"。Task 5 的 commit 是否执行取决于用户决策，不影响 Task 1–4 的完成状态。
