# 共联防线 · 视觉升级方案（A/B/C 分级）

> 扫描对象：`games/gonglian-fangxian/game/src/pixi/` + `src/render/`（金币 / Briefing 已删的最新状态）
> 当前 bundle baseline：**624.39 KB / gzip 180.31 KB**
> jitter-loop fps baseline：≥ 50（vivo 严格模式，5 轮抖动 30 秒）
> 撰写日期：2026-05-13
> 当前依赖：**仅 `pixi.js ^8.18.1`**，未安装 `pixi-filters`

> **本文档只列方案。等用户勾选实施哪些后再动代码。**

---

## 1. 当前视觉短板诊断

下表是按"观感弱 → 提升空间大"排序，每条都给出引用位置与现状描述。

| # | 短板 | 位置 | 现状 |
|---|------|------|------|
| 1 | 按钮平 fill | `src/pixi/ui/button.ts:73-77` | `bg.roundRect(...).fill({ color: fillColor }).stroke(...)` 单色填充，无渐变 / 无高光 / 无阴影 |
| 2 | 主 CTA 与次按钮区分弱 | `button.ts:26-30` VARIANT_STYLES | primary=金黄、secondary=白、ad=橙，仅靠 fill 色区分；无尺寸 / 阴影 / 边光差异 |
| 3 | 选中 piece 高亮单薄 | `src/pixi/screens/playing.ts:140-146` `selectedGlow` + `:348-359` `renderSelectedGlow` | 一个 `Graphics roundRect + stroke`，alpha 0.88-0.96 脉冲，没有真发光（不溢出格子边缘） |
| 4 | 消除 piece 退场动画扁平 | `src/render/visualBoard.ts:118-124` | scale 1→0.08（`easeInOutSine`）、alpha 1→0、y 上飘 0.1*cellSize；**无旋转、无翻转、无 easeBack** |
| 5 | 棋盘背景 cellSlot 平色 | `src/pixi/screens/playing.ts:309-318` `bakeBoardBackground` | `slots.roundRect(...).fill({ color: 0xffffff, alpha: 0.12 }).stroke(...)` 平白半透明 |
| 6 | 连击 floatText 单调 | `src/render/effects.ts:71-79` + `src/pixi/effects/effectsLayer.ts:135-153` | `alpha + scale + position` 三个量插值，没有上飘弹性 / 旋转 / 颜色变化 |
| 7 | 大消除震动已有但视觉冲击仍弱 | `effectsLayer.ts:155-172` `computeShakeOffset` | trauma-style shake 已实现，但**没有背景闪光 overlay**配合 |
| 8 | piece 出生只用 easeBackOut 缩放 | `visualBoard.ts:88-90` | scale 0.72 → 1 with easeBackOut（已部分弹性）；非掉落版本无下落距离弹跳 |
| 9 | piece 单字标签略简陋 | `src/pixi/pieces/pieceSprite.ts:21-28` `PIECE_LABELS` | "盾/弹/雷/勋/扳/能" 单字 Text，旧版规划过 PNG icon 但 Phase 1 没接 |
| 10 | particle burst 只是同色圆点 | `effectsLayer.ts:126-132` | `circle(x, y, r).fill({ color, alpha })` 圆点，无拖尾 / 无大小变化 / 无星型 |

---

## 2. 升级方案分级

### A 类：低风险高回报（零新依赖，纯 pixi.js 内核 API）

