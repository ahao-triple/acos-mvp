# Canvas Tap Gallery 30 关策划表

本文档用于开发团队落地 `TypeScript + Vite + Canvas` 版本。目标是制作一个竖屏 `750 x 1334` 逻辑分辨率的箭头揭图解谜游戏：玩家点击方向箭头，清空棋盘后揭示原创图片。  

本文档不使用原游戏图片，不记录资源获取过程，只定义我们自己的关卡配置、显示规则和图片生成要求。

## 0. 隐形引导设计原则

本项目的核心体验目标不是“让玩家读懂规则”，而是让玩家持续产生下一步操作。设计上要避免玩家停下来阅读、寻找、理解 UI 或等待系统切换。

核心循环：

```text
看见目标 -> 点击 -> 获得反馈 -> 看到新目标 -> 再点击
```

开发和关卡设计需要遵守以下原则：

| 原则 | 开发落地 |
|---|---|
| 引导长在游戏里 | 教学、提示、镜头、动效都发生在棋盘内，不做独立教学页 |
| 首次进入即开始 | 首次启动不进大厅，不要求点开始，加载后直接进入第 1 关 |
| 第一次交互极轻 | 只驱动第一次点击，不解释完整规则 |
| 通过模仿教学 | 首次手指动画指向唯一正确箭头，保证第一次点击成功 |
| 错误反馈轻 | 错误只用轻抖、短音效、阻塞感，不弹惩罚说明 |
| 一次只教一个概念 | 新机制只在需要时出现，不能提前堆规则 |
| 即时教学 | 玩家第一次失败、第一次卡住、第一次遇到新机制时才出现对应提示 |
| 镜头控制注意力 | 镜头移动不是炫技，而是把玩家带到下一个可操作区域 |
| 弱引导优先 | 自动提示只给注意力切入口，不直接替玩家解题 |
| Reveal 是主奖励 | 通关情绪释放来自完整图案揭晓，奖励数字延后出现 |
| 动效低存在感 | 动画要顺、轻、自然，目标是维持连续操作流 |

禁止事项：

- 首次进入先展示复杂主菜单。
- 用大段文字解释规则。
- 新机制提前说明但当前关卡用不到。
- 错误时弹出强惩罚或警告。
- 通关后立即弹窗盖住完整图案。
- 自动提示频繁闪烁，造成“系统在替我玩”的感觉。

## 1. 固定显示规格

### 1.1 逻辑分辨率

| 项 | 值 |
|---|---:|
| 逻辑宽度 | `750` |
| 逻辑高度 | `1334` |
| 设计方向 | 竖屏 |
| 渲染方式 | Canvas 按 `750 x 1334` 绘制，再等比缩放到实际屏幕 |
| 背景 | 轻色渐变或纯色，由代码绘制 |

Canvas 适配规则：

```ts
const DESIGN_WIDTH = 750;
const DESIGN_HEIGHT = 1334;
const scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
const canvasCssWidth = DESIGN_WIDTH * scale;
const canvasCssHeight = DESIGN_HEIGHT * scale;
```

### 1.2 页面区域

| 区域 | 坐标建议 | 用途 |
|---|---|---|
| 顶部状态区 | `x=0, y=0, w=750, h=150` | 关卡号、体力、金币/奖励、设置按钮 |
| 关卡信息区 | `x=0, y=150, w=750, h=78` | 关卡标题、Moves、进度 |
| 棋盘安全区 | `x=45, y=235, w=660, h=660` | 箭头格、隐藏图片、遮罩 |
| 反馈层 | `x=0, y=210, w=750, h=720` | 飞出动画、提示高亮、爆炸/磁铁/冻结特效 |
| 底部道具区 | `x=45, y=980, w=660, h=160` | Hint / Bomb / Magnet / Hammer / Freeze |
| 底部操作区 | `x=45, y=1160, w=660, h=110` | 继续、广告按钮、失败/胜利按钮 |

棋盘以 `660 x 660` 为最大显示框。实际网格根据关卡 `width/height` 计算单元格尺寸并居中：

