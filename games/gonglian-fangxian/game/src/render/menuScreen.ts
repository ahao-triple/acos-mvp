import type { AppViewState } from '../app/controller';
import { drawButton, drawPanel, drawSmallText, drawText, type UiRenderContext } from './uiPrimitives';

export function drawMenuScreen(ui: UiRenderContext, view: AppViewState): void {
  const current = view.chapterProgress.find((chapter) => chapter.current) ?? view.chapterProgress[0];
  drawText(ui.ctx, '共联防线', 375, 118, 68, '#ffffff', 'center');
  drawText(ui.ctx, '调度资源，修复防线，守住前线', 375, 176, 28, '#d1fae5', 'center');
  drawPanel(ui.ctx, 70, 245, 610, 620);
  drawText(ui.ctx, current.title, 375, 320, 38, '#ffffff', 'center');
  drawText(ui.ctx, `当前进度 ${view.highestLevel}/30`, 375, 372, 30, '#fef3c7', 'center');
  drawButton(ui, 150, 430, 450, 82, '继续作战', { type: 'start' });
  drawButton(ui, 150, 535, 450, 72, '关卡选择', { type: 'openLevels' });
  drawButton(ui, 150, 625, 450, 72, '补给', { type: 'openSupplies' });
  drawButton(ui, 150, 715, 450, 72, '设置', { type: 'openSettings' });
  drawSmallText(ui.ctx, `金币 ${view.save.coins}`, 375, 820);
}

export function drawSuppliesScreen(ui: UiRenderContext, view: AppViewState): void {
  drawText(ui.ctx, '补给', 375, 126, 64, '#ffffff', 'center');
  drawText(ui.ctx, `金币 ${view.save.coins}`, 375, 184, 28, '#d1fae5', 'center');
  drawPanel(ui.ctx, 80, 260, 590, 620);
  drawButton(ui, 150, 330, 450, 78, '添加到桌面领奖', { type: 'desktopReward' });
  drawButton(ui, 150, 436, 450, 78, '添加到常用领奖', { type: 'favoriteReward' });
  drawButton(ui, 150, 542, 450, 78, '侧边栏入口奖励', { type: 'sidebarReward' });
  drawButton(ui, 150, 720, 450, 78, '返回', { type: 'closeModal' });
}
