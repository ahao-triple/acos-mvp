# 共联防线 · 页面规范合规审计

> 审计对象：`games/gonglian-fangxian/game/src/`（Pixi 实现，Phase 1 迁移后）
> 审计依据：`小游戏页面规范.md` v1.3
> 审计日期：2026-05-13
> 审计人：Claude（自动审计）
>
> **2026-05-13 更新**：
> - 金币系统已废弃删除（无 save.coins、无 economy.ts、无 coinText、无 doubleWinReward、无 levels rewards.coins）。本文档中所有"左上角金币 / 金币图标 / 金币显示位置 / 金币购买道具 / 翻倍金币"相关项标记 **N/A（金币系统已废弃，不适用）**，原 P0/P1/P2 项目级别不变以便回溯。当前道具按钮规则已改为"库存=0 时直接广告"，符合规范 §三 P3。
> - **BriefingScreen 中转屏已删除**（删 `src/pixi/screens/briefing.ts`、controller `briefing` Screen 类型和 `beginLevel` action、`openBriefing` 私有方法）。Menu / Levels / Retry / NextLevel 现在直接进 playing，符合规范 §一 Home→Game 直跳。章节切换暂时用 `console.log` 占位（依赖 Toast 系统未来接入）。本文档 §2 "规范外多出的功能" 中 BriefingScreen 项已不适用。
> - **LoadingPage 已重建**（`src/pixi/screens/loading.ts`，PixiRenderer 注册为 primary screen，controller 初始 `screen='loading'` + 新 `loadingDone` action）。规范 §三 P1 全部 10 个元素到位：著作权人 / 软著号 / 主标题《全民爆梗游戏软件》/ 状态文案 / 装饰动画（背景圆斑 alpha 脉冲）/ 进度条 1.5s / 提示文案 / CADPA 12+ 矢量适龄图标 / 健康游戏忠告（标题 + 4 行 8 句固定文本）。本文档 §1 与 §7 中所有 P0 LoadingPage 缺失项现在 **已实现**；待上线前替换"著作权人 / 软著号"placeholder 为真实信息。

---

## 0. 总体结论

Phase 1 PixiJS 迁移期间规范没有进入实现上下文，导致以下结构性差异：

- **P1 启动加载页（LoadingPage）整屏缺失**：旧 Canvas 版（commit c28971a "LoadingPage 接入 CADPA 12+ 适龄标识"）的 `src/render/loadingScreen.ts` 在迁移后被删除，Pixi 版未重建。`PixiRenderer.registerScreens()` 注册的 screen 只有 `playing / menu / levels / briefing / paused / won / lost / settings / supplies`（`src/pixi/renderer.ts:158-167`）。
- **Toast 基础设施完全没有**：`PlatformAdapter` 没有 `showToast` API，controller 用 `feedback: string` 字段传消息，但所有 Pixi screen 实现里 `grep "feedback"` 零匹配——这意味着用户根本看不到。规范 §2.4 强制要求所有看广告流程结束 toast 提示，目前 100% 不达标。
- **道具按钮规则与规范相反**：规范要求"库存=0 时点击触发激励视频广告"；controller `usePowerUp` 路径是"先用金币购买，金币不够再调广告"（`controller.ts:404-422`），且 0 库存按钮文案显示"60币炸开"而非广告标识。
- **未解锁关卡的"看广告解锁"功能完全没有**：`LevelsScreen.update` 对未解锁关卡直接 `setDisabled(true)`，规范要求"点击 → 看广告 → 解锁 → toast"。
- **平台桥接缺关键能力**：分享、Toast、返回桌面（exit）三个 API 在 `PlatformAdapter` 接口（`platform/types.ts`）上根本不存在。

整体严重度：**P0 共 6 项 / P1 共 8 项 / P2 共 5 项**。详见各节。

---

## 1. P1 启动加载页（LoadingPage）

### 规范要求（§三 P1）

10 个元素，全为纯展示，无任何交互；进度条动画 1-2 秒后自动跳转 HomePage。

### 当前实现

**完全不存在**。