```ts
const BOARD_BOX = { x: 45, y: 235, size: 660 };
const gap = 4;
const maxAxis = Math.max(level.board.width, level.board.height);
const cellSize = Math.floor((BOARD_BOX.size - gap * (maxAxis - 1)) / maxAxis);
const boardPixelWidth = level.board.width * cellSize + (level.board.width - 1) * gap;
const boardPixelHeight = level.board.height * cellSize + (level.board.height - 1) * gap;
const offsetX = BOARD_BOX.x + (BOARD_BOX.size - boardPixelWidth) / 2;
const offsetY = BOARD_BOX.y + (BOARD_BOX.size - boardPixelHeight) / 2;
```

### 1.3 棋盘镜头系统

棋盘渲染需要独立的镜头状态。镜头只作用于棋盘安全区和反馈层，不影响顶部状态区、底部道具区和弹窗。

```ts
export interface BoardCameraState {
  scale: number;
  x: number;
  y: number;
  minScale: number;
  maxScale: number;
  isDragging: boolean;
}
```

镜头规则：

| 行为 | 规则 |
|---|---|
| 初始镜头 | 默认完整显示棋盘，`scale = 1`，棋盘居中 |
| 拖拽移动 | 当 `scale > 1` 时允许单指拖拽棋盘 |
| 双指缩放 | 移动端支持 pinch zoom，以双指中点为缩放中心 |
| 双击缩放 | 双击在 `1x` 和 `1.8x` 之间切换，以点击点为中心 |
| 滚轮缩放 | 桌面调试支持滚轮缩放，正式移动端可保留但不展示提示 |
| 缩放边界 | `minScale = 1`，`maxScale = 2.2` |
| 拖拽边界 | 棋盘不能被拖到完全离开 `660 x 660` 安全区 |
| 自动归位 | 切关、失败重开、通关揭图时恢复初始镜头 |
| 教学限制 | 关卡 1-2 禁用拖拽和缩放，避免新手误触 |
| 大棋盘开放 | 从关卡 6 开始允许拖拽，从关卡 11 开始允许缩放 |

道具和提示可以临时接管镜头：

- 主动 Hint：镜头平滑移动到推荐箭头附近，轻微放大到 `1.35x`，高亮结束后回到玩家当前镜头。
- 自动弱提示：只在候选区域已在可视区时播放轻脉冲；如果候选区域不在可视区，则先轻微移动镜头。
- Magnet：使用前可把镜头移动到可发挥最大效果的一排/一列。
- 通关揭图：镜头恢复 `1x`，隐藏图完整居中展示。

## 2. 关卡配置格式

开发侧建议使用以下 TypeScript 类型作为第一版配置格式：

```ts
export type ArrowDirection = 0 | 1 | 2 | 3; // 0 up, 1 right, 2 down, 3 left

export type CellKind =
  | "normal"
  | "golden"
  | "timer"
  | "bomb"
  | "locked"
  | "secret";

export interface LevelCell {
  index: number;
  direction: ArrowDirection;
  kind?: CellKind;
  unlockGroup?: number;
}

export interface LevelConfig {
  id: string;
  levelNo: number;
  title: string;
  maskImage: string;
  revealImage: string;
  thumbnail: string;
  board: {
    width: number;
    height: number;
    allowPan?: boolean;
    allowZoom?: boolean;
    initialZoom?: number;
  };
  moves: number;
  cellsTarget: number;
  mechanics: string[];
  idleHintDelayMs?: number;
  guidance?: {
    firstTapIndex?: number;
    introCue?: "none" | "tap" | "moves" | "hint" | "bomb" | "locked" | "timer" | "secret";
    weakHintEnabled?: boolean;
    revealFocus?: boolean;
  };
  cells: LevelCell[];
  pixels?: number[];
}
```

说明：

