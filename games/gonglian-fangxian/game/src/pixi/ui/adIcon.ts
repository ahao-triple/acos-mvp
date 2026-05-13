/**
 * 广告播放图标：圆角矩形 + 中央白色三角。对应旧 uiPrimitives.drawAdVideoIcon。
 * 旧版用 Canvas2D path 受 vivo path bug 困扰，这里走 Pixi Graphics tessellation 安全。
 */
import { Graphics } from 'pixi.js';

export interface CreateAdIconOptions {
  x?: number;
  y?: number;
  width: number;
  height: number;
  color?: number;
  triangleColor?: number;
}

export function createAdIcon(opts: CreateAdIconOptions): Graphics {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.width;
  const h = opts.height;
  const color = opts.color ?? 0x111827;
  const triColor = opts.triangleColor ?? 0xf8fafc;
  const cornerR = Math.min(w, h) * 0.18;

  const g = new Graphics();
  g.roundRect(x, y, w, h, cornerR).fill({ color });

  const triSize = Math.min(w, h) * 0.42;
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  g.moveTo(cx - triSize * 0.3, cy - triSize * 0.5)
    .lineTo(cx - triSize * 0.3, cy + triSize * 0.5)
    .lineTo(cx + triSize * 0.5, cy)
    .closePath()
    .fill({ color: triColor });
  return g;
}
