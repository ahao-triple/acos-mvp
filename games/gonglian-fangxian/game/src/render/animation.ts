export type Easing = (progress: number) => number;

export interface NumberTween {
  from: number;
  to: number;
  startMs: number;
  durationMs: number;
  easing: Easing;
}

export interface TweenSample {
  value: number;
  done: boolean;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function easeOutCubic(progress: number): number {
  const t = clamp01(progress);
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutSine(progress: number): number {
  const t = clamp01(progress);
  if (t === 0 || t === 1) {
    return t;
  }
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export function easeBackOut(progress: number): number {
  const t = clamp01(progress);
  if (t === 0 || t === 1) {
    return t;
  }
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function tweenNumber(from: number, to: number, startMs: number, durationMs: number, easing: Easing = easeOutCubic): NumberTween {
  return {
    from,
    to,
    startMs,
    durationMs: Math.max(1, durationMs),
    easing,
  };
}

export function sampleTween(tween: NumberTween, nowMs: number): TweenSample {
  const progress = clamp01((nowMs - tween.startMs) / tween.durationMs);
  const eased = tween.easing(progress);

  return {
    value: tween.from + (tween.to - tween.from) * eased,
    done: progress >= 1,
  };
}