- `index = row * width + col`。
- `maskImage` 用于轮廓采样、生成格子和低成本运行时遮罩，不作为通关展示图。
- `revealImage` 是玩家通关后看到的高精度原创插画，也用于图鉴收藏。
- `cellsTarget` 是策划期目标箭头数量，真正配置生成后以 `cells.length` 为准。
- `pixels` 用于图片分区揭示，可由图片轮廓采样生成；MVP 阶段可以先不使用。
- `secret` 表示初始隐藏方向，点击/提示后显示。
- `locked` 表示锁区内箭头，需要满足 `unlockGroup` 对应条件后解锁。
- `allowPan` / `allowZoom` 用于控制关卡是否开放镜头移动和缩放。
- `idleHintDelayMs` 用于自动提示系统，前 5 关建议更短，后续关卡更长。
- `guidance.firstTapIndex` 用于首次教学或新机制教学，必须指向一个保证可成功的格子。
- `guidance.introCue` 表示本关需要即时教学的概念；没有新概念时为 `none`。
- `guidance.weakHintEnabled` 控制是否允许自动弱提示，教学关默认开启。
- `guidance.revealFocus` 控制通关后是否把镜头留给完整图片展示，默认开启。

## 3. 图片资产生成规范

每关需要两层图片资源：配置轮廓图和最终展示图。轮廓图服务关卡生成，最终展示图服务通关情绪释放和图鉴收藏。

| 资产 | 建议尺寸 | 格式 | 用途 |
|---|---:|---|---|
| `maskImage` | `1024 x 1024` | PNG，透明背景 | 轮廓采样、网格配置、遮罩参考 |
| `revealImage` | `1024 x 1024` | PNG，透明背景 | 通关后完整展示、Gallery 收藏 |
| `thumbnail` | `256 x 256` | PNG，透明背景 | 关卡列表/Gallery |

`maskImage` 规则：

- 轮廓必须清晰，适合切成网格。
- 色块可以简化，服务可读性和配置生成。
- 允许使用程序化图形。
- 当 `revealImage` 已经先生成出来时，`maskImage` 应优先由 `revealImage` 的透明轮廓和低频色块反推生成，避免配置轮廓和最终展示图不一致。

`revealImage` 规则：

- 高精度原创 2D 收藏插画，不使用原游戏图片。
- 明亮、圆润、精致，有清晰材质、光影和层次。
- 主体中心构图，占画布 `72% - 84%`。
- 轮廓仍然清晰，缩小到 `660 x 660` 棋盘区也能辨认。
- 画面要有“通关奖励感”，不能像占位图或简单图标。
- 不要文字、Logo、品牌符号。
- 透明背景；不要地面、投影背景或复杂场景。
- 每张图要能在 `660 x 660` 棋盘框中完整显示。

最终展示图生成 prompt 模板：

```text
Create an original premium 2D mobile puzzle game collectible illustration of [SUBJECT],
transparent background, centered composition, clean readable silhouette,
rounded appealing shapes, polished casual game art, rich but simple color layers,
soft global illumination, subtle rim light, gentle highlights, crisp edges,
no text, no logo, no watermark, no border, no floor shadow,
subject fills about 78 percent of the canvas,
designed to be revealed as the final reward after clearing a grid puzzle.
```

## 4. 隐形教学节奏

教学按“需要时再出现”处理。每个阶段只引入一个新概念，且必须在玩家刚遇到该问题时触发。

| 触发时机 | 引入概念 | 表现方式 |
|---|---|---|
| 第 1 次进入 | 点击箭头 | 手指动画指向唯一正确箭头，轻提示 `Tap`，不解释规则 |
| 第 1 次成功点击 | 箭头会飞走 | 飞出动画、清空格闪光、底图露出一点 |
| 第 1 次接近清空 | Reveal 目标 | 图片露出比例明显提高，让玩家理解“清空会揭图” |
| 第 1 次错误点击 | 规则边界 | 目标格轻抖、箭头回弹，不弹窗 |
| 第 1 次停顿 | 自动弱提示 | 一个可点击箭头轻脉冲，必要时镜头轻移 |
| 第 1 次 Moves 紧张 | Moves | Moves 数字轻闪，不弹解释 |
| 第 1 次卡住 | 主动 Hint | 底部 Hint 按钮轻闪，可免费使用一次 |
| 第 1 次锁区 | 解锁区域 | 锁区显示进度，例如 `3 left`，不提前说明 |
| 第 1 次计时 | 时间压力 | 计时格入场动效，时间数字轻跳 |
| 第 1 次隐藏箭头 | Secret | 问号格轻翻面，Hint 可揭示方向 |

前 5 关只服务基础理解，不追求难度。玩家应该在几乎不读文字的情况下完成：

