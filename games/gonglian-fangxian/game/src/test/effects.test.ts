import { describe, expect, test } from 'vitest';
import { EffectsModel } from '../render/effects';

describe('effects model', () => {
  test('creates capped burst particles and expires them', () => {
    const effects = new EffectsModel(12, 123);

    effects.burst(100, 200, '#ffffff', 0, 20);

    expect(effects.particlesAt(100)).toHaveLength(12);
    expect(effects.particlesAt(1300)).toHaveLength(0);
  });

  test('floating text moves upward and expires', () => {
    const effects = new EffectsModel(80, 123);

    effects.floatText('连击 x2', 100, 200, '#ffd166', 0);

    const active = effects.textsAt(300)[0];
    expect(active.text).toBe('连击 x2');
    expect(active.y).toBeLessThan(200);
    expect(effects.textsAt(1500)).toHaveLength(0);
  });

  test('background particles are deterministic', () => {
    const a = new EffectsModel(80, 99).backgroundParticles(750, 1334, 1000, 3);
    const b = new EffectsModel(80, 99).backgroundParticles(750, 1334, 1000, 3);

    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
  });
});
