import type { Direction } from '../core/types';
import type { FeedbackAnimationKind } from '../app/controller';

export interface TimedAnimation {
  kind: FeedbackAnimationKind;
  startedAtMs: number;
  durationMs: number;
}

export interface AnimationProgress {
  active: boolean;
  progress: number;
}

export interface CellMotion {
  offsetX: number;
  offsetY: number;
  scale: number;
  alpha: number;
}

export interface PulseMotion {
  scale: number;
  alpha: number;
  lineWidth: number;
  dashOffset: number;
}

export function feedbackProgress(animation: TimedAnimation | undefined, nowMs: number): AnimationProgress {
  if (!animation || animation.durationMs <= 0) {
    return { active: false, progress: 1 };
  }
  const raw = (nowMs - animation.startedAtMs) / animation.durationMs;
  const progress = clamp(raw, 0, 1);
  return {
    active: raw <= 1,
    progress,
  };
}

export function feedbackCellMotion(kind: FeedbackAnimationKind, direction: Direction, progress: number, cellSize: number): CellMotion {
  const p = clamp(progress, 0, 1);
  if (kind === 'fly') {
    const distance = cellSize * 1.18 * easeOutCubic(p);
    const vector = directionVector(direction);
    return {
      offsetX: vector.x * distance,
      offsetY: vector.y * distance,
      scale: 1 - 0.34 * p,
      alpha: 1 - p,
    };
  }
  if (kind === 'shake') {
    return {
      offsetX: Math.sin(p * Math.PI * 7) * cellSize * 0.1 * (1 - p),
      offsetY: 0,
      scale: 1,
      alpha: 1,
    };
  }
  if (kind === 'pulse') {
    return {
      offsetX: 0,
      offsetY: 0,
      scale: 1 + Math.sin(p * Math.PI) * 0.14,
      alpha: 1 - p * 0.28,
    };
  }
  return { offsetX: 0, offsetY: 0, scale: 1, alpha: 1 };
}

export function hintPulse(nowMs: number, periodMs = 1100): PulseMotion {
  const phase = ((nowMs % periodMs) + periodMs) % periodMs / periodMs;
  const wave = 0.5 + Math.sin(phase * Math.PI * 2) * 0.5;
  return {
    scale: 1 + wave * 0.08,
    alpha: 0.44 + wave * 0.46,
    lineWidth: 3 + wave * 3,
    dashOffset: -phase * 28,
  };
}

export function revealMotion(progress: number): { scale: number; alpha: number } {
  const p = clamp(progress, 0, 1);
  const eased = easeOutCubic(p);
  return {
    scale: 0.94 + eased * 0.06,
    alpha: 0.32 + eased * 0.68,
  };
}

function directionVector(direction: Direction): { x: number; y: number } {
  if (direction === 0) {
    return { x: 0, y: -1 };
  }
  if (direction === 1) {
    return { x: 1, y: 0 };
  }
  if (direction === 2) {
    return { x: 0, y: 1 };
  }
  return { x: -1, y: 0 };
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
