/**
 * 结果 modal screens（paused / won / lost），三种共用通用骨架。
 * 旧 resultScreen.ts 是 3 个独立函数，Pixi 版我们做成 3 个 Screen 类，共用 OverlayBackdrop helper。
 */
import { Container, Graphics } from 'pixi.js';
import type { AppViewState } from '../../app/controller';
import { describeNodeReward, remainingTargetsText } from '../../app/campaign';
import { createButton } from '../ui/button';
import { createPanel } from '../ui/panel';
import { createText, setText, type AppText } from '../ui/text';
import type { PixiScreen, ScreenContext } from './base';

const TEXT_COLOR = 0x1a2332;

function createOverlayBackdrop(ctx: ScreenContext): Graphics {
  const g = new Graphics();
  g.rect(0, 0, ctx.logicalWidth, ctx.logicalHeight).fill({ color: 0xffffff, alpha: 0.68 });
  return g;
}

// ─────────────────────────────────────────────────────────────────────────
// 暂停 modal
// ─────────────────────────────────────────────────────────────────────────
export class PausedScreen implements PixiScreen {
  readonly container: Container;
  constructor(ctx: ScreenContext) {
    this.container = new Container();
    this.container.label = 'paused';
    this.container.addChild(createOverlayBackdrop(ctx));
    this.container.addChild(createPanel({ x: 105, y: 350, width: 540, height: 470 }));
    this.container.addChild(
      createButton({
        x: 585, y: 366, width: 44, height: 44, label: '关',
        onTap: () => ctx.dispatch({ type: 'closeModal' }),
        labelSize: 20,
      }).container,
    );
    this.container.addChild(createText({ text: '暂停', size: 56, color: TEXT_COLOR, x: 375, y: 430 }));
    const buttons: Array<[string, () => void, 'primary' | 'secondary']> = [
      ['继续', () => ctx.dispatch({ type: 'resume' }), 'primary'],
      ['重玩', () => ctx.dispatch({ type: 'retry' }), 'secondary'],
      ['返回首页', () => ctx.dispatch({ type: 'home' }), 'secondary'],
    ];
    buttons.forEach(([label, onTap, variant], i) => {
      this.container.addChild(
        createButton({ x: 175, y: 500 + i * 100, width: 400, height: 74, label, variant, onTap }).container,
      );
    });
  }
  show(): void { this.container.visible = true; }
  hide(): void { this.container.visible = false; }
  update(): void {}
  dispose(): void { this.container.destroy({ children: true }); }
}

// ─────────────────────────────────────────────────────────────────────────
// 通关 modal
// ─────────────────────────────────────────────────────────────────────────
export class WonScreen implements PixiScreen {
  readonly container: Container;
  private readonly chapterInfo: AppText;
  private readonly rewardInfo: AppText;
  private readonly nextLevelInfo: AppText;

  constructor(ctx: ScreenContext) {
    this.container = new Container();
    this.container.label = 'won';
    this.container.addChild(createOverlayBackdrop(ctx));
    this.container.addChild(createPanel({ x: 80, y: 300, width: 590, height: 560 }));
    this.container.addChild(createText({ text: '梗爆出圈', size: 52, color: TEXT_COLOR, x: 375, y: 380 }));
    this.chapterInfo = createText({ text: '', size: 26, color: TEXT_COLOR, x: 375, y: 460 });
    this.rewardInfo = createText({ text: '', size: 26, color: TEXT_COLOR, x: 375, y: 520 });
    this.nextLevelInfo = createText({ text: '', size: 26, color: TEXT_COLOR, x: 375, y: 580 });
    this.container.addChild(this.chapterInfo, this.rewardInfo, this.nextLevelInfo);

    this.container.addChild(
      createButton({ x: 175, y: 650, width: 400, height: 66, label: '下一关', variant: 'primary',
        onTap: () => ctx.dispatch({ type: 'nextLevel' }) }).container,
    );
    this.container.addChild(
      createButton({ x: 175, y: 728, width: 400, height: 66, label: '重玩本关',
        onTap: () => ctx.dispatch({ type: 'retry' }) }).container,
    );
    this.container.addChild(
      createButton({ x: 175, y: 806, width: 400, height: 66, label: '分享',
        onTap: () => ctx.dispatch({ type: 'shareReward' }) }).container,
    );
    this.container.addChild(
      createButton({ x: 175, y: 884, width: 400, height: 66, label: '返回主页',
        onTap: () => ctx.dispatch({ type: 'home' }) }).container,
    );
  }

  show(view: AppViewState): void { this.container.visible = true; this.update(view); }
  hide(): void { this.container.visible = false; }
  update(view: AppViewState): void {
    const s = view.winSummary;
    if (!s) {
      this.chapterInfo.visible = false;
      this.rewardInfo.visible = false; this.nextLevelInfo.visible = false;
      return;
    }
    setText(this.chapterInfo, `${s.chapterTitle}  第 ${s.levelId} 关完成`);
    this.chapterInfo.visible = true;

    const reward = describeNodeReward(s.nodeReward ?? undefined);
    if (reward) { setText(this.rewardInfo, `节点奖励 ${reward}`); this.rewardInfo.visible = true; }
    else { this.rewardInfo.visible = false; }

    if (s.nextLevelId) {
      setText(this.nextLevelInfo, `已解锁第 ${s.nextLevelId} 关`); this.nextLevelInfo.visible = true;
    } else { this.nextLevelInfo.visible = false; }
  }
  dispose(): void { this.container.destroy({ children: true }); }
}

// ─────────────────────────────────────────────────────────────────────────
// 失败 modal
// ─────────────────────────────────────────────────────────────────────────
export class LostScreen implements PixiScreen {
  readonly container: Container;
  private readonly remainingText: AppText;
  constructor(ctx: ScreenContext) {
    this.container = new Container();
    this.container.label = 'lost';
    this.container.addChild(createOverlayBackdrop(ctx));
    this.container.addChild(createPanel({ x: 80, y: 300, width: 590, height: 620 }));
    this.container.addChild(createText({ text: '梗气不足', size: 52, color: TEXT_COLOR, x: 375, y: 380 }));
    this.container.addChild(createText({ text: '未完成目标', size: 28, color: TEXT_COLOR, x: 375, y: 455 }));
    this.remainingText = createText({ text: '', size: 24, color: TEXT_COLOR, x: 375, y: 510 });
    this.container.addChild(this.remainingText);

    this.container.addChild(
      createButton({ x: 175, y: 610, width: 400, height: 70, label: '复活继续', variant: 'ad',
        onTap: () => ctx.dispatch({ type: 'requestRewardedAd', request: { type: 'extraMovesAd' } }) }).container,
    );
    this.container.addChild(
      createButton({ x: 175, y: 700, width: 400, height: 66, label: '重玩本关',
        onTap: () => ctx.dispatch({ type: 'retry' }) }).container,
    );
    this.container.addChild(
      createButton({ x: 175, y: 778, width: 400, height: 66, label: '分享',
        onTap: () => ctx.dispatch({ type: 'shareReward' }) }).container,
    );
    this.container.addChild(
      createButton({ x: 175, y: 856, width: 400, height: 66, label: '返回主页',
        onTap: () => ctx.dispatch({ type: 'home' }) }).container,
    );
  }
  show(view: AppViewState): void { this.container.visible = true; this.update(view); }
  hide(): void { this.container.visible = false; }
  update(view: AppViewState): void {
    setText(this.remainingText, view.session ? remainingTargetsText(view.session) : '');
  }
  dispose(): void { this.container.destroy({ children: true }); }
}
