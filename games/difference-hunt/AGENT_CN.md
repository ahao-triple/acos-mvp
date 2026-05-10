# 就你眼神好 AGENT 规则

本文件只补充 `games/difference-hunt` 的局部规则。仓库级规则见根目录 `AGENT.md`。本文件是同目录 `AGENT.md` 的简体中文镜像，必须与其保持语义一致。

## 项目边界

- 本项目产品名为 `就你眼神好`，是移动端竖屏找不同小游戏。
- 默认工作范围限定在 `games/difference-hunt`。
- 保留 Vite + Canvas + mini-pack 架构，不迁移到 Cocos，也不接入 `normalGame`、`addGame` 或其它玩法类型。
- 平台配置入口是 `game.config.ts`，运行时静态资源目录是 `game/public-pack`。

## 玩法与关卡

- 核心玩法只做找不同：玩家在限时内点击图片差异点。
- 关卡数据来自 `game/src/assets/levels.ts`，运行时图片资源位于 `game/public-pack/assets/find/...`。
- 当前内容为 7 关，每关 10 个差异点。扩展关卡时保持编号连续、目标完整、资源路径有效。
- 差异点坐标来自原始关卡素材时，要保留清晰的坐标换算逻辑，不要凭感觉改命中区域。
- 关卡按顺序解锁。未解锁关卡可以通过标识清晰的激励视频入口解锁。

## 页面与商业化

- 保持首页、游戏页、选关页、设置页、胜利弹窗和失败弹窗边界清晰。
- 广告入口用于提示、加时、奖励翻倍和解锁关卡等玩家主动触发场景。
- 广告兜底逻辑不能破坏当前关卡、计时器、已找到目标或存档状态。
- 玩家可见文案必须使用规范简体中文。不要把按钮文字、奖励说明或关卡目标画死在图片里。

## 验证

- 修改玩法、关卡、存档、广告或渲染后，运行 `pnpm --dir games/difference-hunt/game test`。
- 修改资源目录、Vite 配置或平台配置后，运行 `pnpm --dir games/difference-hunt/game build`。
