/**
 * 设置 modal（对应旧 drawSettings）。叠在底层 screen 上的半透明 modal。
 * 显示用户编号、音乐/音效切换、返回主页、赞助、（战斗中额外）重玩 + 跳关。
 */
import { Container, Graphics, Text } from 'pixi.js';
import type { AppViewState } from '../../app/controller';
import { createButton, type ButtonHandle } from '../ui/button';
import { createPanel } from '../ui/panel';
import { createText, setText } from '../ui/text';
import type { PixiScreen, ScreenContext } from './base';

export class SettingsScreen implements PixiScreen {
  readonly container: Container;
  private readonly userIdText: Text;
  private readonly musicButton: ButtonHandle;
  private readonly soundButton: ButtonHandle;
  private readonly retryButton: ButtonHandle;
  private readonly skipButton: ButtonHandle;
  private retryVisible = false;

  constructor(ctx: ScreenContext) {
    this.container = new Container();
    this.container.label = 'settings';

    const overlay = new Graphics();
    overlay.rect(0, 0, ctx.logicalWidth, ctx.logicalHeight).fill({ color: 0x000000, alpha: 0.55 });
    this.container.addChild(overlay);

    this.container.addChild(createPanel({ x: 80, y: 220, width: 590, height: 860 }));
    this.container.addChild(createText({ text: '设置', size: 52, color: 0xffffff, x: 375, y: 282 }));

    this.userIdText = createText({ text: '', size: 24, color: 0xd1fae5, x: 375, y: 340 });
    this.container.addChild(this.userIdText);

    this.container.addChild(
      createButton({
        x: 596, y: 238, width: 50, height: 50, label: '关', labelSize: 22,
        onTap: () => ctx.dispatch({ type: 'closeModal' }),
      }).container,
    );

    this.musicButton = createButton({
      x: 150, y: 390, width: 450, height: 72, label: '音乐：开',
      onTap: () => ctx.dispatch({ type: 'toggleMusic' }),
    });
    this.container.addChild(this.musicButton.container);

    this.soundButton = createButton({
      x: 150, y: 482, width: 450, height: 72, label: '音效：开',
      onTap: () => ctx.dispatch({ type: 'toggleSound' }),
    });
    this.container.addChild(this.soundButton.container);

    this.container.addChild(
      createButton({
        x: 150, y: 574, width: 450, height: 72, label: '返回主页',
        onTap: () => ctx.dispatch({ type: 'home' }),
      }).container,
    );

    this.container.addChild(
      createButton({
        x: 150, y: 666, width: 450, height: 72, label: '赞助支持', variant: 'ad',
        onTap: () => ctx.dispatch({ type: 'requestRewardedAd', request: { type: 'sponsor' } }),
      }).container,
    );

    // inGame 模式才显示的两个按钮，初始隐藏。
    this.retryButton = createButton({
      x: 150, y: 758, width: 450, height: 72, label: '重新开始',
      onTap: () => ctx.dispatch({ type: 'retry' }),
    });
    this.retryButton.container.visible = false;
    this.container.addChild(this.retryButton.container);

    this.skipButton = createButton({
      x: 150, y: 850, width: 450, height: 72, label: '跳过本关', variant: 'ad',
      onTap: () => ctx.dispatch({ type: 'requestRewardedAd', request: { type: 'skipLevel' } }),
    });
    this.skipButton.container.visible = false;
    this.container.addChild(this.skipButton.container);
  }

  show(view: AppViewState, nowMs: number): void {
    this.container.visible = true;
    this.update(view, nowMs);
  }

  hide(): void {
    this.container.visible = false;
  }

  update(view: AppViewState, _nowMs: number): void {
    setText(this.userIdText, `用户编号 ${view.userId}`);
    this.musicButton.setLabel(`音乐：${view.save.musicEnabled ? '开' : '关'}`);
    this.soundButton.setLabel(`音效：${view.save.soundEnabled ? '开' : '关'}`);

    const inGame = view.session?.status === 'playing';
    if (inGame !== this.retryVisible) {
      this.retryVisible = inGame;
      this.retryButton.container.visible = inGame;
      this.skipButton.container.visible = inGame;
    }
  }

  dispose(): void {
    this.container.destroy({ children: true });
  }
}