| 编号 | 项目 | 描述 | 涉及文件 |
|------|------|------|---------|
| A1 | 主 CTA 按钮渐变 fill | `FillGradient`（pixi.js 内置）替换 `fill({ color })`：primary 用金黄→橙红垂直渐变；ad 用橙→深橙 | `button.ts` |
| A2 | secondary 按钮微渐变 | 白色按钮加 0xffffff→0xe5e7eb 微渐变 + 顶部高光线 | `button.ts` |
| A3 | 棋盘 cellSlot 渐变 | RT 烘焙时用 FillGradient 给每个 cell 加上→下的暗→亮渐变（alpha 0.06→0.18） | `playing.ts: bakeBoardBackground` |
| A4 | 选中 piece 多层 glow | 不引入 GlowFilter，用 4-5 层 `roundRect` 不同 alpha 叠出"溢出格子"的发光感（已有 `drawGlowBox` 思路） | `playing.ts: selectedGlow` |
| A5 | piece 退场旋转 + back 曲线 | `visualBoard.ts:120-123`：加 rotation tween（0 → ±0.6rad，easeOutQuad）、scale 用 easeBackIn 让"压缩感"更强 | `visualBoard.ts` + `pieceSprite.ts` 加 rotation 应用 |
| A6 | particle burst 升级 | 在 `effects.ts.burst` 里把粒子分 2 组：1 组大颗粒拖尾（alpha 衰减更慢、radius 变大）、1 组小颗粒短暴；保持上限 80 | `src/render/effects.ts` |
| A7 | floatText 上飘弹性 | "N 连消" 文字加 easeBackOut（前 0.2s scale 0→1.2→1 + 同时上飘 40px），颜色 hue 随连消数偏移 | `effects.ts` + `effectsLayer.ts` |
| A8 | piece 主体径向渐变 | `pieceSprite.redraw` 中心圆用 FillGradient 径向（亮色中心→暗边），代替当前平 fill + ellipse 高光 | `pieceSprite.ts` |

**A 类合计预计包体增量：** ≈ 0 KB（FillGradient / 多层 rect 都是 pixi.js 内置 API；tree-shake 已包含）

### B 类：中风险中回报（需要 `pixi-filters` 依赖 ≈ 30-80 KB）

| 编号 | 项目 | 描述 | 依赖 |
|------|------|------|------|
| B1 | 主 CTA DropShadowFilter | "继续作战 / 下一关 / 开始作战" 主按钮加 4-6 px 偏移 + blur 8 的投影；点击时 shadow 缩小制造按下感 | `pixi-filters/DropShadowFilter` |
| B2 | 选中 piece GlowFilter | 替换 A4 多层 rect 方案，用真 GlowFilter 在格子边缘溢出蓝/金光晕 | `pixi-filters/GlowFilter` |
| B3 | 大消除背景闪光 overlay | `≥5 消除` 时在 stage 上叠一帧白色 alpha 0.18 → 0 的 60ms 闪光（不依赖 filter，但和 shake 配合视觉冲击） | 纯 pixi（**可以并入 A 类**） |
| B4 | 连击数字 OutlineFilter | "超级连击 x5" 文字加 4 px 黑色描边，让大字号读起来更扎实 | `pixi-filters/OutlineFilter` |
| B5 | 通关 modal BlurFilter | WonScreen / LostScreen 弹出时给底层 playing 整层 blur 4 px，提升弹窗层级感 | `pixi-filters/BlurFilter`（Pixi 内置 `BlurFilter` 实际已在 pixi.js core，可能不要 pixi-filters） |
| B6 | piece "震动呼吸" AdjustmentFilter | 战斗紧张时（步数 ≤ 3）所有 piece 加饱和度 +10% 脉冲 | `pixi-filters/AdjustmentFilter` |

**B 类合计预计包体增量：**
- 全量 `pixi-filters` ≈ 80 KB gzip（≈ 220 KB 原始）
- tree-shake 后单 filter ≈ 5-15 KB gzip
- B3 不需要 filter（可并入 A）
- B5 用 pixi.js 自带 `BlurFilter`（无需 pixi-filters）

**vivo 严格模式风险：** filter 走 framebuffer pass，vivo runtime 上 WebGL framebuffer + Pixi Filter pipeline **未在真机验证过**。建议每加一个 filter 都跑一遍 jitter-loop e2e + 真机灌包，确认 fps 不跌、无 `drawElements failed`。

### C 类：高投入（需美术资源 / 改架构）

