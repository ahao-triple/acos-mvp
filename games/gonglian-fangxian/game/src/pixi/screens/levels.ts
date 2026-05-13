/** 关卡选择 screen（对应旧 drawLevelsScreen）。 */
import { Container, Text } from 'pixi.js';
import type { AppViewState } from '../../app/controller';
import { createButton, type ButtonHandle } from '../ui/button';
import { createPanel } from '../ui/panel';
import { createText, setText } from '../ui/text';
import type { PixiScreen, ScreenContext } from './base';

interface LevelButtonRef {
  handle: ButtonHandle;
  levelId: number;
}

export class LevelsScreen implements PixiScreen {
  readonly container: Container;
  private readonly chapterTitleTexts: Text[] = [];
  private readonly levelButtons: LevelButtonRef[] = [];

  constructor(private readonly ctx: ScreenContext) {
    this.container = new Container();
    this.container.label = 'levels';

    this.container.addChild(createText({ text: '关卡选择', size: 54, color: 0xffffff, x: 375, y: 86 }));
    this.container.addChild(
      createText({ text: '完成当前关卡后解锁下一关', size: 24, color: 0xd1fae5, x: 375, y: 132 }),
    );
    this.container.addChild(createPanel({ x: 38, y: 170, width: 674, height: 1010 }));

    // 章节 + 关卡按钮网格预创建（章节数固定 3 章 × 10 关）。
    for (let chapterIndex = 0; chapterIndex < 3; chapterIndex += 1) {
      const y = 220 + chapterIndex * 300;
      const titleText = createText({ text: '', size: 28, color: 0xffffff, align: 'left', x: 80, y });
      this.container.addChild(titleText);
      this.chapterTitleTexts.push(titleText);

      for (let offset = 0; offset < 10; offset += 1) {
        const levelId = chapterIndex * 10 + offset + 1;
        const col = offset % 5;
        const row = Math.floor(offset / 5);
        const x = 80 + col * 120;
        const buttonY = y + 42 + row * 82;
        const handle = createButton({
          x,
          y: buttonY,
          width: 104,
          height: 58,
          label: `第${levelId}关`,
          onTap: () => ctx.dispatch({ type: 'selectLevel', levelId }),
        });
        this.container.addChild(handle.container);
        this.levelButtons.push({ handle, levelId });
      }
    }

    this.container.addChild(
      createButton({
        x: 190,
        y: 1210,
        width: 370,
        height: 70,
        label: '返回',
        onTap: () => ctx.dispatch({ type: 'closeModal' }),
      }).container,
    );
  }

  show(view: AppViewState, nowMs: number): void {
    this.container.visible = true;
    this.update(view, nowMs);
  }

  hide(): void {
    this.container.visible = false;
  }

  update(view: AppViewState, _nowMs: number): void {
    view.chapterProgress.forEach((chapter, index) => {
      const t = this.chapterTitleTexts[index];
      if (t) setText(t, `${chapter.title} ${chapter.completedCount}/10`);
    });
    for (const ref of this.levelButtons) {
      const unlocked = ref.levelId <= view.highestLevel;
      ref.handle.setLabel(unlocked ? `第${ref.levelId}关` : '未解锁');
      ref.handle.setDisabled(!unlocked);
    }
  }

  dispose(): void {
    this.container.destroy({ children: true });
  }
}
