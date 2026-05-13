/**
 * 临时占位 screen，Phase 1.1 阶段用。每个 screen 只显示一个标题 + "返回菜单" 按钮。
 * 后续按 changelog 任务清单逐个替换为完整实现。
 */
import { Container } from 'pixi.js';
import type { AppViewState } from '../../app/controller';
import { createButton } from '../ui/button';
import { createText } from '../ui/text';
import type { PixiScreen, ScreenContext } from './base';

const TEXT_COLOR = 0x1a2332;

export class StubScreen implements PixiScreen {
  readonly container: Container;

  constructor(ctx: ScreenContext, title: string) {
    this.container = new Container();
    this.container.label = `stub:${title}`;
    this.container.addChild(
      createText({ text: title, size: 56, color: TEXT_COLOR, x: ctx.logicalWidth / 2, y: 280 }),
    );
    this.container.addChild(
      createText({
        text: '（Phase 1 待实现）',
        size: 28,
        color: TEXT_COLOR,
        x: ctx.logicalWidth / 2,
        y: 360,
      }),
    );
    this.container.addChild(
      createButton({
        x: ctx.logicalWidth / 2 - 225,
        y: 600,
        width: 450,
        height: 80,
        label: '返回菜单',
        onTap: () => ctx.dispatch({ type: 'home' }),
      }).container,
    );
  }

  show(view: AppViewState): void {
    this.container.visible = true;
  }

  hide(): void {
    this.container.visible = false;
  }

  update(): void {}

  dispose(): void {
    this.container.destroy({ children: true });
  }
}
