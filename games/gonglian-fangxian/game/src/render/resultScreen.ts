import { describeNodeReward, remainingTargetsText } from '../app/campaign';
import type { AppAction, AppViewState } from '../app/controller';
import { drawAdButton, drawButton, drawPanel, drawText, type UiRenderContext } from './uiPrimitives';

export function drawPausedResult(ui: UiRenderContext): void {
  drawModal(ui, '暂停', [
    ['继续', { type: 'resume' }],
    ['重玩', { type: 'retry' }],
    ['返回首页', { type: 'home' }],
  ]);
}

export function drawWinResult(ui: UiRenderContext, view: AppViewState): void {
  const summary = view.winSummary;
  drawOverlay(ui);
  drawPanel(ui.ctx, 80, 300, 590, 620);
  drawText(ui.ctx, '防线推进', 375, 380, 52, '#ffffff', 'center');
  if (summary) {
    drawText(ui.ctx, `${summary.chapterTitle}  第 ${summary.levelId} 关完成`, 375, 450, 26, '#d1fae5', 'center');
    drawText(ui.ctx, `获得金币 ${summary.baseCoins}`, 375, 510, 28, '#fef3c7', 'center');
    const reward = describeNodeReward(summary.nodeReward ?? undefined);
    if (reward) {
      drawText(ui.ctx, `节点奖励 ${reward}`, 375, 560, 26, '#fef3c7', 'center');
    }
    if (summary.nextLevelId) {
      drawText(ui.ctx, `已解锁第 ${summary.nextLevelId} 关`, 375, 610, 26, '#d1fae5', 'center');
    }
  }
  if (!summary?.doubled) {
    drawAdButton(ui, 175, 670, 400, 70, '奖励翻倍', { type: 'requestRewardedAd', request: { type: 'doubleWinReward' } });
  } else {
    drawText(ui.ctx, '翻倍奖励已领取', 375, 705, 26, '#d1fae5', 'center');
  }
  drawButton(ui, 175, 760, 400, 66, '下一关', { type: 'nextLevel' });
  drawButton(ui, 175, 838, 400, 66, '重玩本关', { type: 'retry' });
  drawButton(ui, 175, 916, 400, 66, '分享', { type: 'shareReward' });
  drawButton(ui, 175, 994, 400, 66, '返回主页', { type: 'home' });
}

export function drawLostResult(ui: UiRenderContext, view: AppViewState): void {
  drawOverlay(ui);
  drawPanel(ui.ctx, 80, 300, 590, 620);
  drawText(ui.ctx, '防线告急', 375, 380, 52, '#ffffff', 'center');
  if (view.session) {
    drawText(ui.ctx, '未完成目标', 375, 455, 28, '#fef3c7', 'center');
    drawText(ui.ctx, remainingTargetsText(view.session), 375, 510, 24, '#d1fae5', 'center');
  }
  drawAdButton(ui, 175, 610, 400, 70, '复活继续', { type: 'requestRewardedAd', request: { type: 'extraMovesAd' } });
  drawButton(ui, 175, 700, 400, 66, '重玩本关', { type: 'retry' });
  drawButton(ui, 175, 778, 400, 66, '分享', { type: 'shareReward' });
  drawButton(ui, 175, 856, 400, 66, '返回主页', { type: 'home' });
}

function drawModal(ui: UiRenderContext, title: string, buttons: Array<[string, AppAction]>): void {
  drawOverlay(ui);
  drawPanel(ui.ctx, 105, 350, 540, 470);
  drawButton(ui, 585, 366, 44, 44, '关', { type: 'closeModal' });
  drawText(ui.ctx, title, 375, 430, 56, '#ffffff', 'center');
  buttons.forEach(([label, action], index) => {
    drawButton(ui, 175, 500 + index * 100, 400, 74, label, action);
  });
}

function drawOverlay(ui: UiRenderContext): void {
  ui.ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ui.ctx.fillRect(0, 0, 750, 1334);
}