- 没有 `LoadingScreen` 类（`src/pixi/screens/` 不含 loading.ts）。
- `PixiRenderer.registerScreens()` 不注册 loading（`renderer.ts:146-168`）。
- `AppViewState.screen` 类型联合不含 `'loading'`（`controller.ts:13`）。
- `controller` 初始 `screen = 'menu'`（`controller.ts:81`），冷启动直接进 HomePage。
- `index.html` 是裸 `<canvas id="game">`，无任何 HTML loading。
- `src/render/loadingScreen.ts`（v1.0.x Canvas 版引用源）已不存在；当前 `src/render/` 目录只剩 `animation.ts / effects.ts / scaler.ts / theme.ts / time.ts / visualBoard.ts`。
- `public-pack/assets/age-rating-12plus.png`（558×712 备用素材）资源是否还在仓库需要查——但代码里没有任何引用。

### 缺失清单

- [ ] **元素 1** 著作权人（顶部文字）— P0
- [ ] **元素 2** 软著登记号 `SRxxxxxxxxxx` — P0
- [ ] **元素 3** 游戏主标题居中显示 — P0
- [ ] **元素 4** 副标题（可选） — P2
- [ ] **元素 5** 状态文案 — P1
- [ ] **元素 6** 装饰动画 — P2
- [ ] **元素 7** 进度条（1-2 秒动画，不绑定真实进度） — P0
- [ ] **元素 8** 提示文案 — P1
- [ ] **元素 9** 适龄提示图标（CADPA 12+，左下角） — P0（监管要求）
- [ ] **元素 10** 健康游戏忠告（标题 + 4 行 8 句固定文本） — P0（监管要求）
- [ ] **跳转逻辑** 进度条动画结束后自动跳 HomePage — P0

### 严重度：**P0**

监管层面（软著、CADPA 适龄标识、健康游戏忠告）是上架硬性要求；当前实现连承载页都没有，需要新建整个 `LoadingScreen` 类。

---

## 2. P2 主页（HomePage = MenuScreen）

### 规范要求（§三 P2）

7 个元素 + 1 个主 CTA；不包含头像、签到、排行榜、商城、任务、成就。

### 当前实现 vs 规范

| 元素 | 规范要求 | 当前实现 | 状态 |
|------|---------|---------|------|
| 左上角金币 | 文字 + 图标 | `coinText` "金币 0"（`menu.ts:28`），**纯文字、无图标** | ⚠️ 缺图标 |
| 用户信息按钮 | 打开「设置弹窗」 | "用户信息" → `openSettings` | ✅ |
| 加桌按钮 | 触发**平台加桌能力** | "加桌领奖" → `desktopReward`，含**复合奖励逻辑** | ⚠️ 命名/行为偏离 |
| 设置常用按钮 | 触发**平台"设为常用"能力** | "设为常用领奖" → `favoriteReward`，含**复合奖励逻辑** | ⚠️ 命名/行为偏离 |
| 入口奖励按钮（仅抖音） | 仅抖音平台显示，打开「入口奖励弹窗」 | "入口奖励" 仅 `platformName==='douyin'` 时显示（`menu.ts:146-150`），但**直接 dispatch `requestRewardedAd`**，没有"弹窗呈现奖励内容"步骤 | ⚠️ 流程错误 |
| 关卡选择按钮 | 打开「关卡选择弹窗」 | "关卡选择" → `openLevels` | ✅ |
| 开始游戏（主 CTA） | 进入 GamePage（当前关卡） | "继续作战"（primary variant）→ `start`，先进 **briefing** 再进 playing | ⚠️ 多了 briefing |

### 规范外多出的功能（"默认范围"未列）

- **「补给」按钮**（`menu.ts:82-90`）→ `openSupplies`，规范 §三 P2 "默认范围说明" 明确不含商城/任务，"补给"在 §七 没有显式排除但也未列入；规范不强制，但属规范外扩展。
- **「作战简报」中间屏 BriefingScreen**：规范从 HomePage 到 GamePage 是直接跳转，没有 briefing 中转屏。

### 缺失/偏差清单

- [ ] 金币图标 — P2
- [ ] 加桌/设为常用 按钮：当前是"奖励 + 加桌"复合按钮，规范期望"触发平台能力"为主，奖励侧应做成 toast 或独立路径 — P2
- [ ] 入口奖励：缺少"奖励内容弹窗"，当前直接调广告 — P1
- [ ] BriefingScreen 与规范的 Home → Game 直跳冲突 — P2（属架构差异，业务上可保留）

### 严重度：**P1**（基本结构齐全，但流程偏差需要修）

---

## 3. P3 游戏页（GamePage = PlayingScreen）

