# AI 工作约定 设计文档

- 日期：2026-05-11
- 主题：把 AI 在本仓库工作时需要遵守的行为规范、目录与文档结构固化下来
- 所属范围：仓库级（跨游戏 + `mini-pack` + 仓库规则），spec 落在根 `docs/superpowers/specs/`
- 状态：已与用户对齐，等待写入 `AGENT.md / AGENT_CN.md` 与目录骨架补齐

## 背景

仓库已具备：

- 根 `AGENT.md` / `AGENT_CN.md` 仓库级 AI 规范（已覆盖语言、项目边界、产品、稳定性、广告、关卡与资源、验证、Git 八块）。
- 每个子游戏有自己的 `AGENT.md` / `AGENT_CN.md`（`gonglian-fangxian`、`difference-hunt`）。
- `docs/superpowers/{specs,plans}/` 已有历史产物，`games/gonglian-fangxian/docs/superpowers/{specs,plans}/` 也已使用，文件命名为 `YYYY-MM-DD-<主题>(-design).md`。

未覆盖的缺口：

- AI 工作侧的额外约束（不自主 push/合并/强推/reset、不表演式完成、改动前的工作区检查等）没有成文。
- `specs/plans` 在"根 vs 子游戏"之间的放置标准没有文字判定。
- `games/difference-hunt/` 还没有 `docs/superpowers/{specs,plans}/` 目录骨架，无法在本地按规范落 spec/plan。

本设计目标是补齐上述缺口，单一权威源仍是 `AGENT.md / AGENT_CN.md`，而不是新增独立文档。

## 设计原则

- 单一权威源：AI 工作约定与 AGENT.md 已有规则同处一份文件，避免文档分裂。
- 中英镜像：所有 `AGENT.md` 改动必须同次同步对应 `AGENT_CN.md`；`specs/plans` 不需要镜像。
- YAGNI：本次只做"AI 协作流程固化、AI 工作行为规范、目录与文档结构定型"三块；不做项目路线图/里程碑，不在 AGENT.md 强制 TDD / spec-plan 前置 / verification-before-completion 这三条流程性硬规则。
- 与现有规则不冲突：`Git 规则`、`验证规则`、`语言规则`、`项目边界` 等章节保留不动；新章节对已有条目的重申用"详见上文 X 章节"指回去，不在两处给出不同表述。

## 文档结构与放置策略

### 文档结构

- 根 `AGENT.md` 与 `AGENT_CN.md` 各新增一节 `AI Working Conventions` / `AI 工作约定`，作为 AI 工作规范的唯一权威源。
- 新增章节放在文件末尾，紧接现有 `Git Rules` / `Git 规则` 之后，不重排已有章节。

### specs / plans 放置规则

按影响范围拆分：

- 跨游戏 / `mini-pack` / 平台接入 / 仓库级规则 → 根 `docs/superpowers/`。
- 单游戏的玩法 / 关卡 / UI / 存档 / 资源 / 游戏内平台桥接 → `games/<game>/docs/superpowers/`。

判定示例：

- 新增 vivo 平台能力、调整 `mini-pack` CLI、修改根 `AGENT.md` → 根。
- 给 `difference-hunt` 加难度系统、调 `gonglian-fangxian` 关卡、改某个游戏的资源目录 → 对应游戏目录。
- 一次改动同时跨多个游戏（如统一存档迁移） → 根。

### 命名约定

沿用现有命名：

- `specs/YYYY-MM-DD-<主题>-design.md`
- `plans/YYYY-MM-DD-<主题>.md`

`<主题>` 使用英文连字符短串，便于跨平台和 shell 操作。

### 镜像

- `AGENT.md` 与同目录 `AGENT_CN.md` 必须同次提交同步更新（已有规则，本设计仅重申归位）。
- `specs/plans` 默认使用简体中文（用户可见产出），不需要中英镜像。

## AGENT.md 新章节内容

新增章节包含五块：

1. **改动前的准备**
   - 必先读根 `AGENT.md`，再读对应 `games/<game>/AGENT.md`；规则冲突时以更靠近改动目录的为准（已有规则，重申）。
   - 改动前跑 `git status --short` 查看工作区，避免覆盖未提交改动（与 `Git 规则` 同条，归位重申）。

2. **不可逆操作必须用户授权**
   - AI 不自主执行：`git push`、合并 PR、`git push --force` / `--force-with-lease`、`git reset --hard`、删除分支、`git rebase` 改写已发布历史。
   - `git commit` 仅在用户明确要求时执行；钩子失败时新建提交，不使用 `--amend`。
   - `--no-verify`、`--no-gpg-sign` 等绕过钩子或签名的开关只在用户明确要求时使用。