```text
点击 -> 消除 -> 露图 -> 清空 -> 完整揭晓 -> 下一关
```

## 5. 30 关难度曲线

整体分 6 组，每组 5 关。

| 关卡 | 分组 | 设计目标 |
|---|---|---|
| 1-5 | 新手教学 | 学会点击、消除、Reveal、轻错误、主动 Hint |
| 6-10 | 基础解谜 | 增加网格和方向冲突，在第 10 关引入 Bomb |
| 11-15 | 区域控制 | 引入 locked area，再引入 golden cell |
| 16-20 | 时间压力 | 先引入 timer，再引入 magnet 和 freeze |
| 21-25 | 信息隐藏 | 先引入 secret arrow，再引入 hammer |
| 26-30 | 综合挑战 | 混合机制，形成正式难度峰值 |

## 6. 30 关策划表

| 关卡 | ID | 主题 | 网格 | 目标箭头数 | Moves | 机制 | 图片适配要求 |
|---:|---|---|---:|---:|---:|---|---|
| 1 | `level_001_strawberry` | 草莓 | `6 x 6` | 18 | 45 | `tutorial`, `infiniteEnergy` | 大块红色主体，顶部叶片清晰，作为首关奖励图要最容易识别 |
| 2 | `level_002_star_medal` | 星形奖章 | `7 x 6` | 26 | 60 | `normal` | 五角星+圆章，外轮廓简单，金黄/蓝色对比 |
| 3 | `level_003_rocket` | 火箭 | `7 x 8` | 32 | 70 | `normal`, `directionConflict` | 竖向火箭，主体细长但不能太窄，火焰可作为底部色块 |
| 4 | `level_004_paint_palette` | 调色盘 | `8 x 8` | 40 | 85 | `hintIntro` | 圆角调色盘，多个清晰色块，孔洞不要太小 |
| 5 | `level_005_ice_cream` | 冰淇淋 | `8 x 9` | 45 | 95 | `wrongMoveFeedback` | 蛋筒+球形冰淇淋，上宽下窄，轮廓清楚 |
| 6 | `level_006_suitcase` | 旅行箱 | `9 x 9` | 52 | 105 | `normal` | 方形箱体，提手明显，适合规则网格 |
| 7 | `level_007_camera` | 相机 | `9 x 10` | 58 | 115 | `wrongMovePenalty` | 横向相机，镜头大圆，边角圆润 |
| 8 | `level_008_cupcake` | 纸杯蛋糕 | `10 x 10` | 64 | 125 | `hint` | 上部奶油、下部杯托，色块分层明显 |
| 9 | `level_009_kite` | 风筝 | `10 x 11` | 70 | 135 | `directionConflict` | 菱形风筝，尾带简化，主体不要太细 |
| 10 | `level_010_gift_box` | 礼物盒 | `10 x 12` | 78 | 150 | `bombIntro` | 方盒+蝴蝶结，适合引入炸弹清区 |
| 11 | `level_011_sunflower` | 向日葵 | `11 x 11` | 76 | 145 | `lockedAreaIntro` | 大圆花盘+花瓣，花瓣合并成大色块 |
| 12 | `level_012_robot_head` | 机器人头盔 | `11 x 12` | 84 | 160 | `lockedArea` | 方圆头盔，眼睛区域清晰，科技感但不复杂 |
| 13 | `level_013_hot_air_balloon` | 热气球 | `12 x 12` | 92 | 175 | `lockedArea`, `twoUnlockGroups` | 上大下小，气球条纹可作为分区 |
| 14 | `level_014_teapot` | 茶壶 | `12 x 13` | 100 | 185 | `lockedArea`, `hint` | 壶身圆润，壶嘴和把手加粗，避免细碎边缘 |
| 15 | `level_015_compass` | 指南针 | `13 x 13` | 108 | 200 | `lockedArea`, `goldenIntro` | 圆形指南针，指针粗，金色格适配中心区域 |
| 16 | `level_016_skateboard` | 滑板 | `13 x 14` | 116 | 215 | `bomb`, `golden` | 横向滑板，轮子简化，主体足够厚 |
| 17 | `level_017_castle` | 城堡 | `14 x 14` | 124 | 225 | `timerIntro` | 中轴对称城堡，大块墙体，塔尖不要过细 |
| 18 | `level_018_pineapple` | 菠萝 | `14 x 15` | 132 | 240 | `bomb`, `timer` | 椭圆主体+顶部叶冠，菱格纹理简化为大块 |
| 19 | `level_019_lighthouse` | 灯塔 | `15 x 15` | 142 | 255 | `magnetIntro`, `timer` | 竖向灯塔，斜条纹粗，底座稳定 |
| 20 | `level_020_umbrella` | 雨伞 | `15 x 16` | 152 | 270 | `freezeIntro`, `timer` | 半圆伞面+短柄，伞面分区清楚 |
| 21 | `level_021_train_front` | 火车头 | `16 x 16` | 164 | 285 | `secretIntro` | 正面火车头，圆灯和窗户简化，适合隐藏方向 |
| 22 | `level_022_potion_bottle` | 魔法瓶 | `16 x 17` | 176 | 300 | `secret`, `hint` | 透明瓶可做成实色瓶身，液体大色块，避免半透明细节 |
| 23 | `level_023_music_note` | 音符徽章 | `17 x 17` | 186 | 315 | `hammerIntro`, `secret` | 大音符+圆形底章，线条加粗，避免细杆太窄 |
| 24 | `level_024_paper_lantern` | 纸灯笼 | `17 x 18` | 198 | 330 | `lockedArea`, `secret` | 圆灯笼，横向分层，顶部底部挂件简化 |
| 25 | `level_025_astronaut_helmet` | 宇航头盔 | `18 x 18` | 210 | 350 | `timer`, `freeze`, `secret` | 圆形头盔+深色面罩，轮廓完整，适合高难遮罩 |
| 26 | `level_026_treasure_chest` | 宝箱 | `18 x 19` | 224 | 365 | `bomb`, `magnet`, `hammer` | 方形箱体，金属边框粗，锁孔大 |
| 27 | `level_027_crown` | 王冠 | `19 x 19` | 238 | 380 | `multiLockedArea`, `golden`, `secret` | 王冠主体加厚，尖角不要过细，宝石为清晰色块 |
| 28 | `level_028_mountain_cabin` | 山间小屋 | `19 x 20` | 250 | 400 | `timer`, `lockedArea`, `golden` | 小屋+山形背景，主体集中，背景做简化层次 |
| 29 | `level_029_fireworks_badge` | 烟花徽章 | `20 x 20` | 265 | 420 | `secret`, `timer`, `bomb`, `freeze` | 圆形徽章内烟花，烟花不要细线，改成粗色块爆点 |
| 30 | `level_030_trophy_tower` | 奖杯高塔 | `21 x 21` | 280 | 450 | `finalMix`, `lockedArea`, `secret`, `timer`, `allBoosters` | 大奖杯+底座，纵向构图，中心高光明显，最终关视觉最强 |