### 规范要求（§三 P3）

5 个区域：左上金币、右上设置、顶部其他信息、主棋盘、底部道具 ×2-3（必需）。

### 当前实现 vs 规范

| 区域 | 规范 | 当前实现（`playing.ts`） | 状态 |
|------|------|--------------------------|------|
| 左上角金币 | 文字 + 图标 | `coinText` 在顶部信息栏 x=430 y=88（**不是左上角，是右上**），无图标 | ⚠️ 位置/图标 |
| 右上角设置按钮 | "设置"按钮 | `createButton({x:560,y:130,...,label:'设置'})`（`playing.ts:127`），但 750 屏宽 x=560 算右侧，y=130 偏中，**不是真"右上角"**安全区 | ⚠️ 位置 |
| 顶部 HUD（关卡数/步数/分数/目标） | 由具体游戏自行设计 | chapter title + moves + target，齐全 | ✅ |
| 主棋盘 | 游戏画布 | 10×10 grid，PieceSprite 池，effects 层 | ✅ |
| 底部道具按钮 ×2-3 | **必需** | 3 个：炸开/吸走/重排（`playing.ts:57-61`） | ✅ |

### 道具按钮规则（关键 P0 差异）

规范明文（§三 P3）：

> - 库存 >0 时点击直接消耗使用
> - 库存 = 0 时点击触发激励视频广告（不再叠加"确认观看"二次弹窗），看完弹 toast 并获得使用机会
> - 按钮上需带广告标识（库存=0 状态），排版规则见 §2.4

当前实现（`controller.ts:403-422` `usePowerUp` + `playing.ts:389-398` `updatePowerUpButton`）：

- 库存 > 0：✅ 直接消耗使用
- 库存 = 0：**先尝试金币购买**（`purchasePowerUpWithCoins`），金币 ≥ `POWER_UP_COIN_COSTS[item]` 就直接扣金币购买 +1 库存；金币不足才走 `claimPowerUpItemFromAd` 调广告
- 库存 = 0 时按钮文案：**"60币炸开"**（`playing.ts:396`），不是广告标识
- 道具按钮 variant：默认 `'secondary'`（无 ad icon），即使触发的是广告也不显示广告标识图标

**结论：规则反了**，且缺广告标识。

### 棋盘交互（§三 P3）

规范：

> 推荐"按下 → 拖到相邻 → 松开"的滑动手势触发交换，与主流三消（消消乐、Candy Crush）一致；同时兼容"两次点击"作为后备

当前 `playing.ts:404-410` `handleBoardTap` 监听 `pointertap`，调 `cellAt(local.x, local.y)` 后 `dispatch tapCell`；controller `tapCell`（`controller.ts:292-337`）实现"两次点击"语义。

**未实现滑动手势**，规范允许 tap-to-swap 作为后备，所以严格说不违规，但"推荐"路径未做。

### 动画期间锁定（§三 P3）

规范：动画期间道具按钮必须忽略点击。

当前实现没看到道具按钮在 `presentation` 播放阶段被 disable 的逻辑，`updatePowerUpButton` 只改 label。这是一个潜在的 bug 风险——动画期间用户点道具按钮会进 `controller.usePowerUp`，但 `controller.usePowerUp` 自己没有 phase guard。**需要验证一遍**。

### 广告失败 toast 提示

规范 §三 P3 "交互逻辑"：广告加载失败需 toast 提示且不消耗道具。

当前 `claimPowerUpItemFromAd` 失败时 `this.feedback = outcome.feedback`，但 feedback 字段在 Pixi screen 里**没人读**（`grep "view.feedback" src/pixi` 零匹配）。

### 缺失/偏差清单

- [ ] 金币显示位置（应在左上角，且带图标） — P2
- [ ] 设置按钮位置（应在右上角真正的安全区） — P2
- [ ] **道具按钮 0 库存规则**：先广告而非先金币购买 — P0（与规范明确矛盾）
- [ ] **道具按钮 0 库存广告标识图标** — P0
- [ ] 滑动手势交互（推荐路径） — P2
- [ ] 动画期间锁定道具按钮 — P1（验证后判断）
- [ ] 广告失败 toast — P0（与 §2 Toast 系统缺失关联）

### 严重度：**P0**

道具按钮规则与规范明确矛盾，且涉及商业化（用户金币消费 vs 看广告分流），不能默认偏离。

