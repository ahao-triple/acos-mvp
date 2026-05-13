/**
 * 特效渲染层：消除粒子 burst / 浮字 floatText / 屏幕震动 + 背景粒子。
 *
 * 数据源：src/render/effects.ts 的 EffectsModel —— 状态计算工具，提供 particlesAt(nowMs) /
 * textsAt(nowMs) / backgroundParticles(...)。EffectsLayer 是该模型的 Pixi 渲染表达。
 *
 * 渲染策略：
 *  - particles：Graphics 每帧 clear + redraw（粒子上限 80，circle 几何足够轻）
 *  - texts：Text 池，按 index 复用，多余的 visible=false 隐藏
 *  - bgParticles：单独 Graphics，每帧 clear + redraw（粒子数 ~18）
 *  - shake：trauma-style 衰减（easeOutCubic），update() 返回 {x,y} 由消费方自己应用到容器
 *
 * 屏幕震动设计：
 *  - 不直接动 stage.root（root 是 fitLogicalCanvas 的 scale/offset 容器，动它会破坏命中坐标）
 *  - 由 PlayingScreen 拿到 shakeOffset 后赋到自己 container 内的 game/effects 层 position
 *
 * 注意：本层只负责把 EffectsModel 数据渲染出来，不做关卡逻辑判断。
 * burst/floatText/shake 的触发由 PlayingScreen 在 update 里调用。
 */
import { Container, Graphics, Text } from 'pixi.js';
import { EffectsModel } from '../../render/effects';

const FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const MAX_TEXT_POOL = 16;

interface ShakeState {
  startedMs: number;
  durationMs: number;
  amplitude: number;
  seed: number;
}

export class EffectsLayer {
  readonly container = new Container();
  readonly model: EffectsModel;

  private readonly bgParticlesGfx = new Graphics();
  private readonly particlesGfx = new Graphics();
  private readonly textPool: Text[] = [];
  private readonly textsContainer = new Container();
  private shake: ShakeState | null = null;

  constructor(maxParticles = 80, seed = 1) {
    this.container.label = 'effects';
    this.model = new EffectsModel(maxParticles, seed);
    // 子层顺序：背景粒子（最底） → 主粒子 → 浮字（最顶）。
    this.container.addChild(this.bgParticlesGfx);
    this.container.addChild(this.particlesGfx);
    this.container.addChild(this.textsContainer);

    for (let i = 0; i < MAX_TEXT_POOL; i += 1) {
      const t = new Text({
        text: '',
        style: {
          fontFamily: FONT_FAMILY,
          fontSize: 32,
          fontWeight: '700',
          fill: 0xffd166,
          align: 'center',
        },
      });
      t.anchor.set(0.5, 0.5);
      t.visible = false;
      this.textPool.push(t);
      this.textsContainer.addChild(t);
    }
  }

  burst(x: number, y: number, color: string, nowMs: number, count = 7): void {
    this.model.burst(x, y, color, nowMs, count);
  }

  floatText(text: string, x: number, y: number, color: string, nowMs: number): void {
    this.model.floatText(text, x, y, color, nowMs);
  }

  /**
   * 触发屏幕震动。amplitude 像素 / durationMs 毫秒。
   * 后续 trigger 会覆盖前一次（不叠加）。
   */
  triggerShake(amplitude: number, durationMs: number, nowMs: number, seed = Math.random() * 1000): void {
    this.shake = { startedMs: nowMs, durationMs, amplitude, seed };
  }

  /**
   * 每帧调用，渲染 effects + 推进 shake，返回当前 shake 偏移。
   * 消费方把偏移赋给 game/effects 容器的 position 即可。
   */
  update(nowMs: number): { x: number; y: number } {
    this.renderParticles(nowMs);
    this.renderTexts(nowMs);
    return this.computeShakeOffset(nowMs);
  }

  /**
   * 单独渲染背景粒子（菜单/战斗都可调）。粒子数据由 EffectsModel.backgroundParticles 算。
   * 不在 update 里自动调，避免不需要 bg 的 screen 也跑。
   */
  renderBackgroundParticles(width: number, height: number, nowMs: number, count = 18): void {
    const particles = this.model.backgroundParticles(width, height, nowMs, count);
    const g = this.bgParticlesGfx;
    g.clear();
    for (const p of particles) {
      g.circle(p.x, p.y, p.radius).fill({ color: parseHexColor(p.color), alpha: p.alpha });
    }
  }

  /** screen 切走时清掉 effects 状态，避免重新进入时回放过期粒子。 */
  reset(): void {
    // EffectsModel 内部 particles/texts 数组没有清空 API；最简单的做法是新构造一个。
    // 但 PlayingScreen 直接持有 EffectsLayer 实例，下次进 PlayingScreen 时仍是同一个。
    // 实测：particles/texts 的 progress >=1 时 particlesAt/textsAt 自动 splice，自然过期。
    // 所以 reset 只清渲染产物（graphics + 文字隐藏），不动 model。
    this.particlesGfx.clear();
    this.bgParticlesGfx.clear();
    for (const t of this.textPool) {
      t.visible = false;
    }
    this.shake = null;
  }

  dispose(): void {
    this.container.destroy({ children: true });
  }

  private renderParticles(nowMs: number): void {
    const particles = this.model.particlesAt(nowMs);
    const g = this.particlesGfx;
    g.clear();
    for (const p of particles) {
      g.circle(p.x, p.y, p.radius).fill({ color: parseHexColor(p.color), alpha: p.alpha });
    }
  }

  private renderTexts(nowMs: number): void {
    const texts = this.model.textsAt(nowMs);
    // 复用 pool。多余的 text 隐藏。
    for (let i = 0; i < this.textPool.length; i += 1) {
      const slot = this.textPool[i];
      const data = texts[i];
      if (!data) {
        if (slot.visible) slot.visible = false;
        continue;
      }
      slot.visible = true;
      if (slot.text !== data.text) slot.text = data.text;
      slot.position.set(data.x, data.y);
      slot.alpha = data.alpha;
      slot.scale.set(data.scale, data.scale);
      slot.style.fill = parseHexColor(data.color);
    }
    // 超过 pool 上限的 floatText 直接丢弃（连消很少超过 16 个 floatText 同时存在）。
  }

  private computeShakeOffset(nowMs: number): { x: number; y: number } {
    const shake = this.shake;
    if (!shake) return { x: 0, y: 0 };

    const progress = clamp01((nowMs - shake.startedMs) / shake.durationMs);
    if (progress >= 1) {
      this.shake = null;
      return { x: 0, y: 0 };
    }

    const envelope = 1 - easeOutCubic(progress);
    const wave = progress * 28 + shake.seed * 2.399963;
    const amplitude = shake.amplitude * envelope;
    return {
      x: Math.sin(wave) * amplitude,
      y: Math.cos(wave * 1.37) * amplitude,
    };
  }
}

function parseHexColor(hex: string): number {
  const clean = hex.replace('#', '');
  return Number.parseInt(clean, 16);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function easeOutCubic(t: number): number {
  const x = 1 - t;
  return 1 - x * x * x;
}
