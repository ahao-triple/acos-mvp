import type { AppViewState } from '../app/controller';
import { targetProgressText } from './theme';
import { drawButton, drawPanel, drawText, type UiRenderContext } from './uiPrimitives';

export function drawBriefingScreen(ui: UiRenderContext, view: AppViewState): void {
  const level = view.pendingLevel;
  drawText(ui.ctx, '作战简报', 375, 120, 62, '#ffffff', 'center');
  if (!level) {
    drawText(ui.ctx, '暂无可进入关卡', 375, 360, 32, '#ffffff', 'center');
    drawButton(ui, 190, 720, 370, 78, '返回首页', { type: 'home' });
    return;
  }

  drawText(ui.ctx, `${level.chapterTitle}  第 ${level.id} 关`, 375, 186, 30, '#d1fae5', 'center');
  drawPanel(ui.ctx, 70, 260, 610, 700);
  drawText(ui.ctx, level.briefing, 375, 330, 26, '#ffffff', 'center');
  drawText(ui.ctx, `步数 ${level.moves}`, 180, 420, 28, '#fef3c7', 'left');
  drawText(ui.ctx, `奖励金币 ${level.rewards.coins}`, 180, 470, 28, '#fef3c7', 'left');
  drawText(ui.ctx, '目标', 180, 550, 30, '#ffffff', 'left');
  level.targets.forEach((target, index) => {
    drawText(ui.ctx, targetProgressText(target, {}), 190, 610 + index * 46, 26, '#d1fae5', 'left');
  });
  drawButton(ui, 150, 1010, 450, 78, '开始作战', { type: 'beginLevel' });
  drawButton(ui, 190, 1110, 370, 70, '返回首页', { type: 'home' });
}