---

## 4. P4 结算页（ResultPage = WonScreen + LostScreen）

### 规范要求（§三 P4）

#### 4.2 操作按钮区

| 元素 | 状态 |
|------|------|
| 下一关 | **仅通关时显示**，主 CTA |
| 重玩本关 | 失败 / 成功都显示 |
| 复活 / 继续 | **仅失败时显示**，看广告 → 复活 → toast |
| 分享按钮 | 分享给好友 / 朋友圈，分享奖励内容由游戏自定义 |
| 返回主页 | 次要按钮 |

### 当前实现 vs 规范

**WonScreen**（`result.ts:57-130`）：

| 按钮 | 规范要求 | 现状 | 状态 |
|------|---------|------|------|
| 下一关 | 主 CTA（仅通关） | ✅ variant='primary'，仅 WonScreen 有 | ✅ |
| 重玩本关 | 都显示 | ✅ | ✅ |
| 复活 | 仅失败时显示 | ✅ WonScreen 不显示 | ✅ |
| 分享 | 实接分享 SDK | "分享" → dispatch `shareReward` → controller 只 `feedback='分享功能由平台接管，请通过平台菜单分享'`（`controller.ts:207`），**没接入 SDK** | ❌ |
| 返回主页 | 次要按钮 | ✅ | ✅ |
| **奖励翻倍**（规范未列） | — | WonScreen 多了 "奖励翻倍"（ad variant）按钮，规范 §4 没有这个 | ⚠️ 规范外 |
| **关闭按钮** | §2.3 "所有弹窗必须含关闭按钮" | WonScreen 不是 modal（按规范结算页是独立 page），但视觉上叠在 playing 之上是 modal 行为；**没有显式关闭按钮** | ⚠️ |

**LostScreen**（`result.ts:135-171`）：

| 按钮 | 规范要求 | 现状 | 状态 |
|------|---------|------|------|
| 复活继续 | 看广告 → 复活 → toast | ✅ "复活继续" variant='ad' → `extraMovesAd`；**toast 缺失** | ⚠️ |
| 重玩本关 | 都显示 | ✅ | ✅ |
| 分享 | 实接分享 SDK | 同 WonScreen，未接入 | ❌ |
| 返回主页 | 次要按钮 | ✅ | ✅ |
| 下一关 | 失败时不显示 | ✅ 不存在 | ✅ |

### 缺失/偏差清单

- [ ] 分享按钮：未接入任何平台 share SDK，仅 toast"由平台接管" — P1
- [ ] 复活/翻倍/跳过等广告完成后的 toast 提示 — P0（与 §6 关联）
- [ ] 奖励翻倍按钮属规范外扩展 — P2（业务可保留）
- [ ] 结算页关闭按钮（依 §2.3 严格解读） — P2

### 严重度：**P1**

主体合规，主要缺 toast 和真实 share。

---

## 5. 通用规范（§2）

### 2.1 全局通用元素

| 项 | 规范 | 现状 | 状态 |
|----|------|------|------|
| 顶部状态栏 / 刘海屏 / 灵动岛安全区占位 | 必须 | `src/pixi/stage.ts` + screens 用固定坐标 (y=36, y=54, y=86 起步)；**没有读 safeArea / SystemInfo top inset 的逻辑** | ❌ P2 |
| 左上角金币 | 有金币机制就显示 | menu/playing 都有金币 text，但 menu 中 y=54、playing 中 x=430 位置不一致 | ⚠️ |

### 2.2 文字规范

| 项 | 现状 | 状态 |
|----|------|------|
| 所有用户可见文字简体中文 | 抽查 menu/levels/briefing/result/settings 文案均为简体中文 | ✅ |
| 禁用英文/繁体/生僻字 | 标签文字未见违例 | ✅ |
| 软著号 `SR` 前缀例外 | LoadingPage 不存在，无需例外 | n/a |

### 2.3 通用交互

