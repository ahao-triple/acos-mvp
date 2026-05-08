# 共联防线

《共联防线》是军事防线主题的轻量三消小游戏，当前目标是提交抖音小游戏审核。

## 当前范围

- 7x7 三消棋盘。
- 10 个 MVP 关卡。
- 普通棋子 5 种：盾牌、弹药、雷达、军章、扳手。
- 障碍：沙袋、防线破损点。
- 道具：炸开、吸走、重排、广告加步。
- 本地存档：关卡进度、金币、道具、奖励领取状态、音效/音乐开关。
- 平台能力：激励视频广告、加桌奖励、加常用奖励、侧边栏入口奖励。

## 目录

```text
game/                 游戏源码、Web 预览、测试
game/public/          最终进入游戏包的运行时资源
assets/               原始/处理/生成资源分层
platform/douyin/      抖音提审物料和平台说明
game.config.ts        mini-pack 构建配置
.env.example          当前游戏的本地环境变量模板
```

`game/public/` 只放最终进入包体的资源。原始大图、参考图、Prompt、处理中间文件放在 `assets/`，不要直接放入 `game/public/`。

## 环境变量

复制模板：

```bash
cp games/gonglian-fangxian/.env.example games/gonglian-fangxian/.env
```

填写：

```bash
DOUYIN_APPID=
DOUYIN_REWARDED_AD_UNIT_ID=
```

`DOUYIN_APPID` 写入 `project.config.json.appid`。`DOUYIN_REWARDED_AD_UNIT_ID` 写入运行时广告配置。

## 命令

在仓库根目录执行：

```bash
pnpm verify
pnpm build games/gonglian-fangxian
pnpm smoke games/gonglian-fangxian
pnpm test:game
```

游戏源码目录内也可以执行：

```bash
pnpm --dir games/gonglian-fangxian/game dev
pnpm --dir games/gonglian-fangxian/game test
pnpm --dir games/gonglian-fangxian/game build
```

## 抖音包

构建命令：

```bash
pnpm build games/gonglian-fangxian
```

输出目录：

```text
build/gonglian-fangxian-douyin
```

提交审核前确认：

- `.env` 中 `DOUYIN_APPID` 是正式 appid。
- `.env` 中 `DOUYIN_REWARDED_AD_UNIT_ID` 是正式激励视频广告位。
- `pnpm verify` 通过。
- 使用抖音开发者工具打开 `build/gonglian-fangxian-douyin` 后，真机能进入主菜单并开始第 1 关。

## 广告和奖励规则

- 激励视频不会自动弹出，只能由用户点击明确广告按钮触发。
- 广告道具入口只在局内使用，按钮文案为 `看广告炸开`、`看广告吸走`、`看广告重排`。
- 失败结算有 `看广告加 5 步`。
- 用户取消或中断广告：不发奖励。
- 广告能力不支持或拉取失败：兜底发放奖励，并展示反馈。
- 加桌、加常用、侧边栏按钮始终展示；平台能力不可用时只反馈，不阻断主流程。
- 加桌、加常用、侧边栏奖励领取状态写入本地存档，避免重复领取。

## 资源规范

文件名使用小写英文、数字和连字符：

```text
piece-shield-v01-128.png
ui-button-primary-v01.png
sfx-match-v01.wav
share-main-v01-4x3.png
```

资源分层：

```text
assets/raw/          原始资源，不进包
assets/processed/    处理后的可用资源
assets/generated/    AI 生成记录
platform/douyin/     平台提审物料
game/public/         运行时包体资源
```

## 提审检查

项目方需要在平台侧处理软著、主体资质、备案、平台账号、隐私与合规材料、最终上传和审核。

包体侧检查：

- 游戏名：《共联防线》。
- 竖屏，逻辑设计分辨率 `750x1334`。
- 主要按钮、棋盘、目标、步数、弹窗、奖励入口都在安全区内。
- `game.json` 中 `deviceOrientation` 为 `portrait`。
- 广告按钮有明确广告标识。
- 不自动弹广告。
- 原始资源不进入 `game/public/`。
- 第 1 关、最后一关、失败重玩、广告加步、广告道具、加桌、加常用、侧边栏入口都能走通或给出明确反馈。

## 调试日志

真机或抖音开发者工具控制台搜索 `[GLFX]`：

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

## 平台物料

- [抖音介绍文案](platform/douyin/materials/description.md)
- [抖音奖励入口说明](platform/douyin/rewards.md)
