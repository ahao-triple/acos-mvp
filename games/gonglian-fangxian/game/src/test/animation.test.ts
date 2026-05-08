import { describe, expect, test } from 'vitest';
import { clamp01, easeBackOut, easeInOutSine, easeOutCubic, sampleTween, tweenNumber } from '../render/animation';

describe('animation helpers', () => {
  test('clamps progress to 0..1', () => {
    expect(clamp01(-0.4)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(1.4)).toBe(1);
  });

  test('easing functions keep stable endpoints', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeInOutSine(0)).toBe(0);
    expect(easeInOutSine(1)).toBe(1);
    expect(easeBackOut(0)).toBe(0);
    expect(easeBackOut(1)).toBeCloseTo(1);
  });

  test('samples numeric tweens with easing and completion state', () => {
    const tween = tweenNumber(10, 30, 100, 300, easeOutCubic);

    expect(sampleTween(tween, 50)).toEqual({ value: 10, done: false });
    expect(sampleTween(tween, 400)).toEqual({ value: 30, done: true });
    expect(sampleTween(tween, 250).value).toBeGreaterThan(20);
  });
});
