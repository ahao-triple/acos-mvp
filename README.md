# ACOS MVP

这个仓库当前包含一个小游戏打包工具和一个可提审的抖音小游戏项目。

## 目录

```text
mini-pack/                 Node.js + TypeScript 打包工具
games/gonglian-fangxian/   《共联防线》游戏项目根目录
games/gonglian-fangxian/game/
                            游戏源码、Web 预览、测试
build/                     本地生成的抖音提审包
scripts/                   根目录构建和 smoke 脚本
example/                   参考项目，只用于查设计和实现思路
```

`build/`、`dist/`、`node_modules/` 和 `.env` 都是本地文件，不应提交。

## 常用命令

```bash
pnpm verify
pnpm build games/gonglian-fangxian
pnpm smoke games/gonglian-fangxian
pnpm test:game
pnpm test:pack
```

## 文档

当前只保留少量入口文档：

- [mini-pack](mini-pack/README.md)：打包工具说明。
- [共联防线](games/gonglian-fangxian/README.md)：游戏、资源、提审、调试说明。
- [抖音介绍文案](games/gonglian-fangxian/platform/douyin/materials/description.md)：提审物料草案。

`pnpm build games/gonglian-fangxian` 会：

1. 构建 `mini-pack`
2. 读取 `games/gonglian-fangxian/game.config.ts`
3. 读取 `games/gonglian-fangxian/.env`
4. 输出抖音包到 `build/gonglian-fangxian-douyin`
5. 运行抖音包 smoke 检查

## 抖音配置

每个游戏自己维护 `.env`。以《共联防线》为例：

```bash
cp games/gonglian-fangxian/.env.example games/gonglian-fangxian/.env
```

需要填写：

```bash
DOUYIN_APPID=
DOUYIN_REWARDED_AD_UNIT_ID=
```

`DOUYIN_APPID` 会写入 `project.config.json.appid`。`DOUYIN_REWARDED_AD_UNIT_ID` 会进入运行时广告配置。

## 提审目录

当前游戏的抖音提审包目录是：

```text
build/gonglian-fangxian-douyin
```

提交审核前先运行：

```bash
pnpm verify
```

## 调试日志

真机或抖音开发者工具控制台搜索 `[GLFX]`，可以看到广告和道具关键路径日志，例如：

```text
[GLFX] rewarded_ad_request
[GLFX] rewarded_ad_platform_result
[GLFX] rewarded_ad_result
[GLFX] power_up_ad_request
[GLFX] power_up_ad_outcome
[GLFX] power_up_activate
[GLFX] power_up_apply
[GLFX] navigation_home
```
