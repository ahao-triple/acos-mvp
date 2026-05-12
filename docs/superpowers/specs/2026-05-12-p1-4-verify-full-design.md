# P1/4 拆分 `verify` 与 `verify:full`

> 对应 `CHANGES-BEFORE-AGENTS.md` 的 P1/4。
> 目标：把"发版前的全矩阵验证"从想法变成一个命令，且不影响日常 `pnpm verify` 的时长。

## 背景

仓库现状（截至 P1/3 落地后）：

- 根 `package.json` 的 `verify` 是 `pnpm test:game && pnpm test:pack && pnpm build games/gonglian-fangxian`——只 build 一个游戏 × 一个平台（gonglian-fangxian × douyin 默认）
- 矩阵实际有 **5 组**（按 `games/*/channels/<platform>/materials.ts` 推导）：
  - gonglian-fangxian × {douyin, kuaishou}
  - difference-hunt × {douyin, kuaishou, vivo}
- 仓库已习惯 `scripts/*.mjs` 风格（`build-game.mjs`、`preflight.mjs`、`smoke-douyin.mjs`）
- vivo 真实 build 调用 `@vivo-minigame/cli` 打 rpk；P0/1 spec 验证过 `MINI_PACK_VIVO_FAKE_RPK=1` 可走 fake 路径，绕过 rpk 打包过程
- CI（P0/2）跑 `typecheck + test:game + test:pack`，**不**跑 `verify`，原因是末段 build 依赖 `DOUYIN_APPID` 等 env，CI 上没有 `.env`
- P0/2 spec 已经明确 `repo-build.test.ts` 覆盖 3 组真实 build（gonglian × douyin/kuaishou + difference-hunt × vivo）作为 CI 端到端 gate

## 决策

新增 `scripts/verify-full.mjs`：扫 `games/*/channels/<platform>/materials.ts` 推导矩阵，对每组 spawn `pnpm build games/<game> --platform <platform>`；vivo 组注入 `MINI_PACK_VIVO_FAKE_RPK=1`；任一失败立即停，输出 `[verify:full] <game> × <platform> 失败`。

根 `package.json` 加 `"verify:full": "node scripts/verify-full.mjs"`；**`verify` 不动**。

### 关键选择

- **走 mjs（A 方案）而非 inline package.json 长串（B 方案）**：仓库已是 `scripts/*.mjs` 风格；inline 一行 200+ 字符在 `package.json` 难读；mjs 自动推导矩阵，未来加 game/平台不用改 script。
- **矩阵自动推导**：扫 `games/*/channels/<platform>/materials.ts` 存在即视为该游戏支持该平台。新增 game/平台不用动 mjs。
- **vivo 默认 `MINI_PACK_VIVO_FAKE_RPK=1`**：让开发者机器没装 vivo CLI 也能跑 verify:full；真实 rpk 打包另跑 `pnpm build games/difference-hunt --platform vivo` 验证，不在 verify:full 范围。
- **失败立即停**：仿 `&&` 语义。第一个失败的组停止后续，避免噪音；mjs 打印 `[verify:full] <game> × <platform> 失败` 让定位 1 秒搞定。
- **顺序**：先 `pnpm test:game` → `pnpm test:pack` → 矩阵 5 组 build（每组按字典序：gonglian-fangxian 先、douyin 先）。
- **不跑 preflight 前置**：build 内部已有必要校验；preflight 也依赖同样 env，前置只会双重报错。
- **`verify` 命令本身不动**：清单原文意图（"verify 保持快验"）即此；本地/CI 默认走 `verify`。
- **CI 不动**：P0/2 决定 CI 跑 typecheck + test:game + test:pack；verify:full 是开发者本地发版前命令，需配齐 `.env`。

### 不做的事

- 把 verify:full 上 CI（需要 GitHub secrets 注入 DOUYIN_APPID 等）—— 未来再说
- 给 root `test:game` 补 difference-hunt 的 game/ vitest（P1/4 清单原文显式列在"范围之外"，独立缺陷）
- 让 vivo 自动检测 CLI 可用性、按可用性选 fake/真实 —— YAGNI，等真要本地打真实 rpk 再说
- 给 verify:full 加 `--skip-platform vivo` 之类的开关 —— YAGNI
- 让 `pnpm verify` 跑前自动 preflight —— 值得未来加，不在 P1/4

