/** 关卡简报 screen（对应旧 drawBriefingScreen）。 */
import { Container, Text } from 'pixi.js';
import type { AppViewState } from '../../app/controller';
import { targetProgressText } from '../../render/theme';
import { createButton } from '../ui/button';
import { createPanel } from '../ui/panel';
import { createText, setText } from '../ui/text';
import type { PixiScreen, ScreenContext } from './base';

const MAX_TARGETS = 4;

export class BriefingScreen implements PixiScreen {
  readonly container: Container;
  private readonly bodyContainer: Container;
  private readonly emptyText: Text;
  private readonly chapterInfo: Text;
  private readonly briefingText: Text;
  private readonly movesText: Text;
  private readonly coinText: Text;
  private readonly targetTexts: Text[] = [];

  constructor(ctx: ScreenContext) {
    this.container = new Container();
    this.container.label = 'briefing';

    this.container.addChild(createText({ text: '作战简报', size: 62, color: 0xffffff, x: 375, y: 120 }));

    // 无可进入关卡时显示的 fallback。
    this.emptyText = createText({ text: '暂无可进入关卡', size: 32, color: 0xffffff, x: 375, y: 360 });
    this.emptyText.visible = false;
    this.container.addChild(this.emptyText);

    // 关卡详情容器（默认显示）。
    this.bodyContainer = new Container();
    this.container.addChild(this.bodyContainer);

    this.chapterInfo = createText({ text: '', size: 30, color: 0xd1fae5, x: 375, y: 186 });
    this.bodyContainer.addChild(this.chapterInfo);

    this.bodyContainer.addChild(createPanel({ x: 70, y: 260, width: 610, height: 700 }));

    this.briefingText = createText({ text: '', size: 26, color: 0xffffff, x: 375, y: 330 });
    this.bodyContainer.addChild(this.briefingText);

    this.movesText = createText({ text: '', size: 28, color: 0xfef3c7, align: 'left', x: 180, y: 420 });
    this.bodyContainer.addChild(this.movesText);

    this.coinText = createText({ text: '', size: 28, color: 0xfef3c7, align: 'left', x: 180, y: 470 });
    this.bodyContainer.addChild(this.coinText);

    this.bodyContainer.addChild(
      createText({ text: '目标', size: 30, color: 0xffffff, align: 'left', x: 180, y: 550 }),
    );

    for (let i = 0; i < MAX_TARGETS; i += 1) {
      const t = createText({ text: '', size: 26, color: 0xd1fae5, align: 'left', x: 190, y: 610 + i * 46 });
      t.visible = false;
      this.targetTexts.push(t);
      this.bodyContainer.addChild(t);
    }

    this.bodyContainer.addChild(
      createButton({
        x: 150,
        y: 1010,
        width: 450,
        height: 78,
        label: '开始作战',
        variant: 'primary',
        onTap: () => ctx.dispatch({ type: 'beginLevel' }),
      }).container,
    );

    this.container.addChild(
      createButton({
        x: 190,
        y: 1110,
        width: 370,
        height: 70,
        label: '返回首页',
        onTap: () => ctx.dispatch({ type: 'home' }),
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
    const level = view.pendingLevel;
    if (!level) {
      this.emptyText.visible = true;
      this.bodyContainer.visible = false;
      return;
    }
    this.emptyText.visible = false;
    this.bodyContainer.visible = true;

    setText(this.chapterInfo, `${level.chapterTitle}  第 ${level.id} 关`);
    setText(this.briefingText, level.briefing);
    setText(this.movesText, `步数 ${level.moves}`);
    setText(this.coinText, `奖励金币 ${level.rewards.coins}`);

    for (let i = 0; i < MAX_TARGETS; i += 1) {
      const target = level.targets[i];
      const text = this.targetTexts[i];
      if (target) {
        setText(text, targetProgressText(target, {}));
        text.visible = true;
      } else {
        text.visible = false;
      }
    }
  }

  dispose(): void {
    this.container.destroy({ children: true });
  }
}
