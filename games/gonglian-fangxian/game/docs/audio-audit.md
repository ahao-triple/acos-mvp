# 共联防线 · 音效诊断与修复审计

> 扫描对象：`games/gonglian-fangxian/game/src/`
> 撰写日期：2026-05-13
> 当前依赖：仅 `pixi.js ^8.18.1`，未引入任何音频库
> 当前音频资源：`game/public-pack/audio/` 含 `bgm.mp3 + button/select/invalid/match/combo/reward/win/lose .wav`（**历史遗留，本次不引入新文件、不删除**）

---

## 1. 现有音频架构（已存在）

`src/audio/soundEngine.ts` 已经实现了一套 cue 驱动的音频引擎：

```
controller.emitAudio(type) → viewState.audioCue { type, id } 
  → main.ts audioTick(每 50ms 轮询) → soundEngine.play(cue, enabled)
    → tryPlayAsset (优先) → HTMLAudioElement / runtime.audio.playSfx
    → fallback: scheduleTone (Web Audio 合成，SOUND_PROFILES 8 种波形)
```

`SOUND_PROFILES`（`soundEngine.ts:69-97`）已经为 8 种 cue 类型定义了 Web Audio 合成参数（频率、波形、glide、duration、gain）：
`button / select / invalid / match / combo / win / lose / reward`

**框架已存在，缺的是 emit 调用链 + 平台兼容性兜底。**

---

## 2. 事件 → 应有音效 → 当前是否有 对照表

|---|------|---------|--------|----------------|----------------|------|
| 1 | 按钮点击（任何 dispatch action） | `button` | ✅ | ✅ | ❌ 静音 | controller.ts:124 `emitAudio('button')` |
| 2 | piece 选中 | `select` | ✅ | ✅ | ❌ 静音 | controller.ts:283 |
| 3 | piece 交换被拒绝 | `invalid` | ✅ | ✅ | ❌ 静音 | controller.ts:297 |
| 4 | **piece 消除（match）** | `match` | ❌ **从未 emit** | ❌ | ❌ | controller.tapCell **没有 emit match**，应在 `next.lastEvents.some(e => e.type === 'clear')` 时触发 |
| 5 | **连击 2/3/4/5+（combo）** | `combo` | ❌ **从未 emit** | ❌ | ❌ | controller.ts:328-330 只 emit visualCue 不 emit audio |
| 6 | 道具激活 | `reward` | ✅ | ✅ | ❌ 静音 | controller.ts:468/489 activateOwnedPowerUp / applyActivePowerUp |
| 7 | 道具看广告获得 | `reward` | ✅ | ✅ | ❌ 静音 | controller.ts:468 watchedAd=true |
| 8 | 关卡通关 | `win` | ✅ | ✅ | ❌ 静音 | controller.ts:302 tapCell win |
| 9 | 关卡失败 | `lose` | ✅ | ✅ | ❌ 静音 | controller.ts:305 |
| 10 | 广告完成（加桌/常用/侧边栏/复活/跳关） | `reward` | ✅ | ✅ | ❌ 静音 | controller.ts:365/375/503/510/517/535 |
| 11 | Modal 弹出（设置/补给/关卡） | `button` | ✅ | ✅ | ❌ 静音 | dispatch 入口统一 emit button |
| 12 | Modal 关闭 | `button` | ✅ | ✅ | ❌ 静音 | 同上 |
| 13 | tapCell 错误捕获 | `invalid` | ✅ | ✅ | ❌ 静音 | controller.ts:314 |
| 14 | **章节切换提示** | （未定） | ❌ | ❌ | ❌ | controller.startLevel 添加 console.log 占位，未来配 Toast 时一并处理 |
| 15 | BGM 背景音乐 | （未做） | ⚠️ 文件存在但可能 fail | ⚠️ runtime.audio.playMusic | ⚠️ 同左 | **本次任务标 TODO，不做** |

### 浏览器一栏的 ⚠️ 实际状况

测试中 (`vitest run`) `Not implemented: HTMLCanvasElement's getContext()`——`@vitest/browser` 不实现 audio，但生产 chromium 上 HTMLAudioElement + AudioContext 都可用。
**实际浏览器静音风险：** 用户必须先有交互（autoplay policy），SoundEngine.unlock() 监听 pointerdown 后才解锁；首次按钮点击前的 cue 会丢。

### vivo 严格模式静音原因

- `src/platform/vivo/dom-polyfill.ts` 没补 `AudioContext` / `webkitAudioContext` 全局 → `createBrowserAudioContext()` 返回 null
- `dom-polyfill.ts` 把 `Audio` 全局 stub 成空类 → `new Audio()` 不会真播
- mini-pack `runtime.audio.playSfx` 通过 `qg.createInnerAudioContext` 播 wav 文件——理论可用，但需要 wav 文件已被打到 .rpk 内（当前已存在）

vivo 真机实际是否有音：依赖 mini-pack vivo template 的 audio 桥接，**未在真机验证过**。审计 §11 第 7 项已经标记 "mini-pack vivo template 的 web-adapter.js 实际生成内容" 需要查。