## 文件改动清单

### 新增

**`scripts/verify-full.mjs`**

50-70 行的 Node ESM 脚本。结构：

```js
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = path.join(repoRoot, 'games');

// 1. 扫矩阵：games/*/channels/*/materials.ts
const matrix = [];
for (const gameName of fs.readdirSync(gamesDir).sort()) {
  const channelsDir = path.join(gamesDir, gameName, 'channels');
  if (!fs.existsSync(channelsDir) || !fs.statSync(channelsDir).isDirectory()) continue;
  for (const platform of fs.readdirSync(channelsDir).sort()) {
    if (fs.existsSync(path.join(channelsDir, platform, 'materials.ts'))) {
      matrix.push({ gameName, platform });
    }
  }
}

console.log(`[verify:full] 矩阵：${matrix.map((m) => `${m.gameName}×${m.platform}`).join(', ')}`);

// 2. test:game / test:pack
runOrExit('pnpm', ['test:game'], 'test:game', {});
runOrExit('pnpm', ['test:pack'], 'test:pack', {});

// 3. 矩阵 build
for (const { gameName, platform } of matrix) {
  const env = platform === 'vivo' ? { ...process.env, MINI_PACK_VIVO_FAKE_RPK: '1' } : process.env;
  runOrExit('pnpm', ['build', `games/${gameName}`, '--platform', platform], `${gameName} × ${platform}`, env);
}

console.log(`[verify:full] 全部 ${matrix.length} 组通过`);

function runOrExit(command, args, label, env) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, { cwd: repoRoot, stdio: 'inherit', env });
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
- 复用 `scripts/build-game.mjs` 的 `resolveCommand`/`spawnSync` 风格（Windows 兼容）
- `stdio: 'inherit'` 让子进程输出直通终端——失败时 build 自带错误（含缺哪个 env）一目了然
- 矩阵推导按字典序，结果稳定
- 用 `process.env` 透传当前 env，vivo 组叠 `MINI_PACK_VIVO_FAKE_RPK=1`

### 修改

**根 `package.json`** `scripts` 块加：

```jsonc
{
  "scripts": {
    "verify:full": "node scripts/verify-full.mjs"
  }
}
```

`verify` 不动。其它 script 也不动。

### 不动

- `mini-pack/` 任何代码
- `games/` 任何代码（含 game.config.ts、channels/、game/）
- `.github/workflows/ci.yml`（P0/2 落地的 CI 不引入 verify:full）
- `scripts/build-game.mjs`、`scripts/preflight.mjs`、`scripts/smoke-douyin.mjs`
- `CHANGES-BEFORE-AGENTS.md` 在落地后单独 commit 打勾，不在本次 spec 范围里讲怎么改

## 已知风险与缓解

**风险 1：本机 .env 缺，开发者跑 verify:full 第一组就失败、看不懂错误**

verify:full 假设本机配齐 `games/gonglian-fangxian/.env`（含 DOUYIN_APPID）+ `games/difference-hunt/.env`（含三平台 env）。缺任一就在第一个 build 卡住。

**缓解**：`stdio: 'inherit'` 让 build 自带的错误（"Missing DOUYIN_APPID env"等）直通终端；mjs 输出 `[verify:full] gonglian-fangxian × douyin 失败 (exit 1)` 让定位 1 秒搞定。`CHANGES-BEFORE-AGENTS.md` 注脚 + commit message 明确"verify:full 是发版前命令，需配齐所有 .env"。

**风险 2：vivo fake rpk 模式在某些环境（Linux CI）行为不同**

P0/1 spec 在 Mac × fake rpk 验证过；其它环境理论上也应工作（fake 路径不调外部 CLI）。但本仓库目前没有"Linux 本地跑 verify:full"的真实回归。

**缓解**：CI 当前不跑 verify:full（决策上），所以这条仅在开发者本地跑时才会暴露。如果未来开发者在 Linux 本机踩坑，单独 follow-up；不在本次 spec 范围预先做。

**风险 3：未来 `games/*/channels/` 下出现非平台目录会被误纳入矩阵**

矩阵推导只看"`channels/<dir>/materials.ts` 是否存在"，不校验 `<dir>` 是否在 `{douyin, kuaishou, vivo}` 中。

**缓解**：mini-pack `cli build --platform` 会校验 platform 合法性（`supportedPlatforms` set，见 `scripts/build-game.mjs:7`），非法平台立即报错——本质上让 `mini-pack` 兜底校验，不在 mjs 重复。如果未来加新平台，mini-pack 的 supportedPlatforms 要先扩展。

**风险 4：spawn `pnpm build` 调用层级**

`pnpm build` → `node scripts/build-game.mjs` → `pnpm --dir mini-pack build` + `node mini-pack/dist/cli.js build`。每组都会重新 `pnpm --dir mini-pack build`，5 组就 5 次。对 mini-pack/dist 来说是 idempotent，但可能慢。

**缓解**：不优化（YAGNI），矩阵跑 5 组总时长仍是发版前可接受的（每组几秒~几十秒）。如果实测慢到无法忍受，未来加缓存或者把 mini-pack build 拎出来跑一次再跑 5 组——不在本次 spec。

## 验证步骤

1. **基线时长**：`time pnpm verify`（事先确认 .env 完整）记录耗时，与改动前对照——应一致（命令字段未变）

2. **缺 env 失败定位**：
   - 临时把 `games/gonglian-fangxian/.env` 改名为 `.env.bak`
   - 跑 `pnpm verify:full`
   - Expected：先跑 test:game ✓ → test:pack ✓ → gonglian-fangxian × douyin 失败，stderr 包含 mini-pack 报的"缺 DOUYIN_APPID"类信息，最后一行 `[verify:full] gonglian-fangxian × douyin 失败 (exit 1)`
   - 还原 .env

3. **配齐 .env 全矩阵通过**：
   - 确认 `games/gonglian-fangxian/.env` 与 `games/difference-hunt/.env` 都配齐了对应平台 env
   - 跑 `pnpm verify:full`
   - Expected：test:game + test:pack 通过 → 5 组 build 依次通过 → 最后一行 `[verify:full] 全部 5 组通过`

4. **矩阵推导**：
   - 临时建 `games/gonglian-fangxian/channels/vivo/materials.ts`（内容随便、能 import 即可）
   - 跑 `pnpm verify:full` 立即用 Ctrl-C 中断（也可以 `node scripts/verify-full.mjs 2>&1 | head -3`），观察第一行打印 `[verify:full] 矩阵：...`
   - Expected：矩阵那一行列出 `gonglian-fangxian×vivo` 在内的 6 组（具体 6 组：gonglian × {douyin, kuaishou, vivo} + difference-hunt × {douyin, kuaishou, vivo}）
   - 删除该 vivo 目录恢复原状，重跑 `pnpm verify:full` 第一行应回到 5 组

5. **`pnpm verify` 不动**：
   - 跑 `pnpm verify`，应与改动前行为相同（test:game + test:pack + build gonglian-fangxian × douyin）

6. **CHANGES-BEFORE-AGENTS.md** 里 P1/4 的复选框打勾

任一步失败：保留现场分析。改动只有一个新 mjs + 一行 package.json，回退成本极低（单 commit revert）。

## 范围之外

- verify:full 上 CI（需要 secrets）—— 未来 P3 范围
- 给 root `test:game` 补 `difference-hunt/game/` 的 vitest —— 独立缺陷
- vivo CLI 真实 rpk 打包验证 —— 单独流程，开发者按需手动跑 `pnpm build games/difference-hunt --platform vivo`
- 让 `pnpm verify` 跑前自动 preflight —— 未来值得做
- 给 mini-pack 把 `pnpm --dir mini-pack build` 提到 verify:full 顶层做一次缓存 —— 未来再优化

## 完成定义

- `scripts/verify-full.mjs` 存在且按上述结构实现
- 根 `package.json` 的 `scripts` 含 `"verify:full": "node scripts/verify-full.mjs"`
- `verify` 字段未动
- 上述 6 条 Verify 步骤全部通过
- `CHANGES-BEFORE-AGENTS.md` 里 P1/4 的复选框打勾