## 7. 每组开发要求

### 7.1 关卡 1-5

- 不需要复杂障碍。
- 允许开发先手工配置，确保点击反馈和清空胜利闭环稳定。
- 第 1 关开启 `infiniteEnergy`，失败不扣体力。
- 第 4 关预置 Hint，但不要开局强教；玩家第一次停顿或卡住后，Hint 按钮轻闪并免费使用 1 次。

### 7.2 关卡 6-10

- 增加方向冲突：不是所有箭头都能随便点。
- 第 7 关开始错误点击扣 Moves 或触发错误反馈。
- 第 10 关引入 Bomb，道具效果为清除目标格周围半径 1 的可清除箭头。

### 7.3 关卡 11-15

- 引入 locked area。
- 锁区表现：半透明遮罩+锁图标，由 Canvas 绘制。
- 解锁条件：清除指定数量普通箭头后解锁。
- 第 15 关引入 golden cell，清除后给额外奖励或额外 Moves。

### 7.4 关卡 16-20

- 引入 timer cell 和限时压力。
- timer cell 被清除时增加剩余时间或停止局部倒计时。
- 第 19 关引入 Magnet，可清除一个方向上的连续箭头。
- 第 20 关引入 Freeze，可暂停计时 `5s`。

### 7.5 关卡 21-25

