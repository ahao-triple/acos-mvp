import type { DifferenceLevel, DifferenceTarget } from '../assets/types';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1334;

export function imageFrameForLevel(level: DifferenceLevel): Rect {
  return {
    x: level.center.x - level.backgroundSize.width / 2,
    y: level.center.y - level.backgroundSize.height / 2,
    width: level.backgroundSize.width,
    height: level.backgroundSize.height,
  };
}

export function centerForCocosPoint(level: DifferenceLevel, point: Point): Point {
  return {
    x: round(level.center.x + point.x),
    y: round(level.center.y - point.y),
  };
}

export function hitZonesForTarget(level: DifferenceLevel, target: DifferenceTarget): Rect[] {
  const bottomCenter = centerForCocosPoint(level, target.cocos);
  const topCenter = {
    x: bottomCenter.x,
    y: round(bottomCenter.y - level.backgroundSize.height / 2),
  };
  return [rectFromCenter(bottomCenter, target.size), rectFromCenter(topCenter, target.size)];
}

export function containsPoint(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function findTargetAt(level: DifferenceLevel, foundIds: Set<string>, point: Point): DifferenceTarget | null {
  for (const target of level.targets) {
    if (foundIds.has(target.id)) {
      continue;
    }
    if (hitZonesForTarget(level, target).some((zone) => containsPoint(zone, point))) {
      return target;
    }
  }
  return null;
}

function rectFromCenter(center: Point, size: { width: number; height: number }): Rect {
  return {
    x: round(center.x - size.width / 2),
    y: round(center.y - size.height / 2),
    width: size.width,
    height: size.height,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