| 项 | 规范 | 现状 | 状态 |
|----|------|------|------|
| Toast | 必须调用**平台原生 Toast 能力** | `PlatformAdapter` 接口（`platform/types.ts:33-45`）**完全没有 toast API**；controller 用 `feedback: string` 字段，screens 无任何消费者；vivo SDK `qg.showToast` 没有桥接 | ❌ **P0** |
| Dialog 黑色半透明背板 | 必须 | `result.ts:13` `createOverlayBackdrop` alpha=0.55；`settings.ts:26` 同 alpha=0.55 ✓ | ✅ |
| Dialog 关闭按钮 | 所有弹窗必须含 | paused/settings 有"关"按钮；won/lost 无显式关闭按钮；levels/supplies 用"返回"按钮代替（语义等价） | ⚠️ won/lost 严格说缺 |
| 点击背板关闭 | 各弹窗自定 | 全部未实现"点背板关闭"（PausedScreen 的 backdrop 是普通 Graphics，无 eventMode） | ✅（不强制） |

### 2.4 广告规范

| 项 | 规范 | 现状 | 状态 |
|----|------|------|------|
| 仅激励视频，不用 banner/插屏 | — | controller 只调 `platform.showRewardedAd`；mini-pack adapter 只暴露 `showRewardedVideo` | ✅ |
| 看广告按钮必须带广告图标 | 所有看广告按钮 | `button.ts` variant='ad' 的按钮自动加 `createAdIcon`（左侧）；**但 PlayingScreen 0 库存道具按钮 variant 是 secondary** | ❌ P0（道具按钮缺） |
| 广告图标与按钮主文案不重叠 | — | `button.ts:88-102` 计算 icon + label 的 contentWidth，左对齐排版，未见重叠 | ✅ |
| 点击直接调 SDK，不要"确认观看"二次弹窗 | — | `controller.requestRewardedAd` → `platform.showRewardedAd` 一步到位；**没有任何二次确认弹窗** | ✅ |
| 看广告流程结束统一弹 toast | 所有入口 | **零实现** —— controller 写 feedback string，Pixi 不显示；vivo SDK 桥接没有 toast | ❌ **P0** |

### 严重度：**P0**

Toast 整套系统不存在，广告完成提示是用户最直接的回执，必须接入。

---

## 6. 通用弹窗（§4）

### 4.1 设置弹窗（HomePage 与 GamePage 共用）

| 项 | 规范 | Home 显示 | Game 显示 | 现状 |
|----|------|----------|----------|------|
| 用户编号 | 7 位数字 | ✅ | ✅ | `settings.ts:94` `view.userId`，controller 生成 7 位（`controller.ts:100`） ✅ |
| 赞助按钮（广告） | ✅ | ✅ | ✅ | `settings.ts:62-66` variant='ad'，dispatch `requestRewardedAd` `type:'sponsor'` ✅；但完成后 toast 缺失 |
| 音乐开关 | ✅ | ✅ | ✅ | `settings.ts:42-46` ✅ |
| 音效开关 | ✅ | ✅ | ✅ | `settings.ts:48-52` ✅ |
| **返回桌面** | 平台能力，**退出小游戏到平台桌面** | ✅ | ✅ | 当前是 "返回主页" → `home`（回 menu），**不是退出小游戏**；`PlatformAdapter` 没有 exit API | ❌ P1 |
| 重新开始 | ❌ | ✅ | ✅ Game 时显示（`settings.ts:99-103`） | ✅ |
| 跳过本关（广告） | ❌ | ✅ | ✅ Game 时显示，variant='ad' | ✅（toast 缺失） |

**缺失：**
- 返回桌面：当前实现的是"返回主页"语义，规范要求"退出小游戏到平台桌面"——需要在 `PlatformAdapter` 上新增 `exitMiniGame()`，vivo 调 `qg.exitMiniProgram`，douyin 调 `tt.exitMiniProgram`。

### 4.2 入口奖励弹窗（仅抖音）

| 项 | 规范 | 现状 |
|----|------|------|
| 触发 | HomePage 入口奖励按钮 | ✅ MenuScreen 有按钮且仅抖音显示 |
| 行为 | **弹窗呈现奖励内容**，完成后弹 toast | ❌ 现在直接 dispatch `requestRewardedAd type:'extraMovesAd'`，无弹窗 |
| 非抖音平台 | 按钮不显示 | ✅ `view.platformName === 'douyin'` 判断 |

**缺失：**
- 入口奖励弹窗 screen 完全不存在 — P1
- 奖励发放后的 toast — P0（依赖 toast 系统）

### 4.3 关卡选择弹窗