- 引入 secret arrow：初始不显示方向，只显示问号或背面。
- Hint 可以揭示一个 secret arrow 的方向。
- Hammer 可以强制清除一个目标箭头，不做路径阻挡判断。

### 7.6 关卡 26-30

- 混合 locked、secret、timer、golden 和多个道具。
- 每关至少有 2 个可选道具策略。
- 第 30 关作为阶段终局，允许更长 Moves 和更强视觉奖励。

## 8. 提示系统

游戏需要两套提示：主动 Hint 和自动弱提示。两者可以共用候选分析，但设计意图不同：主动 Hint 可以给明确答案，自动弱提示只负责维持注意力和操作节奏。

### 8.1 主动 Hint

主动 Hint 是玩家点击底部 Hint 按钮触发的道具型提示。

| 项 | 规则 |
|---|---|
| 入口 | 底部道具区 `Hint` 按钮 |
| 消耗 | 优先消耗 Hint 库存；库存不足时可看广告获得 1 次 |
| 可用关卡 | 第 4 关开始出现，第 4 关免费 1 次 |
| 目标选择 | 优先选择当前合法可点击箭头；若存在关键解锁/道具格，优先推荐 |
| 表现 | 镜头先移动到目标附近，再让目标格外圈发光，箭头轻微跳动 |
| 持续时间 | `1800ms - 2400ms` |
| 操作限制 | 高亮期间仍允许玩家点击，点中目标立即结束提示 |
| Secret 处理 | 如果目标是 `secret`，主动 Hint 可直接揭示方向 |

主动 Hint 的推荐算法优先级：

1. 能解锁 locked area 的箭头。
2. 能清除 golden/timer/bomb 特殊格的箭头。
3. 当前可点击且路径最长的箭头。
4. 当前可点击且靠近玩家最近操作区域的箭头。

### 8.2 自动弱提示

自动弱提示是体验引导型提示，不消耗道具。它不是“告诉答案”，而是给玩家一个注意力切入口，避免大棋盘迷失和节奏停滞。

| 项 | 规则 |
|---|---|
| 触发 | 玩家无操作达到 `idleHintDelayMs` |
| 默认延迟 | 关卡 1-5：`5000ms`；关卡 6-15：`8000ms`；关卡 16 后：`11000ms` |
| 消耗 | 不消耗道具，不触发广告 |
| 目标选择 | 优先选择“可观察区域”或“可点击候选”，不必总是最优答案 |
| 表现 | 候选区域轻微呼吸、短暂描边、弱手指动画，不使用强高亮 |
| 镜头 | 候选区域在可视区内时不移动镜头；不在可视区时缓慢移动到附近 |
| 频率限制 | 每次自动提示后至少 `7000ms` 内不重复触发 |
| 禁用场景 | 飞行动画、道具动画、弹窗、失败/胜利结算期间禁用 |
| 教学关 | 第 1 关自动提示可以更强，允许显示手指动画 |

自动弱提示不能替玩家消除箭头，也不能频繁给同一个格子强闪。它和主动 Hint 的区别必须在 UI 上保持清楚：主动 Hint 是按钮和库存，自动弱提示只是棋盘内的轻量注意力引导。

### 8.3 全局提示扩展

全局提示不是 MVP 必做，但需要在架构上预留：

- 适用于大棋盘或后期复杂关。
- 触发后镜头先缩小查看整体，再移动到关键区域。
- 可作为广告奖励或高级道具。
- 和主动 Hint 共用推荐算法，但表现更强。

## 9. 首次进入游玩流程

首次进入目标是让玩家尽快理解“点击箭头 -> 清空棋盘 -> 揭示图片”的核心闭环。不要先进入复杂大厅或图鉴，也不要让玩家感到“现在开始教学”。Loading、Tutorial、第 1 关和 UI 展示需要融合在同一个连续流程里。

### 9.1 首次启动状态

| 项 | 初始值 |
|---|---|
| 当前关卡 | `level_001_strawberry` |
| 体力 | 满体力 `5/5` |
| Hint | `1`，但第 1 关不展示库存压力 |
| Bomb/Magnet/Hammer/Freeze | 锁定，不显示或置灰 |
| 镜头 | `scale=1`，禁止拖拽和缩放 |
| 广告 | 第 1 关不主动弹广告入口 |

