/** 补给 screen（对应旧 drawSuppliesScreen）。 */
import { Container } from 'pixi.js';
import type { AppViewState } from '../../app/controller';
import { createButton } from '../ui/button';
import { createPanel } from '../ui/panel';
import { createText } from '../ui/text';
import type { PixiScreen, ScreenContext } from './base';

export class SuppliesScreen implements PixiScreen {
  readonly container: Container;

  constructor(ctx: ScreenContext) {
    this.container = new Container();
    this.container.label = 'supplies';

    this.container.addChild(createText({ text: '补给', size: 64, color: 0xffffff, x: 375, y: 126 }));
    this.container.addChild(createPanel({ x: 80, y: 240, width: 590, height: 790 }));

    this.container.addChild(
      createButton({
        x: 150, y: 300, width: 450, height: 78, label: '添加到桌面领奖',
        onTap: () => ctx.dispatch({ type: 'desktopReward' }),
      }).container,
    );
    this.container.addChild(
      createButton({
        x: 150, y: 404, width: 450, height: 78, label: '添加到常用领奖',
        onTap: () => ctx.dispatch({ type: 'favoriteReward' }),
      }).container,
    );

    this.container.addChild(createText({ text: '侧边栏复访任务', size: 34, color: 0xffffff, x: 375, y: 552 }));
    this.container.addChild(createText({ text: '任务指引：点击下方按钮打开侧边栏', size: 24, color: 0xd1fae5, x: 375, y: 600 }));
    this.container.addChild(createText({ text: '从侧边栏卡片重新进入游戏后领取奖励', size: 24, color: 0xd1fae5, x: 375, y: 638 }));
    this.container.addChild(createText({ text: '奖励：80金币，仅可领取一次', size: 24, color: 0xfef3c7, x: 375, y: 676 }));

    this.container.addChild(
      createButton({
        x: 150, y: 724, width: 450, height: 78, label: '去侧边栏完成任务',
        onTap: () => ctx.dispatch({ type: 'sidebarReward' }),
      }).container,
    );
    this.container.addChild(
      createButton({
        x: 150, y: 900, width: 450, height: 78, label: '返回',
        onTap: () => ctx.dispatch({ type: 'closeModal' }),
      }).container,
    );
  }

  show(view: AppViewState, _nowMs: number): void {
    this.container.visible = true;
  }

  hide(): void {
    this.container.visible = false;
  }

  update(_view: AppViewState, _nowMs: number): void {}

  dispose(): void {
    this.container.destroy({ children: true });
  }
}
