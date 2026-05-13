/**
 * 菜单 screen（对应旧 drawMenuScreen）。
 *
 * 布局保持与旧版一致（375 屏宽中心 + 按钮坐标）。动态更新：
 *  - 金币数（左上文本）
 *  - 当前章节标题、进度（中部面板内）
 *  - 平台特有按钮（抖音有"入口奖励"，vivo/web 没有）
 */
import { Container, Text } from 'pixi.js';
import type { AppViewState } from '../../app/controller';
import { createButton, type ButtonHandle } from '../ui/button';
import { createPanel } from '../ui/panel';
import { createText, setText } from '../ui/text';
import type { PixiScreen, ScreenContext } from './base';

export class MenuScreen implements PixiScreen {
  readonly container: Container;
  private readonly coinText: Text;
  private readonly chapterTitleText: Text;
  private readonly progressText: Text;
  private readonly platformAdButton: ButtonHandle;
  private platformAdButtonVisible = false;

  constructor(private readonly ctx: ScreenContext) {
    this.container = new Container();
    this.container.label = 'menu';

    this.coinText = createText({ text: '金币 0', size: 26, color: 0xf8fafc, x: 110, y: 54 });
    this.container.addChild(this.coinText);

    const title = createText({ text: '共联防线软件', size: 68, color: 0xffffff, x: 375, y: 118 });
    this.container.addChild(title);

    const subtitle = createText({
      text: '调度资源，修复防线，守住前线',
      size: 28,
      color: 0xd1fae5,
      x: 375,
      y: 176,
    });
    this.container.addChild(subtitle);

    this.container.addChild(createPanel({ x: 70, y: 245, width: 610, height: 620 }));

    this.chapterTitleText = createText({ text: '', size: 38, color: 0xffffff, x: 375, y: 320 });
    this.container.addChild(this.chapterTitleText);

    this.progressText = createText({ text: '', size: 30, color: 0xfef3c7, x: 375, y: 372 });
    this.container.addChild(this.progressText);

    // 主按钮：金黄高亮，区别于其他白色次按钮。
    this.container.addChild(
      createButton({
        x: 150,
        y: 430,
        width: 450,
        height: 82,
        label: '继续作战',
        variant: 'primary',
        onTap: () => ctx.dispatch({ type: 'start' }),
      }).container,
    );

    this.container.addChild(
      createButton({
        x: 150,
        y: 528,
        width: 450,
        height: 68,
        label: '用户信息',
        onTap: () => ctx.dispatch({ type: 'openSettings' }),
      }).container,
    );
    this.container.addChild(
      createButton({
        x: 150,
        y: 610,
        width: 450,
        height: 68,
        label: '补给',
        onTap: () => ctx.dispatch({ type: 'openSupplies' }),
      }).container,
    );
    this.container.addChild(
      createButton({
        x: 150,
        y: 692,
        width: 450,
        height: 68,
        label: '加桌领奖',
        onTap: () => ctx.dispatch({ type: 'desktopReward' }),
      }).container,
    );
    this.container.addChild(
      createButton({
        x: 150,
        y: 774,
        width: 450,
        height: 68,
        label: '设为常用领奖',
        onTap: () => ctx.dispatch({ type: 'favoriteReward' }),
      }).container,
    );

    this.platformAdButton = createButton({
      x: 150,
      y: 856,
      width: 450,
      height: 68,
      label: '入口奖励',
      variant: 'ad',
      onTap: () => ctx.dispatch({ type: 'requestRewardedAd', request: { type: 'extraMovesAd' } }),
    });
    this.platformAdButton.container.visible = false;
    this.container.addChild(this.platformAdButton.container);

    this.container.addChild(
      createButton({
        x: 150,
        y: 938,
        width: 450,
        height: 68,
        label: '关卡选择',
        onTap: () => ctx.dispatch({ type: 'openLevels' }),
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
    setText(this.coinText, `金币 ${view.save.coins}`);
    const current = view.chapterProgress.find((c) => c.current) ?? view.chapterProgress[0];
    if (current) {
      setText(this.chapterTitleText, current.title);
    }
    setText(this.progressText, `当前进度 ${view.highestLevel}/${view.levelCount}`);

    const showAdButton = view.platformName === 'douyin';
    if (showAdButton !== this.platformAdButtonVisible) {
      this.platformAdButtonVisible = showAdButton;
      this.platformAdButton.container.visible = showAdButton;
    }
  }

  dispose(): void {
    this.container.destroy({ children: true });
  }
}
