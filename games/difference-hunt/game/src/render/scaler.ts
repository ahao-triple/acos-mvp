import { DESIGN_HEIGHT, DESIGN_WIDTH, type Point } from '../core/geometry';

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function viewportTransform(width: number, height: number): ViewportTransform {
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
  return {
    scale,
    offsetX: (width - DESIGN_WIDTH * scale) / 2 / scale,
    offsetY: (height - DESIGN_HEIGHT * scale) / 2 / scale,
  };
}

export function clientPointToDesign(canvas: HTMLCanvasElement, point: Point, transform: ViewportTransform): Point {
  const rect = typeof canvas.getBoundingClientRect === 'function'
    ? canvas.getBoundingClientRect()
    : { left: 0, top: 0, width: canvas.width || DESIGN_WIDTH, height: canvas.height || DESIGN_HEIGHT };
  return {
    x: (point.x - rect.left) / transform.scale - transform.offsetX,
    y: (point.y - rect.top) / transform.scale - transform.offsetY,
  };
}