---

## 3. vivo Web Audio API 兼容性查询结果

仓库内 `vivo-client-api.zh-CN.md` **只讲登录 API**，完全不含音频 API 文档。

`grep -i "AudioContext|OscillatorNode|createOscillator|webaudio" vivo-client-api.zh-CN.md` → **零匹配**

**vivo runtime 提供的音频 API：** `qg.createInnerAudioContext()`（来自 `mini-pack/src/platforms/vivo/template.ts:303`），这是**文件播放接口**，接受 `src` 加载并播放 wav/mp3 文件，**不是 Web Audio API（AudioContext / OscillatorNode）**。

**结论：** vivo 不能保证支持 `window.AudioContext`，本次任务 **vivo 端走静音 fallback**，不引入新音频文件。

---

## 4. 修复方案

### 4.1 新建 `src/audio/sfx.ts`（按用户指令）

函数式 SFX API，纯 Web Audio API 合成，零文件依赖：

```ts
// 用户可见 API（外部业务侧直接 import 调用）
playClick()
playMatch(combo?: number)
playCombo(combo: number)
playPowerUp()
playWin()
playLose()
playLevelUp()
playButtonHover()      // 移动端 noop
setSfxEnabled(bool)    // 静音开关
```

实现细节：
- `getAudioContext()` 单例 + lazy 初始化
- vivo 严格模式 / 无 `window.AudioContext` 时 → 返回 null → 所有 play 函数 noop
- 每次 play 创建新的 `OscillatorNode + GainNode`，attack/decay 包络
- 持续时间 < 200 ms（不遮挡 UI）
- 不同 SFX 用不同波形 + 频率（参考用户给的样例风格）
- 连击音 `playMatch(combo)` 频率随 combo 递增（基频 + combo × 80Hz）

### 4.2 业务侧接入

- **补 match 事件**：`PlayingScreen.update` 在 `changes.removed.length > 0` 时直接 `sfx.playMatch(changes.removed.length)`
- **补 combo 事件**：`PlayingScreen.handleVisualCue` 在 cue.type='combo' 时 `sfx.playCombo(cue.combo)`
- 其他事件（button / select / invalid / win / lose / reward）保留现有 `controller.emitAudio` + soundEngine 链路（已工作）

- 旧链路（cue 驱动）：button/select/invalid/win/lose/reward — 已工作
- 新链路（函数直调）：match/combo — 任务 5.2 新增

### 4.3 BGM TODO

- `SoundEngine.syncMusic` 当前在浏览器上会尝试播 `/audio/bgm.mp3`、在 mini-pack 上调 `runtime.audio.playMusic`
- 用户指令 5.4："BGM 一律不做，音乐开关 no-op"
- **决策**：保留 `src/audio/soundAssets.ts` MUSIC_ASSET 配置不动；在 `SoundEngine.syncMusic` 内部加 early return 让所有平台 BGM no-op；UI 设置弹窗的"音乐开关"保留显示 + 内部不发声
- **后续 TODO**：需要采购或获 CC0 授权 BGM 后，去掉 syncMusic 的 early return 即可恢复

### 4.4 vivo 静音兜底

- `sfx.ts` 的 `getAudioContext()` 检测 `window.AudioContext === undefined` 时返回 null，所有 sfx.* 调用 noop（不抛错）
- 现有 `SoundEngine.tryPlayAsset / scheduleTone` 链路在 vivo 上也已经 noop（asset player 找不到 `Audio` 全局返 null；Web Audio context 找不到 AudioContextCtor 返 null）
- vivo 端 **维持现状静音**，不引入版权文件

---

## 5. 不在本方案的内容

- **不删除** 现有 `game/public-pack/audio/*.wav` 历史遗留文件（不属于"引入"）
- **不引入** 任何新音频文件
- **不接入** AI 生成 / freesound / zapsplat 等
- **不做** vivo 端的 wav 文件播放路径（即便能用 `qg.createInnerAudioContext`），保持 vivo 静音

---

## 6. 实施 checklist（任务 5.2 跟进项）

- [ ] 新建 `src/audio/sfx.ts`（getAudioContext + 7 函数 + enabled 开关）
- [ ] `PlayingScreen.update` 调用 `sfx.playMatch(removed.length)`
- [ ] `PlayingScreen.handleVisualCue` cue.type='combo' 时调用 `sfx.playCombo(cue.combo)`
- [ ] sfx 开关与 `view.save.soundEnabled` 同步（main.ts 或 PlayingScreen 处理）
- [ ] `SoundEngine.syncMusic` 加 early return（BGM no-op）
- [ ] 浏览器 dev 手测点完所有按钮 console 无 audio error
- [ ] 静音开关切换：UI 设置里关音效后，所有 sfx.* 调用真静音
- [ ] e2e jitter-loop 跑 30s 抖动消除 fps ≥ 50（SFX 高频调用不掉帧）

---

*文档结束 — 任务 5.2 按 §6 checklist 实施。*
