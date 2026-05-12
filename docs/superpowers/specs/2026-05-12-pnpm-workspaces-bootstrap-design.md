# P0/1 引入 pnpm workspaces 作为统一安装机制

> 对应 `CHANGES-BEFORE-AGENTS.md` 的 P0/1。
> 目标：让"一次性把整个仓库装好"变成一个命令，且让根目录有单一 lockfile 作为真相源。

## 背景

仓库目前每个子包独立 install、各自维护 lockfile，没有根 workspaces。新人或 agent 第一步常被卡：要么在根目录跑 `pnpm install` 一无所获，要么漏装其中一个子包。`pnpm verify` 也因此在新机器上不能开箱即用。

涉及到的三个子包：

- `mini-pack/`
- `games/gonglian-fangxian/game/`
- `games/difference-hunt/game/`

`mini-pack/` 还依赖一个本地 file 路径包 `mini-pack/stubs/puppeteer/`（`puppeteer: file:stubs/puppeteer`），用作 puppeteer 的 stub。这个目录虽然带 `name: "puppeteer"` 的 package.json，但通过 file 协议而非 workspace 协议解析，且不会被 packages 通配匹配到。

## 决策

采用 **pnpm workspaces**（前述讨论中的 C 方案），而不是 `scripts/bootstrap.mjs` 包装器或一条内联多 install 命令的 npm script。

理由：

- workspaces 是 pnpm 处理多包仓库的"原生方式"，根目录单一 lockfile 是真相源，避免三个 lockfile 漂移
- 新子包加入只要在 `pnpm-workspace.yaml` 的 `packages` 通配范围内，无需改任何 script
- 命令收敛为 `pnpm install`，AGENTS.md 里的 Setup 段会变成一行字面量

承担的代价：

- 仓库从此进入 workspaces 模式，所有人和工具都要按这个心智模型工作；不能再"只在子包里 install"
- 历史上"每子包独立 install"的约定被推翻，依赖解析行为可能在边界情况下与之前不同（详见"已知风险"）

## 文件改动清单

### 新增

**`pnpm-workspace.yaml`**

```yaml
packages:
  - mini-pack
  - games/*/game
```

通配只匹配真正含 `package.json` 的目录：`mini-pack` 本身、每个游戏下的 `game/` 子目录。**不**写 `games/*`——`games/<game>/` 这一层没有 package.json，匹配上会让 pnpm 报错。`mini-pack/stubs/puppeteer/` 不在通配里，仍按 file 依赖处理。

### 修改

**根 `package.json`**

在 `scripts` 块加一条：

```jsonc
{
  "scripts": {
    "bootstrap": "pnpm install"
  }
}
```

其它 script 保持不变。`pnpm --dir <子包> ...` 这种写法在 workspaces 下照旧能用（`--dir` 只切 cwd），所以 `build / preflight / smoke / test:game / test:pack / verify` 都不需要改。

### 删除

- `mini-pack/pnpm-lock.yaml`
- `games/gonglian-fangxian/game/pnpm-lock.yaml`
- `games/difference-hunt/game/pnpm-lock.yaml`

根目录会生成统一的 `pnpm-lock.yaml`，需要 `git add` 提交作为新的真相源。

### 不动

- `.gitignore`：`node_modules/` 已覆盖所有层级；新增的根 `pnpm-lock.yaml` 不在 ignore 内，会被 track（正确）
- `mini-pack/package.json` 里的 `puppeteer: file:stubs/puppeteer` 依赖声明
- 任何 `scripts/*.mjs` 顶层脚本
- 任何子包自身的 `package.json` 内容

## 已知风险与缓解

**风险 1：vivo CLI bin 在 workspaces 下定位变化**

`mini-pack` 通过 spawn 调用 `@vivo-minigame/cli` 提供的可执行文件。pnpm 默认 isolated linker，每个 workspace 仍有自己的 `node_modules/.bin/`，理论上 bin 链接照旧；但需要实测。

**缓解**：Verify 步骤里强制跑一次 `pnpm build games/difference-hunt --platform vivo`（用 `MINI_PACK_VIVO_FAKE_RPK=1` 走 fake 路径，避免真正打 rpk）。

**风险 2：esbuild / vitest / tsx 等 native 二进制依赖在 workspaces 下的 hoist 位置变化**

pnpm 通常按子包独立摆放 native binding，但 install 完整跑通是最快的验证。

**缓解**：Verify 步骤里 `pnpm verify` 必须全绿（覆盖 test:game / test:pack / build）。

**风险 3：本次改动一次性删除三个旧 lockfile，回退不便**

**缓解**：本次改动作为单个 commit 提交，万一线上发现问题（比如某个开发者机器装不上），单 commit revert 即可恢复到当前状态。

## 验证步骤

按顺序在干净状态下跑通：

1. 清空所有装好的依赖与旧 lockfile：

   ```bash
   rm -rf node_modules
   rm -rf mini-pack/node_modules
   rm -rf games/gonglian-fangxian/game/node_modules
   rm -rf games/difference-hunt/game/node_modules
   ```

   旧 lockfile 已在改动里删掉，新 workspaces 文件已就位。

2. 根目录 `pnpm install`：必须一次成功，根目录生成新的 `pnpm-lock.yaml`，每个 workspace 的 `node_modules/` 重新出现。

3. `pnpm verify`：必须全绿。覆盖 `test:game`（gonglian-fangxian 的 vitest）+ `test:pack`（mini-pack 的 vitest，含 `tests/integration/repo-build.test.ts` 端到端 build）+ `pnpm build games/gonglian-fangxian`（douyin 平台）。

4. `pnpm build games/gonglian-fangxian --platform kuaishou`：必须出包，验证 kuaishou 平台未受影响。

5. `MINI_PACK_VIVO_FAKE_RPK=1 pnpm build games/difference-hunt --platform vivo`：必须出包，验证 vivo CLI bin 在 workspaces 下仍可达。

任一步失败：保留现场分析；如果 30 分钟内查不出来或风险太大，单 commit revert 回退。

## 范围之外

以下事项**不在本次 P0/1 范围内**，单独跟进：

- P0/2 CI：单独的下一步
- 把现有 `pnpm --dir <子包> ...` 写法改成 `pnpm --filter <name> ...` 这种更地道的 workspaces 写法——保持本次改动最小，等后续真有需求再说
- 根 `test:game` 没覆盖 `games/difference-hunt/game/` 的 vitest（这是个独立缺陷，本次不修）
- `pnpm verify` 只 build gonglian-fangxian × douyin（这是 P1/4 的范围）

## 完成定义

- `pnpm-workspace.yaml` 存在并通过验证
- 三个旧 lockfile 已删除，根 `pnpm-lock.yaml` 已生成并 commit
- 根 `package.json` 有 `"bootstrap": "pnpm install"`
- 上述 5 条 Verify 步骤全部通过
- `CHANGES-BEFORE-AGENTS.md` 里 P0/1 的复选框打勾