### 9.2 第一次进入流程

1. 加载基础资源，显示简短 loading；loading 结束时不要切到主菜单。
2. 第 1 关棋盘直接从 loading 后淡入，玩家感觉还在进入游戏，但实际已经可操作。
3. 顶部和底部 UI 先弱显示，避免一开始抢注意力。
4. 棋盘居中，隐藏图片被箭头格遮住。
5. 显示极轻文字 `Tap` 或 `Tap to continue`，同时手指动画指向一个必定可点击的箭头。
6. 玩家点击正确箭头后，箭头按方向飞出并消失，底图露出一小块。
7. 手指动画和轻文字消失，允许玩家自由点击。
8. 如果玩家 `5s` 不操作，触发自动弱提示，只做轻脉冲或手指轻点。
9. 清空最后一个箭头后，不立刻弹窗；先让完整图片形成并停留 `800ms - 1200ms`。
10. 播放轻庆祝动效，奖励和 Continue 按钮渐入。
11. 点击 Continue 后镜头轻推进或横向过渡到第 2 关，不进入关卡列表。

### 9.3 前 5 关引导节奏

| 关卡 | 引导重点 | UI/系统限制 |
|---:|---|---|
| 1 | 点击箭头、清空揭图 | 禁用体力消耗、禁用镜头、禁用广告 |
| 2 | 箭头方向和阻挡关系 | 禁用镜头，开启轻量错误反馈 |
| 3 | Moves 概念 | 显示 Moves，但失败惩罚仍较轻 |
| 4 | 主动 Hint | 第一次卡住后 Hint 按钮轻闪，免费使用 1 次 |
| 5 | 错误移动反馈 | 引导玩家理解不可点箭头和失败条件 |

第 1 次失败处理：

- 如果发生在第 1 关，只显示“再试一次”按钮，不扣体力。
- 如果发生在第 2-5 关，允许免费重试 1 次。
- 从第 6 关开始按正式体力和广告续关规则执行。

第 1 次进入不展示：

- 关卡列表。
- Gallery/Collections。
- Daily/活动入口。
- 商店、订阅、去广告。
- 多按钮弹窗。

这些系统在玩家完成核心闭环后再逐步出现。

## 10. 动效、错误反馈与 Reveal

### 10.1 基础动效

动效目标是维持连续操作流，不追求强刺激。所有动效都应短、轻、可连续点击。

| 动效 | 时长建议 | 表现 |
|---|---:|---|
| 箭头点击按下 | `80ms - 120ms` | 轻缩放、轻变亮 |
| 箭头飞出 | `220ms - 360ms` | 沿方向飞出，带轻微拖尾 |
| 格子消失 | `120ms - 180ms` | alpha 淡出，底图露出 |
| 可点击弱提示 | `900ms - 1200ms` | 轻呼吸，不强闪 |
| 错误反馈 | `180ms - 260ms` | 格子轻抖，箭头回弹 |
| 道具命中 | `300ms - 600ms` | 局部特效，不遮挡全棋盘 |
| 通关揭图 | `800ms - 1200ms` | 镜头归位，遮罩退去，完整图停留 |

### 10.2 错误反馈

错误反馈只建立规则边界，不惩罚玩家情绪。

允许：

- 目标格轻微左右抖动。
- 箭头短暂变暗或回弹。
- Moves 数字轻跳一次。
- 很短的低压音效。

禁止：

- 大红字 Warning。
- 失败前频繁弹窗解释。
- 第一次错误直接扣体力。
- 中断当前操作流的大提示框。

### 10.3 Reveal 通关流程

Reveal 是主要爽点，通关结算不能抢在图片前面。

通关流程：

```text
最后一个箭头飞出
-> 最后一块遮罩消失
-> `revealImage` 完整居中显示
-> 轻庆祝动效
-> 奖励数字渐入
-> Continue 按钮出现
```

要求：

- `revealImage` 至少停留 `800ms` 后再出现奖励。
- 通关当下展示的是高精度最终插画，不展示 `maskImage` 或程序化配置图。
- 胜利面板不能遮住图片主体。
- Continue 按钮出现前，玩家应已经看清完整图片。
- 进入下一关时尽量用镜头推进或轻过渡，不做黑屏切换。