| 编号 | 项目 | 描述 | 投入 |
|------|------|------|------|
| C1 | piece 单字 → PNG icon | 美术出 6 个 piece kind 的 SVG/PNG（盾/弹/雷/勋/扳/能），改 `pieceSprite.ts` 用 Sprite 替代 Text label | 6 个 64×64 PNG ≈ 8 KB ×6 = 48 KB；或合并 atlas ≈ 24 KB |
| C2 | Spine 骨骼动画 | piece 消除时播放 Spine "爆炸" 动画（骨骼 + mesh deformation） | `@esotericsoftware/spine-pixi-v8` ≈ 100 KB gzip + .spine 资源每个 ≈ 30-80 KB |
| C3 | ParticleContainer 重构粒子 | 用 `ParticleContainer` 取代 `Graphics.circle`，支持 1000+ 粒子同屏，引入 texture-based particle（sparkle / star） | 不增加依赖，但要重写 `effectsLayer.ts` 约 100 行 + 准备 particle texture |
| C4 | piece 表情反馈 | 通关时 piece 弹跳庆祝、失败时 piece 摇头 —— 需要 piece 表情图集和帧动画系统 | 美术资源 + ~80 行帧动画系统 |
| C5 | 棋盘背景动态光带 | 沿棋盘对角线缓慢扫光（FillGradient + 时间偏移 maskGradient） | 纯 pixi 内置 API，**可并入 A 类**（A11） |

---

## 3. 性能预估

### 包体增量

| 方案 | 增量（gzip） | 增量（原始） | 说明 |
|------|-----------|-----------|------|
| A 全做 | **~0 KB** | ~0 KB | 都是 pixi.js 内置 API，已在 bundle 中 |
| B 全做（含 pixi-filters 全量） | **+80 KB** | +220 KB | 全量包大；tree-shake 单 filter ≈ 5-15 KB |
| B 仅 B1+B2+B5（tree-shake） | **+25-30 KB** | +60-80 KB | DropShadow + Glow + Blur（Blur 在 core，零增量） |
| B3 | 0 KB | 0 KB | 纯 pixi，已在 A 类 |
| C1 PNG atlas | **+24 KB** | +96 KB | 合并 atlas |
| C2 Spine | **+100-150 KB** | +280-400 KB | spine runtime + .spine 资源 |
| C3 ParticleContainer | **~0 KB** | ~0 KB | Pixi 内置，需 particle texture（+ 2-4 KB） |

预测 bundle 后续目标：
- 仅 A：**624 → ~625 KB**（实际可能略减，因为新代码替换旧代码）
- A + B1+B2+B5：**~650 KB**
- A + B 全量：**~705 KB**
- 加 C2：**~800 KB**（vivo 严格模式包体限制需要确认）

### 运行时 fps 风险（vivo 严格模式，jitter-loop 5 轮 30 秒）

| 方案 | fps 风险 | 说明 |
|------|---------|------|
| A 类 | **极低** | 多了几次 Graphics.fill / FillGradient 调用；每帧成本 < 0.5 ms，不会跌破 50 |
| A5 piece 旋转 | **低** | rotation 应用到 PieceSprite 容器，pivot 已对齐中心，每个 piece transform 多 1 个 sin/cos；100 个 piece × 60 fps ≈ 6000 三角函数/秒，可忽略 |
| A6 particle 升级 | **低** | 粒子上限仍是 80，只是分组，每帧渲染量不变 |
| A8 piece 径向渐变 | **中** | 100 个 piece 同时径向渐变；FillGradient 在 v8 中是 stop-based shader，每个 piece 多一次 shader uniform。理论 OK 但 vivo 真机未验证 |
| B1 DropShadowFilter | **中-高** | filter 走 framebuffer pass；4-5 个主 CTA 同时启用 = 4-5 个 RT。vivo 真机可能跌 5-10 fps |
| B2 GlowFilter（选中 piece） | **中** | 单 piece 启 filter，作用范围小，每帧 1 个 RT，开销可控 |
| B5 BlurFilter（modal blur） | **中-高** | 整层 playing blur，全屏 framebuffer 一次。modal 弹出瞬间可能掉帧，稳态后无影响（一次性） |
| B6 AdjustmentFilter（紧张呼吸） | **高** | 所有 piece 全屏 filter，每帧整屏 framebuffer。**不建议先做** |
| C2 Spine | **未知** | spine 骨骼计算 + mesh deformation，vivo WebGL 1 上需要单独 profile |
| C3 ParticleContainer | **正向** | 比 Graphics.circle 快（实例化渲染），1000+ 粒子也能跑 |

