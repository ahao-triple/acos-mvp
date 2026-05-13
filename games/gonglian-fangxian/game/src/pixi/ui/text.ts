/**
 * Pixi Text 包装，统一字体栈与默认 weight。
 * - fontFamily 与旧 uiPrimitives.drawText 保持一致（system-ui 栈）。
 * - 颜色用 number (0xRRGGBB) —— Pixi v8 Text style.fill 推荐 number。
 * - 对齐：用 anchor.x 控制（left=0, center=0.5, right=1）；y 默认 0.5（vertical middle）。
 */
import { Text, type TextStyleAlign } from 'pixi.js';

export interface CreateTextOptions {
  text: string;
  size: number;
  color?: number;
  align?: 'left' | 'center' | 'right';
  weight?: '400' | '500' | '600' | '700';
  x?: number;
  y?: number;
}

const FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function createText(opts: CreateTextOptions): Text {
  const align: TextStyleAlign = opts.align ?? 'center';
  const t = new Text({
    text: opts.text,
    style: {
      fontFamily: FONT_FAMILY,
      fontSize: opts.size,
      fontWeight: opts.weight ?? '700',
      fill: opts.color ?? 0xf8fafc,
      align,
    },
  });
  const anchorX = align === 'left' ? 0 : align === 'right' ? 1 : 0.5;
  t.anchor.set(anchorX, 0.5);
  if (typeof opts.x === 'number') t.position.x = opts.x;
  if (typeof opts.y === 'number') t.position.y = opts.y;
  return t;
}

export function setText(t: Text, text: string): void {
  if (t.text !== text) {
    t.text = text;
  }
}
