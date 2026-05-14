# acos-mvp

本仓库包含 `gonglian-fangxian` 小游戏和本地打包工具 `mini-pack`。当前目标平台是 vivo：游戏代码用 PixiJS + TypeScript 开发，`mini-pack` 负责生成 vivo 工程与 `.rpk` 包。

## 命令

所有命令都在仓库根目录执行。

| 命令 | 说明 |
|---|---|
| `pnpm install` | 安装依赖，并应用 PixiJS vivo 兼容补丁 |
| `pnpm dev` | 启动 `gonglian-fangxian` 的 Vite dev server |
| `pnpm build` | 生成 vivo 工程到 `games/gonglian-fangxian/channels/vivo/build/` |
| `pnpm pack` | 真实打包 vivo `.rpk` 到 `games/gonglian-fangxian/dist/` |
| `pnpm preflight` | 检查 vivo 打包素材和配置 |
| `pnpm test` | 跑全部 Vitest 测试 |
| `pnpm test:game` | 只跑游戏测试 |
| `pnpm test:cli` | 只跑 `mini-pack` 测试 |
| `pnpm typecheck` | 跑 TypeScript 类型检查 |
| `pnpm verify` | 执行 install、build、test、pack 完整验证链路 |
| `pnpm clean` | 清理构建、测试和打包产物 |

## 目录

| 路径 | 作用 |
|---|---|
| `mini-pack/` | 本地 CLI 和 vivo 打包实现 |
| `games/gonglian-fangxian/` | 游戏项目、vivo 渠道素材、打包配置 |
| `games/gonglian-fangxian/game/` | PixiJS 游戏运行时代码、测试、静态资源 |
| `games/gonglian-fangxian/game/docs/` | 游戏侧维护文档 |
| `scripts/` | 根目录命令使用的封装脚本 |
| `assets/` | 共享字体源说明和素材占位 |

## 常用流程

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm pack
```
