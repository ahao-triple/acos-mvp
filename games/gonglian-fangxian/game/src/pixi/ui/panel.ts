/**
 * Pixi 浅色面板。vivo MSDF 临时绕过期统一用浅底 + 深色字。
 * 角半径 8。返回 Graphics 实例供调用方挂到容器上。
 */
import { Graphics } from 'pixi.js';

export interface CreatePanelOptions {
  x?: number;
  y?: number;
  width: number;
  height: number;
  radius?: number;
  fill?: number;
  fillAlpha?: number;
  stroke?: number;
  strokeWidth?: number;
}

export function createPanel(opts: CreatePanelOptions): Graphics {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const r = opts.radius ?? 8;
  const fill = opts.fill ?? 0xffffff;
  const fillAlpha = opts.fillAlpha ?? 0.86;
  const stroke = opts.stroke ?? 0xd7d1c5;
  const strokeAlpha = 1;
  const strokeWidth = opts.strokeWidth ?? 2;

  const g = new Graphics();
  g.roundRect(x, y, opts.width, opts.height, r)
    .fill({ color: fill, alpha: fillAlpha })
    .stroke({ color: stroke, alpha: strokeAlpha, width: strokeWidth });
  return g;
}