| 状态 | 规范 | 现状（`levels.ts`） |
|------|------|--------------------|
| 已通关 | 点击可重玩 | ✅ `levelId <= highestLevel` 可点 → `selectLevel` → briefing |
| 当前关 | 点击直接开始 | ✅ 同上 |
| **未解锁** | **点击 → 看广告 → 解锁 → toast** | ❌ `levels.ts:83-84` 直接 `setLabel('未解锁')` + `setDisabled(true)`，**完全不可点** |

**缺失：**
- 未解锁关卡的"看广告解锁"功能完全没有 — P1（核心商业化路径）
- 解锁后 toast — P0（依赖 toast 系统）
- 未解锁关卡按钮的广告标识图标 — P0

---

## 7. 合规要素清单（§5）

启动加载页必须展示：

| 项 | 现状 |
|----|------|
| 适龄提示图标（CADPA 12+，左下角） | ❌ LoadingPage 不存在 |
| 软著登记号 | ❌ |
| 著作权人 | ❌ |
| 健康游戏忠告（标题 + 4 行 8 句固定文本） | ❌ |

**全部缺失。严重度：P0（监管）。**

---

## 8. 图片资源（§6）

| 资源 | 规范实现方式 | 现状 |
|------|------------|------|
| 适龄提示图标（CADPA 12+） | Canvas 矢量绘制（旧 `loadingScreen.ts.drawAgeRatingVector`） | 旧文件已删，**未在 Pixi 中重建**。需要查 `public-pack/assets/age-rating-12plus.png` 是否还在仓库（备用 PNG） |
| 广告标识图标 | Canvas 矢量绘制 | ✅ `src/pixi/ui/adIcon.ts` `createAdIcon` 走 Pixi `Graphics`（roundRect + 三角形），与旧 `drawAdVideoIcon` 等价 |

**备注：**
- 适龄图标矢量需要在 Pixi 中重画（参照旧 `loadingScreen.ts.drawAgeRatingVector` 实现：外框白底黑边 + 蓝色块 + 白字 "12+ / CADPA" + 黑字 "适龄提示"，100×128 px）— **需要查 git history 恢复 drawAgeRatingVector 实现**

---

## 9. 平台 SDK 集成

`PlatformAdapter`（`platform/types.ts`）当前接口：
`storage / login / request / showRewardedAd / addDesktopShortcut / showFavoriteGuide / didEnterFromSidebar / requestSidebarEntry / getLaunchContext / triggerHaptic`

### vivo 平台

| 能力 | 状态 | 备注 |
|------|------|------|
| 激励视频 SDK | **wired**（mini-pack runtime `ads.showRewardedVideo` → vivo `qg.createRewardedVideoAd`） | 实际是否通过验证需要查 `mini-pack/src/platforms/vivo/template.ts` 后半截、`channels/vivo/build/src/runtime-adapter/web-adapter.js` 实际生成结果 — **需要查 template.ts 200+ 行** |
| 音频 API | **wired**（`runtime.audio.playSfx/playMusic/stopMusic`） | mini-pack 抽象，vivo 端需 `qg.createInnerAudioContext`，需要查 template.ts |
| 加桌（addShortcut） | **partial**（`rewards.canAddDesktop/requestAddDesktop`） | runtime 抽象，vivo 真实 API 需要确认（vivo 是 `qg.installShortcut`） |
| 设为常用 | **partial**（`rewards.canAddFavorite/requestAddFavorite`） | 同上，vivo 是否有原生设为常用 API 需要查文档；vivo 本身没有"常用"概念，可能需要降级为不支持 |
| 分享 | **not wired** | `PlatformAdapter` 没有 share API；controller.shareReward 只 set feedback，vivo `qg.onShareAppMessage / qg.shareAppMessage` 没接入 |
| 登录态 | **wired** | `platform.login()` → vivo `qg.login` → 服务端换 openId（commit beea1f0 已做） |
| Toast | **not wired** | `PlatformAdapter` 无 `showToast`；vivo SDK 有 `qg.showToast`（参考 `vivo-client-api.zh-CN.md`） — **需要查 vivo API 文档**确认签名 |
| 返回桌面 | **not wired** | `PlatformAdapter` 无 `exitMiniGame`；vivo SDK 有 `qg.exitMiniProgram` — **需要查 vivo API 文档** |
| 振动 | **wired** | `triggerHaptic` ✓ |

### 抖音平台

