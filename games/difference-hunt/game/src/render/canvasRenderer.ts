import type { AdPrompt, GameController } from '../app/controller';
import { foundTargetById } from '../app/controller';
import type { DifferenceTarget } from '../assets/types';
import { DESIGN_HEIGHT, DESIGN_WIDTH, hitZonesForTarget, imageFrameForLevel, type Point, type Rect } from '../core/geometry';
import { ImageCache } from './imageCache';
import { shouldHandleHit, type HitTargetType } from './hitPolicy';
import { clientPointToDesign, viewportTransform, type ViewportTransform } from './scaler';
import { theme } from './theme';

type AdButtonType = Extract<HitTargetType, 'adHint' | 'adTime' | 'doubleReward' | 'adConfirm'>;

interface HitTarget {
  type: HitTargetType;
  target?: DifferenceTarget;
  levelNo?: number;
  rect: Rect;
}

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly imageCache = new ImageCache();
  private readonly hits: HitTarget[] = [];
  private transform: ViewportTransform = { scale: 1, offsetX: 0, offsetY: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly controller: GameController,
    private readonly assetBase: string,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is unavailable.');
    }
    this.ctx = ctx;
    this.onPointerDown = this.onPointerDown.bind(this);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
  }

  resize(width: number, height: number, dpr: number): void {
    this.transform = viewportTransform(width, height);
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    const style = (this.canvas as HTMLCanvasElement & { style?: CSSStyleDeclaration }).style;
    if (style) {
      style.width = `${width}px`;
      style.height = `${height}px`;
    }
    this.ctx.setTransform(
      dpr * this.transform.scale,
      0,
      0,
      dpr * this.transform.scale,
      dpr * this.transform.offsetX * this.transform.scale,
      dpr * this.transform.offsetY * this.transform.scale,
    );
  }

  render(): void {
    const view = this.controller.getViewState();
    this.hits.length = 0;
    this.drawViewportBackground();
    this.ctx.clearRect(-this.transform.offsetX, -this.transform.offsetY, DESIGN_WIDTH + Math.abs(this.transform.offsetX) * 2, DESIGN_HEIGHT + Math.abs(this.transform.offsetY) * 2);
    this.drawBackground();

    if (view.screen === 'home') {
      this.drawHome();
    } else if (view.screen === 'settings') {
      this.drawSettings();
    } else if (view.screen === 'levels') {
      this.drawLevelSelect();
    } else {
      this.drawHeader();
      this.drawLevelImage();
      this.drawFoundMarks();
      this.drawTray();
      if (view.screen === 'win') {
        this.drawWinOverlay();
      }
      if (view.screen === 'failed') {
        this.drawFailedOverlay();
      }
    }
    if (view.adPrompt) {
      this.hits.length = 0;
      this.drawAdPrompt(view.adPrompt);
    }
  }

  private drawBackground(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
    gradient.addColorStop(0, theme.backgroundTop);
    gradient.addColorStop(1, theme.backgroundBottom);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  }

  private drawViewportBackground(): void {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    const width = Math.max(1, this.canvas.width);
    const height = Math.max(1, this.canvas.height);
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, theme.backgroundTop);
    gradient.addColorStop(1, theme.backgroundBottom);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.restore();
  }

  private drawHome(): void {
    const view = this.controller.getViewState();
    this.text('就你眼神好', DESIGN_WIDTH / 2, 70, 50, 900, theme.ink, 'center');
    this.text(`第 ${view.level.levelNo} 关 · ${view.level.title}`, DESIGN_WIDTH / 2, 124, 24, 800, theme.muted, 'center');

    const preview = this.imageCache.get(this.assetUrl(view.level.background));
    this.roundRect(54, 164, 642, 770, 28, '#ffffff', theme.panelStroke);
    if (preview?.complete && preview.naturalWidth > 0) {
      this.drawCoverImage(preview, 68, 178, 614, 742, 22);
    } else {
      this.roundRect(68, 178, 614, 742, 22, '#eef2f7');
      this.text('图片加载中', DESIGN_WIDTH / 2, 552, 30, 800, theme.muted, 'center');
    }
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.48)';
    this.ctx.fillRect(68, 790, 614, 130);
    this.text(`已解锁 ${view.save.highestUnlockedLevel}/${view.levels.length} 关`, 106, 834, 24, 800, '#ffffff', 'left');
    this.text(`金币 ${view.save.coins}   提示 ${view.save.hints}`, 106, 876, 22, 700, 'rgba(255,255,255,0.86)', 'left');
    this.text(view.dailyRewardAvailable ? '今日可领' : '今日已领', 644, 876, 22, 700, '#ffffff', 'right');

    this.button(74, 982, 602, 76, '开始游戏', theme.accent, '#ffffff', 'start');
    this.button(74, 1084, 286, 70, '选择关卡', theme.sky, '#ffffff', 'level');
    this.button(390, 1084, 286, 70, view.dailyRewardAvailable ? '领取每日奖励' : '每日奖励', view.dailyRewardAvailable ? theme.gold : '#ffffff', view.dailyRewardAvailable ? '#ffffff' : theme.ink, 'daily');
    this.button(74, 1180, 286, 70, '设置', '#ffffff', theme.ink, 'settings');
    this.roundRect(390, 1180, 286, 70, 22, theme.cream, theme.panelStroke);
    this.text('7 关已开放', 533, 1224, 23, 800, theme.ink, 'center');

    this.drawMessage(1268);
  }

  private drawSettings(): void {
    const view = this.controller.getViewState();
    this.drawTopBar('设置');
    this.roundRect(54, 220, 642, 496, 28, theme.panel, theme.panelStroke);
    this.text('声音', 94, 294, 28, 800, theme.ink, 'left');
    this.text(view.save.settings.soundEnabled ? '已开启' : '已关闭', 94, 338, 22, 700, theme.muted, 'left');
    this.button(472, 270, 172, 62, view.save.settings.soundEnabled ? '关闭' : '开启', view.save.settings.soundEnabled ? theme.accent : theme.green, '#ffffff', 'sound');

    this.text('进度', 94, 424, 28, 800, theme.ink, 'left');
    this.text(`已通关 ${view.save.completedLevels.length} 关`, 94, 468, 21, 700, theme.muted, 'left');
    this.text(`金币 ${view.save.coins}   提示 ${view.save.hints}`, 94, 512, 22, 700, theme.muted, 'left');
    this.text('音效开关可在此调整。', 94, 566, 20, 700, theme.muted, 'left');

    this.button(94, 626, 550, 66, '回到首页', theme.sky, '#ffffff', 'home');
    this.drawMessage(782);
  }

  private drawTopBar(title: string): void {
    this.roundRect(28, 28, 694, 118, 22, theme.panel, theme.panelStroke);
    this.text(title, 54, 88, 36, 900, theme.ink, 'left');
    this.button(484, 52, 104, 58, '首页', '#ffffff', theme.ink, 'home');
    this.button(600, 52, 104, 58, '设置', '#ffffff', theme.ink, 'settings');
  }

  private drawHeader(): void {
    const view = this.controller.getViewState();
    this.roundRect(28, 28, 694, 144, 22, theme.panel, theme.panelStroke);
    this.text('就你眼神好', 54, 70, 32, 900, theme.ink, 'left');
    this.text(`第 ${view.level.levelNo} 关  ${view.level.title}`, 54, 114, 23, 700, theme.muted, 'left');
    this.pill(336, 45, 138, 48, this.formatTimer(view.timer.remainingMs), view.timer.remainingMs <= 15_000 ? theme.accent : theme.green);
    this.pill(504, 45, 170, 48, `${view.remaining} 处未找`, view.remaining === 0 ? theme.green : theme.gold);
    this.button(336, 108, 96, 42, '首页', '#ffffff', theme.ink, 'home');
    this.button(448, 108, 96, 42, '选关', '#ffffff', theme.ink, 'level');
    this.button(560, 108, 114, 42, '设置', '#ffffff', theme.ink, 'settings');
  }

  private drawLevelImage(): void {
    const { level } = this.controller.getViewState();
    const frame = imageFrameForLevel(level);
    const image = this.imageCache.get(this.assetUrl(level.background));
    if (image?.complete && image.naturalWidth > 0) {
      this.ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height);
    } else {
      this.ctx.fillStyle = '#f1f5f9';
      this.ctx.fillRect(frame.x, frame.y, frame.width, frame.height);
      this.text('图片加载中', DESIGN_WIDTH / 2, frame.y + frame.height / 2, 28, 700, theme.muted, 'center');
    }

    const foundIds = new Set(this.controller.getViewState().foundIds);
    for (const target of level.targets) {
      if (!foundIds.has(target.id)) {
        for (const zone of hitZonesForTarget(level, target)) {
          this.hits.push({ type: 'target', target, rect: zone });
        }
      }
    }
  }

  private drawFoundMarks(): void {
    const view = this.controller.getViewState();
    const foundIds = new Set(view.foundIds);
    for (const target of view.level.targets) {
      if (!foundIds.has(target.id)) {
        continue;
      }
      const image = this.imageCache.get(this.assetUrl(target.image));
      for (const zone of hitZonesForTarget(view.level, target)) {
        if (image?.complete && image.naturalWidth > 0) {
          this.ctx.drawImage(image, zone.x, zone.y, zone.width, zone.height);
        }
        this.ctx.save();
        this.ctx.strokeStyle = theme.accent;
        this.ctx.lineWidth = 7;
        this.ctx.shadowColor = 'rgba(225, 29, 72, 0.38)';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.ellipse(zone.x + zone.width / 2, zone.y + zone.height / 2, Math.max(28, zone.width / 2), Math.max(28, zone.height / 2), 0, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    const hintedTarget = view.hintTargetId ? foundTargetById(view.level, view.hintTargetId) : undefined;
    if (hintedTarget && !foundIds.has(hintedTarget.id)) {
      const pulse = 0.55 + Math.sin(Date.now() / 180) * 0.2;
      for (const zone of hitZonesForTarget(view.level, hintedTarget)) {
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(245, 158, 11, ${pulse})`;
        this.ctx.lineWidth = 9;
        this.ctx.beginPath();
        this.ctx.ellipse(zone.x + zone.width / 2, zone.y + zone.height / 2, Math.max(32, zone.width / 2 + 10), Math.max(32, zone.height / 2 + 10), 0, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    if (view.feedback.type === 'miss' && view.feedback.point) {
      this.drawMissMarker(view.feedback.point);
    }
  }

  private drawTray(): void {
    const view = this.controller.getViewState();
    const y = 1138;
    this.roundRect(28, y, 694, 168, 24, theme.panel, theme.panelStroke);
    this.text(`已找到 ${view.foundIds.length}/${view.level.targets.length}`, 58, y + 42, 24, 800, theme.ink, 'left');
    if (view.save.hints > 0) {
      this.button(326, y + 18, 172, 50, `提示 x${view.save.hints}`, theme.green, '#ffffff', 'hint');
    } else {
      this.adButton(326, y + 18, 172, 50, '看广告提示', 'adHint');
    }
    this.adButton(516, y + 18, 174, 50, '加 30 秒', 'adTime');
    const foundIds = view.foundIds;
    const slotSize = 52;
    const gap = 12;
    for (let index = 0; index < view.level.targets.length; index += 1) {
      const x = 58 + index * (slotSize + gap);
      const slotY = y + 86;
      this.roundRect(x, slotY, slotSize, slotSize, 14, foundIds[index] ? theme.accentSoft : '#ffffff', foundIds[index] ? theme.accent : theme.panelStroke);
      const target = foundIds[index] ? foundTargetById(view.level, foundIds[index]) : undefined;
      const image = target ? this.imageCache.get(this.assetUrl(target.image)) : null;
      if (image?.complete && image.naturalWidth > 0) {
        this.ctx.drawImage(image, x + 6, slotY + 6, slotSize - 12, slotSize - 12);
      } else {
        this.text(String(index + 1), x + slotSize / 2, slotY + 34, 19, 800, theme.muted, 'center');
      }
    }
    this.drawMessage(y - 28);
  }

  private drawLevelSelect(): void {
    const view = this.controller.getViewState();
    this.drawTopBar('选择关卡');
    this.text('按顺序挑战，后续关卡可解锁。', DESIGN_WIDTH / 2, 190, 22, 700, theme.muted, 'center');
    for (const [index, level] of view.levels.entries()) {
      const unlocked = level.levelNo <= view.save.highestUnlockedLevel;
      const completed = view.save.completedLevels.includes(level.levelNo);
      const x = 62 + (index % 2) * 326;
      const y = 232 + Math.floor(index / 2) * 176;
      this.roundRect(x, y, 300, 150, 22, unlocked ? '#ffffff' : theme.locked, theme.panelStroke);
      const preview = this.imageCache.get(this.assetUrl(level.background));
      if (preview?.complete && preview.naturalWidth > 0) {
        this.drawCoverImage(preview, x + 16, y + 18, 92, 84, 14);
      } else {
        this.roundRect(x + 16, y + 18, 92, 84, 14, '#eef2f7');
        this.text(String(level.levelNo), x + 62, y + 60, 24, 900, theme.muted, 'center');
      }
      this.text(`第 ${level.levelNo} 关`, x + 124, y + 40, 24, 900, theme.ink, 'left');
      this.text(level.title, x + 124, y + 76, 20, 700, theme.muted, 'left');
      this.pill(x + 124, y + 100, 104, 30, completed ? '已完成' : unlocked ? '可挑战' : '锁定', completed ? theme.green : unlocked ? theme.gold : theme.muted);
      this.roundRect(x + 228, y + 100, 58, 30, 15, unlocked ? theme.accentSoft : theme.gold, unlocked ? theme.accent : '#ffffff');
      this.text(unlocked ? '开始' : '解锁', x + 257, y + 115, 17, 850, unlocked ? theme.accent : '#ffffff', 'center');
      this.hits.push({ type: 'level', levelNo: level.levelNo, rect: { x, y, width: 300, height: 150 } });
    }
    this.drawMessage(930);
  }

  private drawWinOverlay(): void {
    const view = this.controller.getViewState();
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
    this.ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.roundRect(74, 414, 602, 460, 28, '#ffffff', 'rgba(15, 23, 42, 0.2)');
    this.text('通关成功', DESIGN_WIDTH / 2, 500, 44, 900, theme.ink, 'center');
    this.text(`本关获得金币 ${view.reward.baseCoins}`, DESIGN_WIDTH / 2, 558, 26, 700, theme.muted, 'center');
    if (view.reward.doubleClaimed) {
      this.text('翻倍奖励已领取', DESIGN_WIDTH / 2, 636, 24, 800, theme.green, 'center');
    } else {
      this.adButton(110, 626, 530, 66, '奖励翻倍', 'doubleReward');
    }
    this.button(110, 720, 530, 66, view.level.levelNo >= view.levels.length ? '再玩一次' : '继续下一关', theme.accent, '#ffffff', 'continue');
    this.button(110, 800, 246, 48, '选关', '#ffffff', theme.ink, 'level');
    this.button(394, 800, 246, 48, '首页', '#ffffff', theme.ink, 'home');
  }

  private drawFailedOverlay(): void {
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
    this.ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.roundRect(74, 430, 602, 384, 28, '#ffffff', 'rgba(15, 23, 42, 0.2)');
    this.text('时间用完了', DESIGN_WIDTH / 2, 516, 42, 900, theme.ink, 'center');
    this.text('继续挑战或重新开始本关', DESIGN_WIDTH / 2, 570, 25, 700, theme.muted, 'center');
    this.adButton(110, 624, 530, 64, '加 30 秒', 'adTime');
    this.button(110, 706, 246, 54, '重试', theme.accent, '#ffffff', 'retry');
    this.button(394, 706, 246, 54, '选关', '#ffffff', theme.ink, 'level');
  }

  private onPointerDown(event: PointerEvent): void {
    void this.handleDesignPoint(clientPointToDesign(this.canvas, { x: event.clientX, y: event.clientY }, this.transform));
  }

  private onTouchStart = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    void this.handleDesignPoint(clientPointToDesign(this.canvas, { x: touch.clientX, y: touch.clientY }, this.transform));
  };

  private async handleDesignPoint(point: Point): Promise<void> {
    const view = this.controller.getViewState();
    const hit = [...this.hits].reverse().find((target) => point.x >= target.rect.x && point.x <= target.rect.x + target.rect.width && point.y >= target.rect.y && point.y <= target.rect.y + target.rect.height);
    const screen = view.screen;
    if (view.adPrompt) {
      if (!hit) {
        return;
      }
      if (hit.type === 'adConfirm') {
        this.controller.playUiClick();
        await this.controller.confirmRewardedAd();
        return;
      }
      if (hit.type === 'adCancel') {
        this.controller.playUiClick();
        this.controller.cancelRewardedAd();
        return;
      }
      return;
    }
    if (!shouldHandleHit(screen, hit?.type ?? null)) {
      return;
    }
    if (!hit) {
      if (screen === 'playing') {
        this.controller.tap(point);
      }
      return;
    }
    if (hit.type === 'target') {
      if (screen === 'playing') {
        this.controller.tap(point);
      }
      return;
    }
    if (hit.type === 'continue') {
      this.controller.playUiClick();
      this.controller.nextLevel();
      return;
    }
    if (hit.type === 'level') {
      this.controller.playUiClick();
      if (hit.levelNo) {
        this.controller.startLevel(hit.levelNo);
      } else {
        this.controller.showLevels();
      }
      return;
    }
    if (hit.type === 'start') {
      this.controller.playUiClick();
      this.controller.startGame();
      return;
    }
    if (hit.type === 'home') {
      this.controller.playUiClick();
      this.controller.showHome();
      return;
    }
    if (hit.type === 'settings') {
      this.controller.playUiClick();
      this.controller.showSettings();
      return;
    }
    if (hit.type === 'hint') {
      this.controller.playUiClick();
      this.controller.useHint();
      return;
    }
    if (hit.type === 'adHint') {
      this.controller.playUiClick();
      this.controller.requestRewardedAd({ type: 'hint' });
      return;
    }
    if (hit.type === 'adTime') {
      this.controller.playUiClick();
      this.controller.requestRewardedAd({ type: 'add_time' });
      return;
    }
    if (hit.type === 'daily') {
      this.controller.playUiClick();
      this.controller.claimDailyReward();
      return;
    }
    if (hit.type === 'doubleReward') {
      this.controller.playUiClick();
      this.controller.requestRewardedAd({ type: 'double_reward' });
      return;
    }
    if (hit.type === 'sound') {
      this.controller.playUiClick();
      this.controller.toggleSound();
      return;
    }
    if (hit.type === 'retry') {
      this.controller.playUiClick();
      this.controller.startLevel(this.controller.getViewState().level.levelNo);
    }
  }

  private assetUrl(path: string): string {
    return `${this.assetBase}${path}`;
  }

  private formatTimer(ms: number): string {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  private drawMessage(y: number): void {
    const message = this.controller.getViewState().feedback.message;
    if (!message) {
      return;
    }
    this.text(message, DESIGN_WIDTH / 2, y, 21, 800, theme.accent, 'center');
  }

  private adButton(x: number, y: number, width: number, height: number, label: string, type: AdButtonType): void {
    this.roundRect(x, y, width, height, Math.min(22, height / 2), theme.gold, theme.panelStroke);
    const iconHeight = Math.max(18, Math.min(28, height * 0.48));
    const iconWidth = iconHeight * (38 / 28);
    const iconX = x + Math.max(14, Math.min(20, width * 0.08));
    const iconY = y + (height - iconHeight) / 2;
    this.drawAdVideoIcon(iconX, iconY, iconWidth, iconHeight);
    const labelX = iconX + iconWidth + 12;
    this.text(label, labelX, y + height / 2 + 1, height >= 60 ? 24 : 18, 850, '#ffffff', 'left');
    this.hits.push({ type, rect: { x, y, width, height } });
  }

  private drawAdPrompt(prompt: AdPrompt): void {
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.52)';
    this.ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

    this.roundRect(88, 420, 574, 334, 28, '#ffffff', 'rgba(15, 23, 42, 0.18)');
    this.text('领取奖励', DESIGN_WIDTH / 2, 486, 42, 900, theme.ink, 'center');
    this.text(prompt.title, DESIGN_WIDTH / 2, 548, 28, 800, theme.muted, 'center');
    this.text('看完后领取。', DESIGN_WIDTH / 2, 592, 21, 700, theme.muted, 'center');
    this.adButton(130, 640, 220, 66, '确认观看', 'adConfirm');
    this.button(368, 640, 206, 66, '取消', '#ffffff', theme.ink, 'adCancel');
  }

  private drawAdVideoIcon(x: number, y: number, width: number, height: number): void {
    const py = (value: number): number => 28 - value;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(width / 38, height / 28);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(0, py(22.75));
    this.ctx.bezierCurveTo(0, py(25.64), 2.29, py(28), 5.12, py(28));
    this.ctx.lineTo(25.14, py(28));
    this.ctx.bezierCurveTo(27.97, py(28), 30.26, py(25.64), 30.26, py(22.75));
    this.ctx.lineTo(30.26, py(21.95));
    this.ctx.bezierCurveTo(30.26, py(21.52), 30.72, py(21.21), 31.16, py(21.37));
    this.ctx.lineTo(34.48, py(22.7));
    this.ctx.bezierCurveTo(36.17, py(23.37), 38, py(22.12), 38, py(20.28));
    this.ctx.lineTo(38, py(7.79));
    this.ctx.bezierCurveTo(38, py(5.93), 36.14, py(4.67), 34.45, py(5.38));
    this.ctx.lineTo(31.17, py(6.74));
    this.ctx.bezierCurveTo(30.74, py(6.91), 30.26, py(6.6), 30.26, py(6.14));
    this.ctx.lineTo(30.26, py(5.21));
    this.ctx.bezierCurveTo(30.26, py(2.34), 27.97, py(0), 25.14, py(0));
    this.ctx.lineTo(5.12, py(0));
    this.ctx.bezierCurveTo(2.29, py(0), 0, py(2.34), 0, py(5.21));
    this.ctx.lineTo(0, py(22.75));
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = theme.gold;
    this.ctx.beginPath();
    this.ctx.moveTo(20.62, py(11.82));
    this.ctx.bezierCurveTo(22.2, py(12.84), 22.2, py(15.16), 20.62, py(16.19));
    this.ctx.lineTo(14.97, py(19.86));
    this.ctx.bezierCurveTo(13.24, py(20.98), 10.95, py(19.74), 10.95, py(17.67));
    this.ctx.lineTo(10.95, py(10.34));
    this.ctx.bezierCurveTo(10.95, py(8.28), 13.24, py(7.03), 14.97, py(8.16));
    this.ctx.lineTo(20.62, py(11.82));
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawMissMarker(point: Point): void {
    this.ctx.save();
    this.ctx.translate(point.x, point.y);

    this.ctx.fillStyle = 'rgba(225, 29, 72, 0.16)';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 28, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 10;
    this.ctx.beginPath();
    this.ctx.moveTo(-15, -15);
    this.ctx.lineTo(15, 15);
    this.ctx.moveTo(15, -15);
    this.ctx.lineTo(-15, 15);
    this.ctx.stroke();

    this.ctx.strokeStyle = theme.accent;
    this.ctx.lineWidth = 5;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 24, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  private button(x: number, y: number, width: number, height: number, label: string, fill: string, color: string, type: HitTargetType): void {
    this.roundRect(x, y, width, height, Math.min(22, height / 2), fill, theme.panelStroke);
    this.text(label, x + width / 2, y + height / 2 + 1, height >= 60 ? 25 : 20, 850, color, 'center');
    this.hits.push({ type, rect: { x, y, width, height } });
  }

  private pill(x: number, y: number, width: number, height: number, label: string, color: string): void {
    this.roundRect(x, y, width, height, height / 2, color, color);
    this.text(label, x + width / 2, y + height / 2 + 1, Math.max(16, Math.min(21, height - 8)), 850, '#ffffff', 'center');
  }

  private drawCoverImage(image: HTMLImageElement, x: number, y: number, width: number, height: number, radius: number): void {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;
    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = image.naturalWidth / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }
    this.ctx.save();
    this.roundPath(x, y, width, height, radius);
    this.ctx.clip();
    this.ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
    this.ctx.restore();
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string): void {
    this.roundPath(x, y, width, height, radius);
    this.ctx.fillStyle = fill;
    this.ctx.fill();
    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  }

  private roundPath(x: number, y: number, width: number, height: number, radius: number): void {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + safeRadius, y);
    this.ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
    this.ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
    this.ctx.arcTo(x, y + height, x, y, safeRadius);
    this.ctx.arcTo(x, y, x + width, y, safeRadius);
    this.ctx.closePath();
  }

  private text(text: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);
  }
}
