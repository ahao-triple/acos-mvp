import type { AppViewState } from '../app/controller';
import { drawButton, drawPanel, drawText, type UiRenderContext } from './uiPrimitives';

export function drawLevelsScreen(ui: UiRenderContext, view: AppViewState): void {
  drawText(ui.ctx, '关卡选择', 375, 86, 54, '#ffffff', 'center');
  drawText(ui.ctx, '完成当前关卡后解锁下一关', 375, 132, 24, '#d1fae5', 'center');
  drawPanel(ui.ctx, 38, 170, 674, 1010);

  for (const [chapterIndex, chapter] of view.chapterProgress.entries()) {
    const y = 220 + chapterIndex * 300;
    drawText(ui.ctx, `${chapter.title} ${chapter.completedCount}/10`, 80, y, 28, '#ffffff', 'left');
    for (let offset = 0; offset < 10; offset += 1) {
      const levelId = chapter.startLevel + offset;
      const col = offset % 5;
      const row = Math.floor(offset / 5);
      const x = 80 + col * 120;
      const buttonY = y + 42 + row * 82;
      const unlocked = levelId <= view.highestLevel;
      const label = unlocked ? `第${levelId}关` : '未解锁';
      drawButton(ui, x, buttonY, 104, 58, label, unlocked ? { type: 'selectLevel', levelId } : { type: 'openLevels' });
    }
  }

  drawButton(ui, 190, 1210, 370, 70, '返回', { type: 'closeModal' });
}