`platform/douyin.ts` 实现较完整：login、request、createRewardedVideoAd、addShortcut、checkShortcut、showFavoriteGuide、navigateToScene、vibrateShort/Long、storage。但同样缺：
- ❌ `tt.showToast` 桥接
- ❌ `tt.exitMiniProgram` 桥接
- ❌ `tt.shareAppMessage` 桥接

### Web 平台

`platform/web.ts` 中绝大部分能力返回 `unsupported`，符合 dev 场景。同样缺 toast/exit/share。

---

## 10. 严重度统计

### P0（监管 / 商业化核心 / 规范明确矛盾）— **6 项**

1. P1 LoadingPage 完全缺失（含软著、CADPA、健康忠告） — §1 / §7
2. Toast 系统完全缺失（PlatformAdapter 无 API + screens 无消费者） — §5 / §6
3. 道具按钮 0 库存规则：当前先金币购买，规范要求先广告 — §3
4. 道具按钮 0 库存广告标识缺失 — §3 / §5
5. 关卡选择"未解锁关卡看广告解锁"功能完全没有 — §6
6. 关卡解锁 / 入口奖励 / 复活 / 跳关 / 翻倍 / 赞助 等所有看广告流程结束后都缺 toast — §3 / §4 / §5 / §6

### P1（功能性偏差 / 流程错误）— **8 项**

1. 入口奖励弹窗缺失（应弹窗呈现奖励内容，当前直接调广告） — §6
2. 关卡选择"看广告解锁"业务逻辑实现 — §6
3. 设置弹窗"返回桌面"应调用平台退出 API，当前是"返回主页" — §6
4. 分享按钮未接入平台 SDK（vivo/douyin 都缺） — §4
5. 广告失败 toast 反馈未消费 feedback string — §3 / §5
6. 动画期间锁定道具按钮（需验证） — §3
7. 加桌 / 设为常用按钮命名与行为偏离规范（"加桌领奖"复合行为 vs "加桌按钮"纯触发） — §2
8. won/lost 弹窗缺显式关闭按钮（按 §2.3 严格解读） — §4

### P2（细节 / 安全区 / 美化）— **5 项**

1. 顶部安全区占位（刘海/灵动岛） — §5
2. PlayingScreen 金币位置不在左上角，且无金币图标 — §3
3. PlayingScreen 设置按钮不在严格右上角 — §3
4. 棋盘滑动手势（推荐路径，当前仅 tap-to-swap） — §3
5. 规范外扩展（briefing 中转屏 / 补给入口 / 奖励翻倍按钮） — §2 / §4

---

## 10.5 字体 atlas 缺字 fallback（v2 待设计）

**背景：** 阶段 2 BitmapText + SDF 字体图集落地后，所有用户可见文字依赖 1008 字 atlas 字典渲染。atlas 之外的字符 BitmapText 会渲染为缺字方块（"豆腐字"）。

**约束：**
- 当前架构 = 产品内置文案静态字典（`scripts/scan-charset.mjs` + `docs/font-charset.txt`）
- **服务端 `remoteConfig.clientConfig` 下发任意文案 = atlas 之外的字会渲染失败**
- 后端约束/玩家昵称/邀请文案/活动公告 = 同样风险

**v1 兜底（必做，阶段 2 实施）：**
在 `src/pixi/ui/text.ts` BitmapText 包装层加 `ensureCharsInAtlas(text)`：
1. 遍历每个字符 → 查 `BitmapFont.available[fontName].chars[ch]`
2. 不在 atlas 的字符替换为 `·`（中圆点，ASCII 必有）
3. 缺字列表 `console.warn('[bitmap-text] missing chars in atlas: %s (text="%s")', missing.join(''), text)` 给开发看
4. **绝不让玩家看到缺字方块**

**v2 待设计（不在本期）：**
- 服务端任意文案的真正 fallback —— 可能方案：fallback 到 Canvas2D 渲染（但 vivo `fillText` alpha 10/255 bug 仍要绕开，见 `docs/vivo-quirks.md`）
- 或：服务端文案严格限制在固定字典内（与后端约定）
- 或：动态 SDF 生成（运行时按需补字到 atlas，复杂度高）

当前严格限制：**所有 UI 文案在 atlas 字典内**（产品内置文案 + 用户已批准的 Q2/Q3 预扩字符）。

---

## 10.6 资源加载路径统一规范（前导斜杠红线） — P2