### vivo 严格模式 framebuffer 风险

@pixi/filters 系列依赖 RenderTexture 中转渲染。**当前 vivo 已知问题**：

- `dom-polyfill.ts` 已 stub `OffscreenCanvas`，但 Pixi filter 不需要 OffscreenCanvas，用普通 RenderTexture
- 真机未验证 `Pixi.Filter.apply()` 是否能在 vivo WebGL 1 上跑（vivo 严格模式禁用 WebGPU、`navigator.gpu = null`）
- `pixi-adapter.ts` 设置 `createCanvas` 走 `qg.createCanvas`，RT 也走这条路，需要确认 vivo 允许多个离屏 canvas

**先行动作建议**：B 类任何 filter 落地前，先做一个最小 PoC（单按钮 DropShadow），灌一次 vivo 真机验证 fps + 错误日志。

---

## 4. 推荐执行顺序

按"低风险 → 高风险"渐进，每段做完跑 `check:full` + 看 jitter-loop fps ≥ 50。

### 阶段 1：A 全量（无依赖增量）

执行 A1 → A8 全部。每完成 2-3 个跑一次 jitter-loop 看 fps。预期：
- fps ≥ 50 不变
- bundle ≈ 624-630 KB（无明显增长）
- 视觉提升：按钮立体感 / piece 退场更"爽"

### 阶段 2：B3 大消除背景闪光（白闪 overlay）

纯 pixi，无 filter 风险。归入 A 实际上可以。单独标 B3 是因为它属于 audit "表现力增强" 中的"消除时背景闪光 overlay" 一类。

### 阶段 3：B5 BlurFilter（modal 背景模糊）

`BlurFilter` 是 pixi.js core 自带，零依赖增量。但 modal 弹出一次全屏 RT 渲染，先单独验真机一次。

### 阶段 4：装 pixi-filters，做 B1 主 CTA DropShadow

引入依赖、tree-shake 验证。最小 PoC：仅给 1 个按钮加阴影，灌 vivo 真机 → 看 fps + 错误。OK 再扩展到所有主 CTA。

### 阶段 5：B2 GlowFilter（选中 piece）

如果 B1 在 vivo 上稳，B2 也安全（单 piece 范围小）。装 pixi-filters/GlowFilter 单独 tree-shake。

### 阶段 6：评估 C 类（美术资源就绪后再启动）

- C1 PNG icon：美术给到资源后再上
- C2 Spine：包体增量大，且 vivo runtime 验证未知，**至少推到 v1.1**
- C3 ParticleContainer：如果 A6 后粒子还想升级再做

### 评估闸点（每段结束）

```bash
pnpm check:full   # ts + 120 test + build + e2e (含 jitter-loop fps ≥ 50)
```

通过即可进下一段。jitter-loop fps 跌破 50 → 回滚上段改动，定位帧成本。

---

## 5. 不在本方案的内容

- **Toast 系统**（audit P0）：不属视觉表现升级，单独排期
- **LoadingPage**（audit P0）：单独的页面合规项，独立做
- **音频升级**：本方案只看视觉
- **棋盘滑动手势**（audit P2）：交互手势升级，独立做

---

*文档结束 — 请勾选要实施的项（如 A1 / A3 / A5 / B5 / B3）后我再动手。*
