# P2/5 + P2/6 收尾合并设计

> 对应 `CHANGES-BEFORE-AGENTS.md` 的 P2/5、P2/6。
> 把清单上最后两条 P2 一起落地，作为 AGENTS.md 撰写之前的最终收尾。

## 背景

P0/1、P0/2、P1/3、P1/4 都已落地。`CHANGES-BEFORE-AGENTS.md` 还剩两条 P2：

- **P2/5**：给 `difference-hunt` 加 `.env.example`——`gonglian-fangxian` 已有，`difference-hunt` 没有，新人接手时不知道需要哪些 env
- **P2/6**：选最轻量 formatter（或主动决定不做）——MVP 阶段未引入 ESLint/Prettier/Biome；清单原文明确"不是必须做，刻意不做请明确告诉我"

两条都是文档/配置级改动，互不耦合、零代码影响——合到一个 spec/plan 一次推完。

## 决策

### P2/5：建 `games/difference-hunt/.env.example`

与 `games/gonglian-fangxian/.env.example`（P1/3 落地后）风格对齐：列三平台关键 env、SERVER_BASE_URL 注释 + 同样的"发版前还原"警告。

**不**在 `mini-pack/src/commands/preflight.ts` 加 env 校验逻辑——build 内部已经会因为 `materials.ts` 校验失败给清晰错误（P1/4 期间 controller 实测 `appid 为空...` 报错就来自这条链路），preflight 不重复造防御。

### P2/6：刻意不引入 formatter

- 当前阶段：仓库 4 个 workspace、3 个 contributor 级别的活跃度，引入 Biome/Prettier 的成本（一次性 config + 跑全仓库 format + 修出来的 diff 噪音 + 未来 CI 加 lint step）超过收益。
- 等团队 / 代码量上来再决定：选 Biome（单二进制、零配置可用、与 mini-pack 的 esbuild 风格匹配）。
- **本次行动**：只在 `CHANGES-BEFORE-AGENTS.md` 的 P2/6 注脚记录"刻意不做"决策，让未来 AGENTS.md 撰写时直接抄一句 "Repository intentionally has no linter/formatter; do not add one without discussion."
- **不**创建 `AGENTS.md`、**不**创建 `biome.json`、**不**改 `package.json`。

### 不做的事

- 创建 `AGENTS.md`（CHANGES 顶部明确"最终 AGENTS.md 写在清单清完之后"，下一步事；本次 spec 只清完清单）
- 给 preflight 加 env 校验
- 给 difference-hunt 跑 preflight 验证 .env.example 完整性（独立 follow-up）
- 引入任何 formatter / lint 工具

## 文件改动清单

### 新增

**`games/difference-hunt/.env.example`**

```
DOUYIN_APPID=
DOUYIN_REWARDED_AD_UNIT_ID=
KUAISHOU_APPID=
KUAISHOU_REWARDED_AD_UNIT_ID=

# 可选：覆盖默认 serverBaseUrl（构建时注入，改完需重新 pnpm build）
# 设为空行等价于不设置，使用默认值（用 || 而非 ??）
# 注意：发版前确认此项已注释或已还原，否则测试地址会被打进产物
# SERVER_BASE_URL=https://staging.example.com/api
```

要点：
- DOUYIN_*、KUAISHOU_* 与 `materials.ts` 用到的 env key 一致（`process.env.DOUYIN_APPID ?? ''` 等）
- vivo 不需要 env（`materials.ts` 全硬编码：packageName、versionName 等），所以这里**不**列 VIVO_* 占位
- SERVER_BASE_URL 注释块与 P1/3 在 `games/gonglian-fangxian/.env.example` 加的内容**字面一致**

### 修改

**`CHANGES-BEFORE-AGENTS.md`** 两处：

