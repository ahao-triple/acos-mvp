import type { AppAction } from '../app/controller';
import { nowMs } from './time';

export interface HitArea {
  x: number;
  y: number;
  width: number;
  height: number;
  action: AppAction;
}

export interface PressedButton {
  key: string;
  untilMs: number;
}

export interface UiRenderContext {
  ctx: CanvasRenderingContext2D;
  hitAreas: HitArea[];
  pressedButton: PressedButton | null;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign): void {
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export function drawSmallText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  drawText(ctx, text, x, y, 26, '#f8fafc', 'center');
}

export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  ctx.fillStyle = 'rgba(15,23,42,0.72)';
  roundRect(ctx, x, y, width, height, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.56)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawButton(ui: UiRenderContext, x: number, y: number, width: number, height: number, label: string, action: AppAction): void {
  drawButtonBase(ui, x, y, width, height, action, () => {
    drawText(ui.ctx, label, x + width / 2, y + height / 2, 26, '#111827', 'center');
  });
}

export function drawAdButton(ui: UiRenderContext, x: number, y: number, width: number, height: number, label: string, action: AppAction): void {
  drawButtonBase(ui, x, y, width, height, action, () => {
    const iconHeight = nearestMultipleOfFour(height * 0.4);
    const iconWidth = iconHeight * (38 / 28);
    const labelSize = 22;
    const gap = 14;
    const textWidth = typeof ui.ctx.measureText === 'function' ? ui.ctx.measureText(label).width : label.length * labelSize;
    const contentWidth = iconWidth + gap + textWidth;
    const iconX = x + Math.max(12, (width - contentWidth) / 2);
    const iconY = y + (height - iconHeight) / 2;
    drawAdVideoIcon(ui.ctx, iconX, iconY, iconWidth, iconHeight, '#111827');
    drawText(ui.ctx, label, iconX + iconWidth + gap, y + height / 2, labelSize, '#111827', 'left');
  });
}

export function drawButtonBase(ui: UiRenderContext, x: number, y: number, width: number, height: number, action: AppAction, drawContent: () => void): void {
  const key = actionKey(action);
  const pressed = ui.pressedButton?.key === key && ui.pressedButton.untilMs > nowMs();

  ui.ctx.save();
  if (pressed) {
    ui.ctx.translate(x + width / 2, y + height / 2);
    ui.ctx.scale(0.96, 0.96);
    ui.ctx.translate(-(x + width / 2), -(y + height / 2));
  }
  ui.ctx.fillStyle = '#f8fafc';
  roundRect(ui.ctx, x, y, width, height, 8);
  ui.ctx.fill();
  ui.ctx.strokeStyle = '#111827';
  ui.ctx.lineWidth = 3;
  ui.ctx.stroke();
  drawContent();
  ui.ctx.restore();

  ui.hitAreas.push({ x, y, width, height, action });
}

export function actionKey(action: AppAction): string {
  return JSON.stringify(action);
}

export function drawAdVideoIcon(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string): void {
  const py = (value: number) => 28 - value;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / 38, height / 28);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, py(22.790697));
  ctx.bezierCurveTo(0, py(25.667715), 2.306872, py(28), 5.152542, py(28));
  ctx.lineTo(25.118643, py(28));
  ctx.bezierCurveTo(27.964314, py(28), 30.271185, py(25.667715), 30.271185, py(22.790697));
  ctx.lineTo(30.271185, py(21.971283));
  ctx.bezierCurveTo(30.271185, py(21.510889), 30.735935, py(21.195894), 31.163574, py(21.366449));
  ctx.lineTo(34.478329, py(22.688473));
  ctx.bezierCurveTo(36.168919, py(23.362732), 38, py(22.102938), 38, py(20.265535));
  ctx.lineTo(38, py(7.788822));
  ctx.bezierCurveTo(38, py(5.936855), 36.142109, py(4.676512), 34.447056, py(5.378595));
  ctx.lineTo(31.17153, py(6.73531));
  ctx.bezierCurveTo(30.742785, py(6.912895), 30.271185, py(6.597778), 30.271185, py(6.133711));
  ctx.lineTo(30.271185, py(5.209301));
  ctx.bezierCurveTo(30.271185, py(2.332283), 27.964314, py(0), 25.118643, py(0));
  ctx.lineTo(5.152542, py(0));
  ctx.bezierCurveTo(2.306871, py(0), 0, py(2.332283), 0, py(5.209301));
  ctx.lineTo(0, py(22.790697));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(20.621685, py(11.820709));
  ctx.bezierCurveTo(22.204817, py(12.847475), 22.204819, py(15.164505), 20.621687, py(16.191273));
  ctx.lineTo(14.970669, py(19.856339));
  ctx.bezierCurveTo(13.237776, py(20.980234), 10.948714, py(19.736496), 10.948714, py(17.671053));
  ctx.lineTo(10.948714, py(10.340927));
  ctx.bezierCurveTo(10.948714, py(8.275482), 13.237773, py(7.031748), 14.970665, py(8.155643));
  ctx.lineTo(20.621685, py(11.820709));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function nearestMultipleOfFour(value: number): number {
  return Math.max(4, Math.round(value / 4) * 4);
}
