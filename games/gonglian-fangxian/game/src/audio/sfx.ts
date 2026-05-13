/**
 * SFX 合成器：纯 Web Audio API 实时合成，零文件依赖、零版权风险。
 *
 * 与 src/audio/soundEngine.ts 的关系：
 *  - soundEngine.ts 是 cue 驱动框架，通过 controller.emitAudio → viewState.audioCue 触发
 *    （button / select / invalid / win / lose / reward）—— 那部分保留不动
 *  - sfx.ts 是函数式直调 API，用于补 controller 不发的 cue（match / combo）
 *  - 两者共享 globalThis.AudioContext，但各自创建 oscillator，互不干扰
 *
 * 设计原则（应用户严格指令）：
 *  - 零文件下载、零版权风险
 *  - 不依赖任何 freesound / zapsplat / AI 生成音频
 *  - vivo 严格模式 / 无 AudioContext → 所有 play 函数 noop（静音兜底）
 *  - 每个 SFX < 200ms（不遮挡 UI 反馈）
 *  - 不同 SFX 用不同波形 + 频率，连击音频率随 combo 递增
 */

// 用 lib.dom 标准 AudioContext 类型；webkitAudioContext 是 Safari 兼容 fallback。
type AudioCtxCtor = new () => AudioContext;

let ctx: AudioContext | null = null;
let ctxInitTried = false;
let enabled = true;

function tryCreateContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  // AudioContext 是 globalThis 顶级类，不是 Window 实例属性；webkitAudioContext 在 window 上（Safari 兼容）
  const w = window as Window & { AudioContext?: AudioCtxCtor; webkitAudioContext?: AudioCtxCtor };
  const Ctor: AudioCtxCtor | undefined = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (ctxInitTried) return null;
  ctxInitTried = true;
  ctx = tryCreateContext();
  return ctx;
}

/** UI 设置 toggle 调这个；mute=true 时所有 sfx.* 立刻 noop。 */
export function setSfxEnabled(value: boolean): void {
  enabled = value;
}

/** 用户首次触摸后调一次，把 suspended context 解锁。SoundEngine 也会解锁同一 AudioContext。 */
export async function unlockSfx(): Promise<void> {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended' && typeof c.resume === 'function') {
    try { await c.resume(); } catch { /* ignore */ }
  }
}

interface ToneSpec {
  type: OscillatorType;
  freq: number;
  glideTo?: number;
  durationMs: number;
  gain: number;
  delayMs?: number;
}

function playTone(spec: ToneSpec): void {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  const start = c.currentTime + (spec.delayMs ?? 0) / 1000;
  const end = start + spec.durationMs / 1000;

  osc.type = spec.type;
  osc.frequency.setValueAtTime(Math.max(1, spec.freq), start);
  if (spec.glideTo) {
    osc.frequency.exponentialRampToValueAtTime?.(Math.max(1, spec.glideTo), end);
  }

  // attack 12ms / decay 到 0.0001
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(spec.gain, start + 0.012);
  g.gain.linearRampToValueAtTime(0.0001, end);

  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

// ─────────────────────────────────────────────────────────────────────────
// 公开 API（应用户指令命名）
// ─────────────────────────────────────────────────────────────────────────

/** 按钮点击。短促 sine glide。 */
export function playClick(): void {
  playTone({ type: 'sine', freq: 420, glideTo: 560, durationMs: 60, gain: 0.05 });
}

/** piece 消除。combo=1 是单次消除，combo>1 是连消同一动作内的多组消除。
 *  频率随 combo 递增：基频 440 + combo × 80Hz。 */
export function playMatch(combo: number = 1): void {
  const c = Math.max(1, Math.min(8, combo));
  playTone({
    type: 'sine',
    freq: 440 + c * 80,
    glideTo: 660 + c * 80,
    durationMs: 130,
    gain: 0.06,
  });
  // 第二音：上方泛音叠加，强化"清脆"感
  playTone({
    type: 'triangle',
    freq: 880 + c * 100,
    durationMs: 90,
    gain: 0.035,
    delayMs: 40,
  });
}

/** 连击。combo >= 2，频率递增更激进。 */
export function playCombo(combo: number): void {
  const c = Math.max(2, Math.min(8, combo));
  playTone({
    type: 'triangle',
    freq: 520 + c * 100,
    glideTo: 880 + c * 120,
    durationMs: 140,
    gain: 0.065,
  });
  playTone({
    type: 'sine',
    freq: 1040 + c * 150,
    glideTo: 1320 + c * 160,
    durationMs: 110,
    gain: 0.045,
    delayMs: 60,
  });
}

/** 道具使用：square 波尖锐 + 下降 glide。 */
export function playPowerUp(): void {
  playTone({ type: 'square', freq: 880, glideTo: 440, durationMs: 110, gain: 0.04 });
  playTone({ type: 'triangle', freq: 1320, durationMs: 100, gain: 0.03, delayMs: 50 });
}

/** 关卡通关：三音上行琶音。 */
export function playWin(): void {
  playTone({ type: 'triangle', freq: 523, durationMs: 110, gain: 0.06 });
  playTone({ type: 'triangle', freq: 659, durationMs: 110, gain: 0.06, delayMs: 90 });
  playTone({ type: 'triangle', freq: 784, durationMs: 160, gain: 0.06, delayMs: 180 });
  playTone({ type: 'sine', freq: 1175, durationMs: 180, gain: 0.04, delayMs: 200 });
}

/** 关卡失败：下行 sawtooth glide。 */
export function playLose(): void {
  playTone({ type: 'sawtooth', freq: 320, glideTo: 180, durationMs: 180, gain: 0.04 });
  playTone({ type: 'sine', freq: 220, glideTo: 140, durationMs: 160, gain: 0.03, delayMs: 100 });
}

/** 升级 / 解锁：明亮 sine 高音 + glide。 */
export function playLevelUp(): void {
  playTone({ type: 'sine', freq: 880, glideTo: 1320, durationMs: 130, gain: 0.055 });
  playTone({ type: 'triangle', freq: 1760, durationMs: 110, gain: 0.04, delayMs: 80 });
}

/** 按钮 hover —— 移动端无 hover 概念，保留 API 但 noop。 */
export function playButtonHover(): void {
  // 移动端 noop；PC dev mode 想要可改成轻短 tick
}