## 11. 体力与广告规则

MVP 只实现必要商业化逻辑，不做复杂商店。

体力和广告也遵守即时出现原则：玩家没有失败、没有缺资源、没有主动请求道具时，不主动弹广告或商店入口。

| 规则 | 建议值 |
|---|---:|
| 最大体力 | 5 |
| 普通失败消耗 | 1 |
| 第 1 关失败消耗 | 0 |
| 体力自然恢复 | 每 10 分钟恢复 1 点 |
| 看广告恢复体力 | +1 或补满，按接入方能力配置 |
| 每关广告续关次数 | 1 |
| 看广告获得 Hint | +1 |
| 看广告获得 Bomb | +1，关卡 10 后开放 |

出现时机：

- 第 1-5 关不主动展示广告入口。
- 第一次失败后，只展示免费重试；从第 6 关开始才展示广告续关。
- Hint/Bomb 广告只在库存不足且玩家主动点击道具时出现。
- 体力广告只在体力不足或失败后需要继续时出现。
- 不在通关 Reveal 前打断玩家。

广告接入在开发环境中先做 mock：

```ts
export interface AdProvider {
  showRewardedAd(reason: "restore_energy" | "continue_level" | "get_hint" | "get_bomb"): Promise<boolean>;
}
```

返回 `true` 时发放奖励，返回 `false` 时只关闭弹窗，不发奖励。

## 12. 关卡生成流程

建议流程：

1. 确认 30 关主题表。
2. 生成高精度 `revealImage`，用于通关展示和图鉴。
3. 基于 `revealImage` 的 alpha 轮廓和低频色块反推 `maskImage`。
4. 对 `maskImage` / `revealImage` 轮廓采样，生成初始 `pixels` 和候选 `cells`。
5. 按表中的网格、目标箭头数和机制手工微调。
6. 基于 `revealImage` 生成 `thumbnail`。
7. 跑可解性检查，确保所有普通关卡都能清空。
8. 导出 `src/data/levels/level-001.ts` 到 `level-030.ts`，或先落到 JSON 配置供开发转换。
9. 生成 `src/data/levels/index.ts` 汇总。

初始可解性检查规则：

- 每个可点击箭头沿方向飞出时，如果路径上遇到未清除箭头或 locked cell，则该箭头当前不可点击。
- 每次清除一个箭头后重新计算可点击集合。
- 若存在至少一条清除序列能清空所有非锁定/已解锁箭头，则关卡可解。
- 对含 Bomb、Hammer、Magnet 的关卡，检查器允许消耗对应道具。

## 13. 文件命名约定

```text
assets/levels/masks/level-001-strawberry-mask.png
assets/levels/reveal/level-001-strawberry.png
assets/levels/thumbs/level-001-strawberry-thumb.png
assets/levels/masks/level-002-star-medal-mask.png
assets/levels/reveal/level-002-star-medal.png
assets/levels/thumbs/level-002-star-medal-thumb.png

src/data/levels/level-001.ts
src/data/levels/level-002.ts
src/data/levels/index.ts
```

道具图标：

```text
assets/ui/icon-energy.png
assets/ui/icon-hint.png
assets/ui/icon-bomb.png
assets/ui/icon-magnet.png
assets/ui/icon-hammer.png
assets/ui/icon-freeze.png
assets/ui/icon-ad.png
```

## 14. 待确认项

在进入图片生成和配置落地前，需要确认：

1. 30 个主题是否都接受，是否需要替换其中任意主题。
2. 难度是否偏休闲，还是要更像硬核解谜。
3. Moves 是否作为硬限制，还是只作为星级评分依据。
4. 是否要在 MVP 中开放全部 5 个道具，还是先只做 Hint、Bomb、Hammer。
5. 图片风格是否统一为“明亮 2D 卡通透明 PNG”。
6. 镜头缩放是否从第 11 关开放，还是更早开放。
7. 自动提示的默认延迟是否接受当前分段值。
8. 首次进入是否确认采用“直接进第 1 关，不进主菜单”的流程。
9. 通关后是否确认先完整 Reveal，再渐入奖励和 Continue。
