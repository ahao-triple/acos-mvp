/**
 * Pixi 半透明面板。对应旧 uiPrimitives.drawPanel（rgba(15,23,42,0.72) 填充 + 白色细边）。
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
  // 半透明深色 + 深灰描边 + 0.85 alpha：与背景区分明显，比之前的 0.72/白边更显眼。
  const fill = opts.fill ?? 0x0f172a;
  const fillAlpha = opts.fillAlpha ?? 0.85;
  const stroke = opts.stroke ?? 0x1f2937;
  const strokeAlpha = 1;
  const strokeWidth = opts.strokeWidth ?? 2;

  const g = new Graphics();
  g.roundRect(x, y, opts.width, opts.height, r)
    .fill({ color: fill, alpha: fillAlpha })
    .stroke({ color: stroke, alpha: strokeAlpha, width: strokeWidth });
  return g;
}
