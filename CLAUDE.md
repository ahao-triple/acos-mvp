项目结构和命令以 OUTLINE.md 为准,本文件只描述 agent 行为规则。
# CLAUDE.md

本文件是项目对 Claude Code 的约束。每个 session 开始前读它。

## 项目是什么

pnpm workspace，产出唯一一个小游戏 `gonglian-fangxian`，通过内部 CLI 工具 `mini-pack` 打包到 vivo 和 OPPO 平台。vivo 是现有真实打包链路；OPPO 已有平台骨架、工程生成和 fake RPK 链路，真机 runtime 接入仍在后续阶段。**没有其他游戏，也没有抖音、快手、微信等其他平台。**

技术栈：TypeScript + ESM、Pixi.js（渲染）、Vite（dev/build）、Vitest（测试）、Playwright（e2e）、pnpm workspace、Node ≥ 20。

## 命令（全部在仓库根目录执行）

| 命令             | 用途                                    |
| ---------------- | --------------------------------------- |
| `pnpm install`   | 装依赖                                  |
| `pnpm dev`       | 启动游戏 vite dev server                |
| `pnpm build`     | 默认构建 vivo 工程；可用 `--platform oppo` |
| `pnpm pack`      | 默认打 vivo `.rpk`，但建议用显式平台命令 |
| `pnpm pack:vivo` | 出 vivo `.rpk`                          |
| `pnpm pack:oppo` | 出 OPPO `.rpk`；当前需 `MINI_PACK_OPPO_FAKE_RPK=1` 或安装 OPPO CLI |
| `pnpm preflight` | 校验 game config 和资源，可用 `--platform vivo|oppo` |
| `pnpm test`      | 全部测试                                |
| `pnpm test:game` | 仅游戏测试                              |
| `pnpm test:cli`  | 仅 mini-pack 测试                       |
| `pnpm typecheck` | TS 检查不出文件                         |
| `pnpm verify`    | 完整链路：install + build + test + pack |
| `pnpm clean`     | 清理构建产物                            |

**禁止 `cd` 进子目录跑命令。所有入口都在根。**

## 目录

```
/
├── package.json           # 所有依赖、所有命令
├── tsconfig.base.json     # 共用 TS 配置
├── vitest.config.base.ts  # 共用测试配置
├── scripts/               # 命令包装脚本
├── docs/                  # 仓库级文档
├── mini-pack/             # CLI 工具（workspace 子包）
│   ├── src/
│   └── tests/
└── games/gonglian-fangxian/
    ├── game/              # 游戏本体（workspace 子包）
    ├── channels/vivo/     # vivo 渠道物料
    ├── channels/oppo/     # OPPO 渠道物料
    ├── assets/            # 原始 + 处理后资源
    ├── docs/              # 游戏专属文档
    └── game.config.ts     # mini-pack 读取的游戏声明
```

## 代码规范（硬约束）

### 尺寸
- 文件 ≤ 300 行
- 函数 ≤ 50 行
- 参数 ≤ 5 个

超出就拆，不要绕。

### 命名
- 变量/函数用动词或动宾，类/类型用名词
- 不用缩写，例外仅限 `id`、`url`、`dom` 这种行业通用
- 文件名 lowercase-kebab.ts

### 注释
- 写"为什么"，不写"是什么"
- 公开函数/类一句话文档：输入、输出、副作用
- 代码本身能说清楚的不要再注释

### 错误处理
- `catch { /* 空 */ }` 禁止。catch 必须记录、转换或带上下文重抛
- 不能合理恢复的让它崩

### 严令禁止
- 只用一次的封装（单次包装、单方法 Manager 类、空接口）
- "万一以后要用"的代码（没人读的配置、死分支、占位函数）
- 魔法数字/字符串：必须抽成有名字的常量
- 引入 `any` 而不给原因；优先用 `unknown`

## 工作流规范

### 改动
- 永远不在 `main`/`master` 直接提交，永远走特性分支
- 一个 commit 一件逻辑事，不要把"修 bug + 重构 + 加功能"打包
- Commit message：`type: 简述`。type 限定 `feat` / `fix` / `chore` / `refactor` / `docs` / `test`
- 提交前必须 `pnpm verify` 通过

### 不确定时
- 不要猜。读实际代码或者问用户
- 如果你在脑补假设让需求"能跑"，立刻停下来确认

### 删代码
- 删之前必须 grep 确认没有调用方
- 删 > 5 个文件时，先列出来给用户看再执行
- 删代码单独 commit，不要混入其他改动

### 加依赖
- 所有依赖只加到根 `package.json`，子包不加
- 加之前先确认现有依赖能不能干这个活
- 标准库或现有工具够用就不引新依赖

### 加命令
- 用户用的命令只放根，子包不放
- 新命令必须同步加进 README 命令表

## 项目专属约束

- **当前只支持 vivo + OPPO**。不要写抖音、快手、微信小游戏、其他渠道的代码路径。
- **OPPO 目前是骨架平台**。`mini-pack/src/platforms/oppo/`、`channels/oppo/`、`build.oppo.json` 已存在；不要假设 OPPO 真机 runtime 已完成，也不要未经要求去改 `game/src/platform/` 或 `game/patches/`。
- **`web` adapter 只为浏览器 dev 模式存在**，不当发布目标。
- **游戏只有 `gonglian-fangxian` 一个**。不要给"未来的第二个游戏"搭脚手架。
- **mini-pack 是内部工具**。不加 npm 发布流程、不加版本号管理 CI。
- **包体积红线**：`game.js` 必须 < 5MB（当前约 2-3MB）。超了要告警。

## 最近发生过什么

仓库经历过一次大清理（`pre-cleanup` → `cleanup-done` tag）。删掉了：
- 第二个游戏 `difference-hunt`
- 抖音、快手平台支持
- 死的 remoteConfig 远程登录流程
- 重复文档
- 各子包独立的依赖和命令（全部上提到根）

**如果你发现自己在没有明确要求下重新引入上述任何一个，立刻停下来。**
