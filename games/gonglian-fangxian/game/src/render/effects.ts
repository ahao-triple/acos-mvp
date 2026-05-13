import { clamp01, easeOutCubic } from './animation';

export interface Particle {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
}

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  scale: number;
}

interface ParticleState {
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  startMs: number;
  durationMs: number;
}

interface TextState {
  text: string;
  x: number;
  y: number;
  color: string;
  startMs: number;
  durationMs: number;
}

export class EffectsModel {
  private readonly particles: ParticleState[] = [];
  private readonly texts: TextState[] = [];
  private random: () => number;

  constructor(
    private readonly maxParticles = 80,
    seed = 1,
  ) {
    this.random = createSeededRandom(seed);
  }

  burst(x: number, y: number, color: string, nowMs: number, count = 7): void {
    const allowed = Math.max(0, Math.min(count, this.maxParticles - this.particles.length));

    for (let index = 0; index < allowed; index += 1) {
      const angle = (Math.PI * 2 * index) / allowed + this.random() * 0.35;
      const speed = 58 + this.random() * 62;
      this.particles.push({
        startX: x,
        startY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + this.random() * 4,
        color,
        startMs: nowMs,
        durationMs: 720 + this.random() * 260,
      });
    }
  }

  floatText(text: string, x: number, y: number, color: string, nowMs: number): void {
    this.texts.push({
      text,
      x,
      y,
      color,
      startMs: nowMs,
      durationMs: 1320,
    });
  }

  particlesAt(nowMs: number): Particle[] {
    const result: Particle[] = [];

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      const progress = clamp01((nowMs - particle.startMs) / particle.durationMs);
      if (progress >= 1) {
        this.particles.splice(index, 1);
        continue;
      }

      const eased = easeOutCubic(progress);
      result.push({
        x: particle.startX + particle.vx * eased,
        y: particle.startY + particle.vy * eased,
        radius: particle.radius * (1 - progress * 0.35),
        color: particle.color,
        alpha: 1 - progress,
      });
    }

    return result.reverse();
  }

  textsAt(nowMs: number): FloatingText[] {
    const result: FloatingText[] = [];

    for (let index = this.texts.length - 1; index >= 0; index -= 1) {
      const text = this.texts[index];
      const progress = clamp01((nowMs - text.startMs) / text.durationMs);
      if (progress >= 1) {
        this.texts.splice(index, 1);
        continue;
      }

      const pop = progress < 0.2 ? 0.75 + easeOutCubic(progress / 0.2) * 0.35 : 1.1 - (progress - 0.2) * 0.12;
      result.push({
        text: text.text,
        x: text.x,
        y: text.y - easeOutCubic(progress) * 76,
        color: text.color,
        alpha: progress < 0.55 ? 1 : 1 - (progress - 0.55) / 0.45,
        scale: pop,
      });
    }

    return result.reverse();
  }

  backgroundParticles(width: number, height: number, nowMs: number, count = 18): Particle[] {
    const particles: Particle[] = [];

    for (let index = 0; index < count; index += 1) {
      const base = seeded(index + 31);
      const drift = ((nowMs / (6500 + base * 4000)) + base) % 1;
      const x = (seeded(index * 17 + 7) * width + Math.sin(nowMs / 1800 + index) * 18) % width;
      const y = height - drift * (height + 120);

      particles.push({
        x,
        y,
        radius: 1.5 + seeded(index * 19 + 11) * 2.5,
        color: index % 3 === 0 ? '#9fded5' : index % 3 === 1 ? '#b9d7ff' : '#f9d38a',
        alpha: 0.16 + seeded(index * 23 + 5) * 0.18,
      });
    }

    return particles;
  }
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function seeded(seed: number): number {
  const value = Math.sin(seed * 999.91) * 43758.5453;
  return value - Math.floor(value);
}
