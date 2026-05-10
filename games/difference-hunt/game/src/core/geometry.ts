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
const PLAY_IMAGE_SIDE_MARGIN = 16;

export function imageFrameForLevel(level: DifferenceLevel): Rect {
  const scale = imageScaleForLevel(level);
  const width = round(level.backgroundSize.width * scale);
  const height = round(level.backgroundSize.height * scale);
  return {
    x: round(level.center.x - width / 2),
    y: round(level.center.y - height / 2),
    width,
    height,
  };
}

export function centerForCocosPoint(level: DifferenceLevel, point: Point): Point {
  const frame = imageFrameForLevel(level);
  const scale = imageScaleForLevel(level);
  return {
    x: round(frame.x + frame.width / 2 + point.x * scale),
    y: round(frame.y + frame.height / 2 - point.y * scale),
  };
}

export function hitZonesForTarget(level: DifferenceLevel, target: DifferenceTarget): Rect[] {
  const frame = imageFrameForLevel(level);
  const scale = imageScaleForLevel(level);
  const scaledSize = {
    width: round(target.size.width * scale),
    height: round(target.size.height * scale),
  };
  const bottomCenter = centerForCocosPoint(level, target.cocos);
  const topCenter = {
    x: bottomCenter.x,
    y: round(bottomCenter.y - frame.height / 2),
  };
  return [rectFromCenter(bottomCenter, scaledSize), rectFromCenter(topCenter, scaledSize)];
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

function imageScaleForLevel(level: DifferenceLevel): number {
  return Math.min(1, (DESIGN_WIDTH - PLAY_IMAGE_SIDE_MARGIN * 2) / level.backgroundSize.width);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
