import { describe, expect, it } from 'vitest';

import { feedbackCellMotion, feedbackProgress, hintPulse, revealMotion } from '../render/animation';

describe('render animation helpers', () => {
  it('normalizes feedback progress and marks expiry', () => {
    const animation = { kind: 'fly' as const, startedAtMs: 1000, durationMs: 400 };

    expect(feedbackProgress(animation, 900)).toEqual({ active: true, progress: 0 });
    expect(feedbackProgress(animation, 1200)).toEqual({ active: true, progress: 0.5 });
    expect(feedbackProgress(animation, 1500)).toEqual({ active: false, progress: 1 });
  });

  it('moves cleared arrows outward while fading them', () => {
    const motion = feedbackCellMotion('fly', 1, 0.5, 100);

    expect(motion.offsetX).toBeGreaterThan(40);
    expect(motion.offsetY).toBe(0);
    expect(motion.alpha).toBeLessThan(1);
    expect(motion.scale).toBeLessThan(1);
  });

  it('shakes invalid cells without fading them out', () => {
    const motion = feedbackCellMotion('shake', 0, 0.25, 100);

    expect(Math.abs(motion.offsetX)).toBeGreaterThan(0);
    expect(motion.offsetY).toBe(0);
    expect(motion.alpha).toBe(1);
  });

  it('pulses hint rings and reveal image over time', () => {
    expect(hintPulse(250, 1000).scale).toBeGreaterThan(1);
    expect(revealMotion(0).scale).toBeLessThan(1);
    expect(revealMotion(1)).toMatchObject({ scale: 1, alpha: 1 });
  });
});
