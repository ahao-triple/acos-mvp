/**
 * Pixi 按钮：圆角矩形 + 中央 label，三种 variant：
 *   - primary：主操作（继续作战、开始作战）—— 金黄 #f59e0b，醒目
 *   - secondary：次操作（关卡选择、设置、补给等）—— 白色 #ffffff（默认）
 *   - ad：广告按钮（加桌领奖、奖励翻倍、跳过本关等）—— 橙色 #fb923c + 左侧广告图标
 * label 文字一律深蓝黑 #1a2332，与所有 variant 的浅色 fill 形成高对比。
 *
 * 持久 Container：构造一次，container.eventMode='static'，pointerdown/up 自带 0.96 缩放反馈，
 * pointerup 触发 onTap。hitArea 用 Rectangle 类（不用 alpha=0 Graphics —— 真机上 hit-test
 * 对 alpha=0 fill 的可靠性有顾虑）。
 *
 * disabled=true 时整体 alpha=0.5 + eventMode='none'，不响应点击。
 */
import { Container, Graphics, Rectangle } from 'pixi.js';
import { createText, setText } from './text';
import { createAdIcon } from './adIcon';

export type ButtonVariant = 'primary' | 'secondary' | 'ad';

interface VariantStyle {
  fill: number;
  stroke: number;
  label: number;
}

const VARIANT_STYLES: Record<ButtonVariant, VariantStyle> = {
  primary: { fill: 0xf59e0b, stroke: 0xb45309, label: 0x1a2332 },
  secondary: { fill: 0xffffff, stroke: 0xd7d1c5, label: 0x1a2332 },
  ad: { fill: 0xfb923c, stroke: 0xc2410c, label: 0x1a2332 },
};

export interface CreateButtonOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onTap: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** 覆盖 variant 默认 label 颜色 */
  labelColor?: number;
  /** 覆盖 variant 默认 label 字号 */
  labelSize?: number;
  /** 覆盖 variant 默认 fill */
  fill?: number;
  /** 覆盖 variant 默认 stroke */
  stroke?: number;
}

export interface ButtonHandle {
  container: Container;
  setLabel(text: string): void;
  setDisabled(disabled: boolean): void;
}

export function createButton(opts: CreateButtonOptions): ButtonHandle {
  const variant: ButtonVariant = opts.variant ?? 'secondary';
  const style = VARIANT_STYLES[variant];

  const container = new Container();
  container.position.set(opts.x, opts.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';
  // hitArea 用 Rectangle（标准类，hit-test 行为可靠），不依赖子节点 Graphics 几何推断。
  container.hitArea = new Rectangle(0, 0, opts.width, opts.height);

  const fillColor = opts.fill ?? style.fill;
  const strokeColor = opts.stroke ?? style.stroke;
  const labelColor = opts.labelColor ?? style.label;
  const labelSize = opts.labelSize ?? (variant === 'ad' ? 22 : 26);

  const bg = new Graphics();
  bg.roundRect(0, 0, opts.width, opts.height, 8)
    .fill({ color: fillColor })
    .stroke({ color: strokeColor, width: 3 });
  container.addChild(bg);

  const label = createText({
    text: opts.label,
    size: labelSize,
    color: labelColor,
    align: variant === 'ad' ? 'left' : 'center',
    weight: '700',
  });

  if (variant === 'ad') {
    // 估算文字宽度（按字数 × 字号 × 0.6 比例），不调 measure 避免 Canvas2D 依赖。
    const labelTextWidth = opts.label.length * labelSize * 0.6;
    const iconHeight = Math.max(4, Math.round((opts.height * 0.4) / 4) * 4);
    const iconWidth = iconHeight * (38 / 28);
    const gap = 14;
    const contentWidth = iconWidth + gap + labelTextWidth;
    const iconX = Math.max(12, (opts.width - contentWidth) / 2);
    const iconY = (opts.height - iconHeight) / 2;
    const icon = createAdIcon({
      x: iconX,
      y: iconY,
      width: iconWidth,
      height: iconHeight,
      color: labelColor,
    });
    container.addChild(icon);
    label.position.set(iconX + iconWidth + gap, opts.height / 2);
  } else {
    label.position.set(opts.width / 2, opts.height / 2);
  }
  container.addChild(label);

  let disabled = opts.disabled ?? false;
  const refreshDisabledStyle = () => {
    container.alpha = disabled ? 0.5 : 1;
    container.eventMode = disabled ? 'none' : 'static';
  };
  refreshDisabledStyle();

  // 自合成 tap：pointerdown 记时间，pointerup 在阈值内才触发 onTap。
  // 不依赖 PixiJS 的 pointertap 合成，因为 vivo 桥接的 pointer 事件序列不一定完整
  // （短按可能 cancel 不 end，拖出可能只 upoutside），自己掌控阈值更可靠。
  // 前 8 次 pointer 事件打 log 方便真机定位"哪条 up 路径触发了"。
  let pressedAt = 0;
  let logCount = 0;
  const TAP_MS = 600;
  const tryTap = (path: string) => {
    if (disabled) return;
    if (pressedAt <= 0) return;
    const dt = Date.now() - pressedAt;
    pressedAt = 0;
    if (logCount < 8) {
      console.log('[button] tryTap path=%s label=%s dt=%dms ok=%s', path, opts.label, dt, String(dt <= TAP_MS));
      logCount += 1;
    }
    if (dt <= TAP_MS) opts.onTap();
  };
  container.on('pointerdown', () => {
    if (disabled) return;
    pressedAt = Date.now();
    container.scale.set(0.96, 0.96);
    if (logCount < 8) {
      console.log('[button] pointerdown label=%s', opts.label);
    }
  });
  container.on('pointerup', () => {
    container.scale.set(1, 1);
    tryTap('up');
  });
  // pointerupoutside / pointercancel 都尝试合成 tap（vivo 短按到 touchcancel 时走这条路）。
  // 阈值 TAP_MS 兜底，按住拖远再松不会误触发。
  container.on('pointerupoutside', () => {
    container.scale.set(1, 1);
    tryTap('upoutside');
  });
  container.on('pointercancel', () => {
    container.scale.set(1, 1);
    tryTap('cancel');
  });

  return {
    container,
    setLabel(t) {
      setText(label, t);
    },
    setDisabled(d) {
      disabled = d;
      refreshDisabledStyle();
    },
  };
}
