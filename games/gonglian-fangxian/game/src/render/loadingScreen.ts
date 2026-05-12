import { clamp01 } from './animation';
import { drawText, roundRect, type UiRenderContext } from './uiPrimitives';

// === 适龄标识 PNG 实现（暂停用，等矢量版审核反馈再决定是否切回）===
// const ageRatingImage = new Image();
// ageRatingImage.onload = () => {
//   console.info('[age-rating] image loaded', ageRatingImage.naturalWidth, 'x', ageRatingImage.naturalHeight);
// };
// ageRatingImage.onerror = (event) => {
//   console.error('[age-rating] image failed to load', ageRatingImage.src, event);
// };
// ageRatingImage.src = '/assets/age-rating-12plus.png';

export function drawLoadingScreen(ui: UiRenderContext, elapsedMs: number): void {
  const progress = clamp01(elapsedMs / 1500);
  drawText(ui.ctx, '共联防线软件', 375, 250, 62, '#ffffff', 'center');
  drawText(ui.ctx, '资源调度中，请稍候', 375, 320, 28, '#d1fae5', 'center');
  drawText(ui.ctx, '著作权人：共联互动科技', 375, 98, 22, '#d1fae5', 'center');
  drawText(ui.ctx, '软著登记号：SR2026001234', 375, 132, 22, '#d1fae5', 'center');

  ui.ctx.fillStyle = 'rgba(15,23,42,0.72)';
  roundRect(ui.ctx, 145, 620, 460, 38, 8);
  ui.ctx.fill();
  ui.ctx.fillStyle = '#f8fafc';
  roundRect(ui.ctx, 149, 624, Math.max(0, 452 * progress), 30, 8);
  ui.ctx.fill();

  drawAgeRatingBadge(ui.ctx, 60, 940);
  drawText(ui.ctx, '健康游戏忠告', 375, 1110, 26, '#fef3c7', 'center');
  drawText(ui.ctx, '抵制不良游戏，拒绝盗版游戏。', 375, 1150, 20, '#d1fae5', 'center');
  drawText(ui.ctx, '注意自我保护，谨防受骗上当。', 375, 1180, 20, '#d1fae5', 'center');
  drawText(ui.ctx, '适度游戏益脑，沉迷游戏伤身。', 375, 1210, 20, '#d1fae5', 'center');
  drawText(ui.ctx, '合理安排时间，享受健康生活。', 375, 1240, 20, '#d1fae5', 'center');
}

function drawAgeRatingBadge(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const width = 100;
  const height = 128;

  // PNG 实现（暂停用）
  // if (ageRatingImage.complete && ageRatingImage.naturalWidth > 0) {
  //   ctx.drawImage(ageRatingImage, x, y, width, height);
  //   return;
  // }

  drawAgeRatingVector(ctx, x, y, width, height);
}

function drawAgeRatingVector(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  const padding = 6;
  const blockBottom = 100;
  const cx = x + width / 2;

  ctx.save();

  roundRect(ctx, x, y, width, height, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.stroke();

  roundRect(ctx, x + padding, y + padding, width - padding * 2, blockBottom - padding, 8);
  ctx.fillStyle = '#29ABE2';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 40px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('12+', cx, y + 44);

  ctx.font = '700 14px "Times New Roman", serif';
  ctx.fillText('CADPA', cx, y + 82);

  ctx.fillStyle = '#000000';
  ctx.font = '900 18px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('适龄提示', cx, y + 116);

  ctx.restore();
}