**背景：** 2026-05-13 真机灌包后发现 `Assets.load('/fonts/main.fnt')` 在 vivo runtime 上 404 → atlas 加载失败 → 撞回 fillText alpha bug → 全屏文字深色。根因是 vivo `qg.request` 把前导斜杠路径当 `https://<domain>/path` 网络请求处理。

**约束（新规范）：**
- ✅ 所有 `Assets.load` / `Texture.from` / `new Audio(src)` / `loadAudio` / `loadImage` 等资源路径必须用**相对路径**（不带前导 `/`）
- ❌ `Assets.load('/fonts/main.fnt')` —— 禁止
- ❌ `new Audio('/audio/x.wav')` —— 禁止
- ✅ `Assets.load('fonts/main.fnt')` —— 正确
- ✅ `new Audio('audio/x.wav')` —— 正确

**已落地（本期）：**
- [x] `src/pixi/renderer.ts` atlas 加载路径去前导斜杠
- [x] `src/audio/soundAssets.ts` 9 个音效 + bgm 路径去前导斜杠
- [x] `src/pixi/renderer.ts` atlas 加载 try/catch 增加 message/stack/cause/raw/fontUrl 完整错误透出
- [x] `docs/vivo-quirks.md` "资源加载 - 前导斜杠" 段
- [x] `verify:browser` 工作流：build → vite preview → headless chromium → assert atlas loaded console + 0 error + 截图（补齐 e2e jsdom 与真机之间缺失的浏览器层）

**未来 grep 巡检（每个新平台接入前跑一次）：**
```bash
grep -rn "Assets.load\|Loader.load\|Texture.from\|new Audio\|loadAudio" src/ | grep "'/"
# 期望输出为空。
```

---

## 11. 待查清的不确定项

以下项目我没有 100% 把握，需要在动手前补查：

1. **vivo `qg.showToast` API 签名** — 需要查 `vivo-client-api.zh-CN.md`（仓库根有这个文件，但未在本次审计中读取） 或 vivo 官方文档
2. **vivo `qg.exitMiniProgram` API** — 同上
3. **vivo 是否有"设为常用"原生 API** — vivo 快游戏跟微信"添加到我的小程序"概念不一定对齐
4. **vivo 加桌真实 API**（是 `qg.installShortcut` 还是 `qg.hasShortcutInstalled` + `qg.installShortcut`）— 需要查文档
5. **`public-pack/assets/age-rating-12plus.png` 是否还在仓库** — Phase 1 迁移后 publicDir 是 `public-pack`，资源可能被保留
6. **旧 `src/render/loadingScreen.ts` 的 `drawAgeRatingVector` 实现** — 需要从 git history `git show c28971a:games/gonglian-fangxian/game/src/render/loadingScreen.ts` 取回参考
7. **mini-pack vivo template 的 `web-adapter.js` 实际生成内容** — `template.ts` 后半部分没读，激励视频 / 音频 / 加桌的真实接入点在那里
8. **PlayingScreen 道具按钮在动画期间是否锁定** — 需要看 `presentation.boardFor` 返回的 board 状态推断 controller 是否会拒绝 tap

---

## 12. 修复路线建议（待你确认优先级后再启动）

不在本次审计输出范围内，仅供参考决策：

- **第 1 步（P0 监管）** 新建 LoadingScreen，恢复 CADPA + 软著号 + 健康忠告 + 进度条；恢复 drawAgeRatingVector 矢量绘制
- **第 2 步（P0 toast）** 在 `PlatformAdapter` 加 `showToast(message: string)`，vivo/douyin/web 三端各自桥接；controller `feedback` 改走 `platform.showToast`；所有广告完成路径统一调
- **第 3 步（P0 道具按钮）** 改 `controller.usePowerUp` 路径：0 库存先广告，去掉金币购买；UI 改 variant='ad'
- **第 4 步（P1 关卡解锁）** LevelsScreen 未解锁关卡支持点击 → 广告 → 解锁 → toast
- **第 5 步（P1 入口奖励弹窗）** 抖音平台新建独立 modal screen
- **第 6 步（P1 返回桌面 / 分享）** `PlatformAdapter` 加 `exitMiniGame` / `share` API，三端桥接
- **第 7 步（P2 细节）** 安全区、金币位置、棋盘滑动手势

每步建议都先小修小测，避免一次性大改导致 vivo 真机回归。

---

*审计结束 — 请确认优先级与修复范围后再开始动代码。*
