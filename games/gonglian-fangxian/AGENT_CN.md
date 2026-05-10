# 共联防线软件 AGENT 规则

本文件只补充 `games/gonglian-fangxian` 的局部规则。仓库级规则见根目录 `AGENT.md`。本文件是同目录 `AGENT.md` 的简体中文镜像，必须与其保持语义一致。

## 项目边界

- 本项目产品名为 `共联防线软件`，是移动端竖屏三消闯关小游戏。
- 默认工作范围限定在 `games/gonglian-fangxian`。
- 保留 Vite + Canvas + mini-pack 架构，核心玩法是交换相邻棋子并消除三连及以上。
- 平台配置入口是 `game.config.ts`，运行时静态资源目录是 `game/public-pack`。
- 提审材料、截图和玩家可见文案必须保持名称 `共联防线软件`，不要回退为旧名 `共联防线`。

## 玩法与关卡

- 关卡围绕护盾、弹药、雷达、勋章、扳手等资源收集，以及沙袋、破损防线等障碍清除。
- 保持战役流程：首页、关卡选择、作战简报、游戏页、胜利结算、失败结算和补给入口。
- 关卡按顺序解锁。锁定、已通关和当前可挑战状态必须视觉清晰。
- 道具、连击、目标进度、节点奖励和金币奖励必须保持对旧存档数据兼容。

## 广告与平台能力

- 广告入口用于补给、道具获取、失败加步和胜利奖励翻倍等玩家主动触发场景。
- 广告按钮继续复用现有 `38 x 28` 激励视频标识和统一广告按钮布局。
- 保留抖音侧边栏、添加桌面和平台奖励逻辑；失败时降级反馈，不能阻塞主流程。
- 修改平台能力时，同时检查浏览器预览和 mini-pack 运行时入口。

## 验证

- 修改玩法、关卡、存档、广告或渲染后，运行 `pnpm --dir games/gonglian-fangxian/game test`。
- 修改资源目录、Vite 配置或平台配置后，运行 `pnpm --dir games/gonglian-fangxian/game build`。
- 修改 `channels/douyin/materials.ts` 或 `icon.png` 后，运行 `pnpm preflight games/gonglian-fangxian --platform douyin`。
- 修改平台打包链路后，在仓库根目录运行 `pnpm build games/gonglian-fangxian`（包含 preflight + smoke）。