1. P2/5 段把 `- [ ] 完成` 改为：
   ```
   - [x] 完成

   建了 `games/difference-hunt/.env.example`，含 DOUYIN/KUAISHOU 两套 env
   key + SERVER_BASE_URL 注释段，与 `gonglian-fangxian/.env.example` 对齐。
   vivo 不需要 env（materials.ts 全硬编码）所以未列。
   不补 preflight env 校验——build 内部 materials 校验已给清晰错误，
   preflight 重复造防御无价值。
   见 `docs/superpowers/specs/2026-05-12-p2-cleanup-design.md`。
   ```

2. P2/6 段把 `- [ ] 完成（或主动决定不做）` 改为：
   ```
   - [x] 完成 — 决定**刻意不引入**

   理由：MVP 阶段团队/代码量都小，引入 Biome/Prettier 的成本（config +
   全仓库 format + 修 diff 噪音 + CI lint step）超过收益。等团队/代码量
   上来再选 Biome（单二进制、零配置、与 mini-pack 的 esbuild 风格匹配）。

   写 AGENTS.md 时请抄入一句：
   > Repository intentionally has no linter/formatter; do not add one without discussion.

   见 `docs/superpowers/specs/2026-05-12-p2-cleanup-design.md`。
   ```

### 不动

- `AGENTS.md`（不存在；CHANGES 顶部明确"清单清完后写"，下一步事）
- `mini-pack/`、`games/`（除 `.env.example`）、`scripts/`、`package.json`、`pnpm-lock.yaml`、`.github/workflows/ci.yml`
- `gonglian-fangxian/.env.example`（P1/3 已搞，不动）

## 已知风险与缓解

**风险 1：difference-hunt/.env.example 列了未来可能改的 env key**

`materials.ts` 现在用 `DOUYIN_APPID` / `KUAISHOU_APPID`；如果未来重命名，`.env.example` 与代码会漂移。

**缓解**：`.env.example` 是参考文档，不是合约，漂移时按代码为准。grep 也容易发现两边的不一致。不在本次预先做。

**风险 2：vivo env 缺席让人误以为 vivo 不需要任何环境配置**

实际 vivo 需要 vivo CLI（`@vivo-minigame/cli`），但这通过 `pnpm install` 自动解决，不是 env 范畴；fake rpk 模式由 `MINI_PACK_VIVO_FAKE_RPK=1` 触发，但这是测试用、不应放进 `.env.example`。

**缓解**：保持当前简洁。如果未来 vivo 真需要 env（如 vivo 后台 secrets），单独补充。

**风险 3："刻意不做 formatter"决策容易随团队扩张过期**

decision 写进 CHANGES 注脚后，半年内可能就被新人挑战。

**缓解**：注脚明确"等团队/代码量上来再选 Biome"——给出退出条件。这条决策不打算"永远生效"，只是"现在不做"。

## 验证步骤

1. **新文件存在**：`ls games/difference-hunt/.env.example` 命中
2. **内容对齐**：`diff games/gonglian-fangxian/.env.example games/difference-hunt/.env.example` 应该只在前几行 env key 列表不同；SERVER_BASE_URL 注释段字面一致
3. **不破坏 build**：`pnpm test:pack` 应仍 72 passed（不应受 `.env.example` 文件影响——但跑一次确认）
4. **CHANGES 复选框打勾**：P2/5、P2/6 都从 `- [ ]` 变 `- [x]`，注脚加上
5. **未引入新依赖**：`git diff -- pnpm-lock.yaml` 无输出（lockfile 未动）
6. **未创建多余文件**：`git status` 末态只显示新增 `games/difference-hunt/.env.example`、修改 `CHANGES-BEFORE-AGENTS.md`、新增 spec + plan 这 4 个文件

## 范围之外

- 写 AGENTS.md（CHANGES 清单清完后单独做）
- 给 preflight 加 env 校验
- 实际引入 Biome（决定不做）
- 给 vivo 加 env 占位（不需要）

## 完成定义

- `games/difference-hunt/.env.example` 存在
- `CHANGES-BEFORE-AGENTS.md` 的 P2/5、P2/6 复选框打勾且注脚到位
- 上述 6 条 Verify 步骤通过
- 不引入任何新依赖、新 script、新代码改动
