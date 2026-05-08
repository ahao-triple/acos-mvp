export const LOGICAL_WIDTH = 750;
export const LOGICAL_HEIGHT = 1334;

export interface CanvasFit {
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LogicalPoint {
  x: number;
  y: number;
}

export function fitLogicalCanvas(viewportWidth: number, viewportHeight: number): CanvasFit {
  const scale = Math.min(viewportWidth / LOGICAL_WIDTH, viewportHeight / LOGICAL_HEIGHT);
  const drawWidth = LOGICAL_WIDTH * scale;
  const drawHeight = LOGICAL_HEIGHT * scale;

  return {
    viewportWidth,
    viewportHeight,
    scale,
    offsetX: (viewportWidth - drawWidth) / 2,
    offsetY: (viewportHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  };
}

export function toLogicalPoint(deviceX: number, deviceY: number, fit: CanvasFit): LogicalPoint {
  return {
    x: (deviceX - fit.offsetX) / fit.scale,
    y: (deviceY - fit.offsetY) / fit.scale,
  };
}

export function coverRect(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): Rect {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}