3. **完成判定（不表演式完成）**
   - 在跑过对应验证之前，不得声称"完成 / 修复 / 通过"。仅跑 `tsc --noEmit` 不算验证。
   - 验证范围依据现有 `验证规则`：玩法/存档/广告 → 对应游戏 `pnpm test`；资源目录 / Vite 配置 / 平台配置 → 加跑对应游戏 `pnpm build`；改 `mini-pack` → 加跑 `pnpm --dir mini-pack test` 与至少一个真实游戏的平台包。
   - 无法本地验证的项（如 UI 浏览器预览不可达、真机不可达）必须显式说明"未验证项"，不得隐去。

4. **文档与镜像**
   - 修改任意 `AGENT.md` 必须在同次提交同步修改同目录 `AGENT_CN.md`，反之亦然（已有规则，重申并归位）。

5. **specs / plans 放置与命名**
   - 跨游戏 / `mini-pack` / 平台接入 / 仓库级规则 → 根 `docs/superpowers/{specs,plans}/`。
   - 单游戏的玩法 / 关卡 / UI / 存档 / 资源 / 游戏内平台桥接 → `games/<game>/docs/superpowers/{specs,plans}/`。
   - 同时跨多个游戏的改动 → 根。
   - 命名：`specs/YYYY-MM-DD-<主题>-design.md`、`plans/YYYY-MM-DD-<主题>.md`；`<主题>` 用英文连字符短串。
   - `specs/plans` 默认使用简体中文，不需要中英镜像。

## 改动文件清单

- 修改：`AGENT.md` — 末尾追加 `AI Working Conventions` 章节（英文）。
- 修改：`AGENT_CN.md` — 末尾追加 `AI 工作约定` 章节（中文镜像）。
- 新建：`games/difference-hunt/docs/superpowers/specs/.gitkeep`
- 新建：`games/difference-hunt/docs/superpowers/plans/.gitkeep`
- 新建：`docs/superpowers/specs/2026-05-11-ai-working-conventions-design.md`（本文件）。
- 后续：`docs/superpowers/plans/2026-05-11-ai-working-conventions.md`（在 writing-plans 阶段产出）。

## 落地顺序

1. 写本设计文档（即本文件），自审通过后请用户审。
2. 用户确认后，调用 `superpowers:writing-plans` 输出 `docs/superpowers/plans/2026-05-11-ai-working-conventions.md`。
3. 按 plan 执行：先补 `difference-hunt/docs/superpowers/{specs,plans}/.gitkeep`；再写中文章节到 `AGENT_CN.md`；再写英文章节到 `AGENT.md`，保持中英镜像在同一次改动中完成。
4. 改动完成后交还用户，由用户决定是否提交。AI 不自主执行 `git commit / push`。

## 验证范围

本次改动仅涉及文档与空目录，不触碰代码、Vite 配置、平台配置、资源。

- 不需要跑 `pnpm test` / `pnpm build`：现有 `验证规则` 未把文档改动列入。
- 验证手段：
  - `git status --short` 检查改动文件清单与本设计一致。
  - `git diff AGENT.md AGENT_CN.md` 比对中英镜像条目数和顺序，确认语义对齐。
  - 抽查目录：`ls games/difference-hunt/docs/superpowers/{specs,plans}` 应出现 `.gitkeep`。

## 风险与对策

- **中英镜像漂移**：两份文件必须同时改完，禁止只改一份提交。对策：plan 把"加中文章节"和"加英文章节"作为同一步的两个动作，写完后人工 diff 比对条目数与顺序。
- **规则重叠表述**：新章节中"改前 git status"与"AGENT 镜像同步"已在既有章节出现。对策：新章节使用简短表述并写"详见 `Git 规则` / `语言规则`"，保持单一权威源；不复制粘贴完整原文。
- **未来扩展**：如果未来要把 superpowers 流程（spec → plan → execute → verification）也写进 AGENT.md，可在本章节追加新条目；当前结构能容纳，不需要重构。
- **判定灰色地带**：`specs/plans` 放在"根 vs 子游戏"之间偶尔难以判定（例如改某个游戏的 platform 桥接但同时影响 mini-pack 接口）。对策：本设计在 `判定示例` 给出三个示例 + "跨多个游戏 → 根" 的兜底；遇到模糊情况时按"涉及 mini-pack / 跨游戏 → 根"优先。

## 非目标（明确不做）

- 不写项目路线图 / 里程碑（用户在 brainstorming 时未勾选）。
- 不在 AGENT.md 强制 superpowers 流程；该偏好保留在用户全局 `CLAUDE.md` 层面。
- 不在 AGENT.md 加 TDD / verification-before-completion / spec-plan 前置 这三条流程性硬规则（用户在 brainstorming 时未勾选）。
- 不重写既有 `验证规则` / `Git 规则` / `语言规则`；只在新章节中重申归位。
