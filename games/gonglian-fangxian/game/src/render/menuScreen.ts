import type { AppViewState } from '../app/controller';
import { drawAdButton, drawButton, drawPanel, drawSmallText, drawText, type UiRenderContext } from './uiPrimitives';

export function drawMenuScreen(ui: UiRenderContext, view: AppViewState): void {
  const current = view.chapterProgress.find((chapter) => chapter.current) ?? view.chapterProgress[0];
  drawSmallText(ui.ctx, `金币 ${view.save.coins}`, 110, 54);
  drawText(ui.ctx, '共联防线软件', 375, 118, 68, '#ffffff', 'center');
  drawText(ui.ctx, '调度资源，修复防线，守住前线', 375, 176, 28, '#d1fae5', 'center');
  drawPanel(ui.ctx, 70, 245, 610, 620);
  drawText(ui.ctx, current.title, 375, 320, 38, '#ffffff', 'center');
  drawText(ui.ctx, `当前进度 ${view.highestLevel}/30`, 375, 372, 30, '#fef3c7', 'center');
  drawButton(ui, 150, 430, 450, 82, '继续作战', { type: 'start' });
  drawButton(ui, 150, 528, 450, 68, '用户信息', { type: 'openSettings' });
  drawButton(ui, 150, 610, 450, 68, '补给', { type: 'openSupplies' });
  drawButton(ui, 150, 692, 450, 68, '加桌领奖', { type: 'desktopReward' });
  drawButton(ui, 150, 774, 450, 68, '设为常用领奖', { type: 'favoriteReward' });
  if (view.platformName === 'douyin') {
    drawAdButton(ui, 150, 856, 450, 68, '入口奖励', { type: 'requestRewardedAd', request: { type: 'extraMovesAd' } });
  }
  drawButton(ui, 150, 938, 450, 68, '关卡选择', { type: 'openLevels' });
}

export function drawSuppliesScreen(ui: UiRenderContext, _view: AppViewState): void {
  drawText(ui.ctx, '补给', 375, 126, 64, '#ffffff', 'center');
  drawPanel(ui.ctx, 80, 240, 590, 790);
  drawButton(ui, 150, 300, 450, 78, '添加到桌面领奖', { type: 'desktopReward' });
  drawButton(ui, 150, 404, 450, 78, '添加到常用领奖', { type: 'favoriteReward' });
  drawText(ui.ctx, '侧边栏复访任务', 375, 552, 34, '#ffffff', 'center');
  drawText(ui.ctx, '任务指引：点击下方按钮打开侧边栏', 375, 600, 24, '#d1fae5', 'center');
  drawText(ui.ctx, '从侧边栏卡片重新进入游戏后领取奖励', 375, 638, 24, '#d1fae5', 'center');
  drawText(ui.ctx, '奖励：80金币，仅可领取一次', 375, 676, 24, '#fef3c7', 'center');
  drawButton(ui, 150, 724, 450, 78, '去侧边栏完成任务', { type: 'sidebarReward' });
  drawButton(ui, 150, 900, 450, 78, '返回', { type: 'closeModal' });
}
