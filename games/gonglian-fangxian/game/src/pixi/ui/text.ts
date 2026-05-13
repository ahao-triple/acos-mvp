/**
 * Pixi Text 包装 —— 内部走 BitmapText + SDF atlas，绕开 vivo Canvas2D fillText alpha bug
 * （见 docs/vivo-quirks.md "fillText alpha ~10/255"）。
 *
 * 接口（createText/setText）签名不变，业务调用方零改动。
 * 内部实现：
 *   - 启动时 main.ts 调 markAtlasReady() —— Assets.load('fonts/main.fnt') 成功后
 *   - createText 在 atlasReady 时走 BitmapText（WebGL 直绘字图），失败 fallback 走 Pixi Text（浏览器仍能渲染）
 *   - setText / createText 都过 sanitizeText：atlas 缺字替换为 '·'（中圆点 + console.warn）
 *
 * 缺字保护原则（audit §10.5）：玩家绝不应看到豆腐方块；缺字开发可见即可（console warn）。
 */
import { BitmapText, Text, type TextStyleAlign } from 'pixi.js';

/** atlas 字体 face name —— 与 build-font-atlas.sh 输出的 main.fnt 内 face 一致 */
export const ATLAS_FONT_FAMILY = 'main';

/** 缺字替换字符（ASCII 必在 atlas 内） */
const MISSING_CHAR_REPLACEMENT = '·';

const FONT_FAMILY_FALLBACK = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export interface CreateTextOptions {
  text: string;
  size: number;
  color?: number;
  align?: 'left' | 'center' | 'right';
  weight?: '400' | '500' | '600' | '700' | '900';
  x?: number;
  y?: number;
}

/** 共同显示对象类型：BitmapText 与 Text 都暴露 anchor / position / visible / alpha / text / style */
export type AppText = Text | BitmapText;

let atlasReady = false;
let atlasFontRef: { chars: Record<string, unknown> } | null = null;
const missingCharsWarned = new Set<string>();

/**
 * main.ts 在 Assets.load('fonts/main.fnt') 完成后调用，传入加载后的 BitmapFont 实例。
 * 之后 createText 走 BitmapText 路径，缺字也能查表替换。
 */
export function markAtlasReady(font: { chars: Record<string, unknown> } | null): void {
  if (font && typeof font.chars === 'object') {
    atlasReady = true;
    atlasFontRef = font;
  }
}

function sanitizeText(text: string): string {
  if (!atlasReady || !atlasFontRef) return text;
  let out = '';
  const localMissing: string[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    // 换行 / 制表保留
    if (cp === 0x0a || cp === 0x0d || cp === 0x09) {
      out += ch;
      continue;
    }
    if (atlasFontRef.chars[ch] || atlasFontRef.chars[String(cp)]) {
      out += ch;
    } else {
      out += MISSING_CHAR_REPLACEMENT;
      if (!missingCharsWarned.has(ch)) {
        missingCharsWarned.add(ch);
        localMissing.push(ch);
      }
    }
  }
  if (localMissing.length > 0) {
    console.warn(
      '[bitmap-text] missing chars in atlas: %s (text="%s") — 添加到 scripts/scan-charset.mjs 并重打 atlas',
      localMissing.join(''),
      text,
    );
  }
  return out;
}

export function createText(opts: CreateTextOptions): AppText {
  const align: TextStyleAlign = opts.align ?? 'center';
  const color = opts.color ?? 0x1a2332;
  const anchorX = align === 'left' ? 0 : align === 'right' ? 1 : 0.5;

  if (atlasReady) {
    // BitmapText 路径 —— WebGL 直绘，不走 Canvas2D fillText（vivo bug 路径）
    const t = new BitmapText({
      text: sanitizeText(opts.text),
      style: {
        fontFamily: ATLAS_FONT_FAMILY,
        fontSize: opts.size,
        fill: color,
        align,
      },
    });
    t.anchor.set(anchorX, 0.5);
    if (typeof opts.x === 'number') t.position.x = opts.x;
    if (typeof opts.y === 'number') t.position.y = opts.y;
    return t;
  }

  // Fallback：atlas 加载失败时退回 Pixi Text（浏览器 dev / 测试环境仍可渲染）
  const t = new Text({
    text: opts.text,
    style: {
      fontFamily: FONT_FAMILY_FALLBACK,
      fontSize: opts.size,
      fontWeight: opts.weight ?? '700',
      fill: color,
      align,
    },
  });
  t.anchor.set(anchorX, 0.5);
  if (typeof opts.x === 'number') t.position.x = opts.x;
  if (typeof opts.y === 'number') t.position.y = opts.y;
  return t;
}

export function setText(t: AppText, text: string): void {
  const filtered = atlasReady ? sanitizeText(text) : text;
  if (t.text !== filtered) {
    t.text = filtered;
  }
}
