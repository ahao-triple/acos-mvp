import type { GameController } from '../app/controller';
import { foundTargetById } from '../app/controller';
import type { DifferenceTarget } from '../assets/types';
import { DESIGN_HEIGHT, DESIGN_WIDTH, hitZonesForTarget, imageFrameForLevel, type Point, type Rect } from '../core/geometry';
import { ImageCache } from './imageCache';
import { shouldHandleHit, type HitTargetType } from './hitPolicy';
import { clientPointToDesign, viewportTransform, type ViewportTransform } from './scaler';
import { theme } from './theme';

type AdButtonType = Extract<HitTargetType, 'adHint' | 'adTime' | 'doubleReward'>;

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
    this.ctx.clearRect(-this.transform.offsetX, -this.transform.offsetY, DESIGN_WIDTH + Math.abs(this.transform.offsetX) * 2, DESIGN_HEIGHT + Math.abs(this.transform.offsetY) * 2);
    this.drawBackground();

    if (view.screen === 'home') {
      this.drawHome();
      return;
    }
    if (view.screen === 'settings') {
      this.drawSettings();
      return;
    }
    if (view.screen === 'levels') {
      this.drawLevelSelect();
      return;
    }

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

  private drawBackground(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
    gradient.addColorStop(0, theme.backgroundTop);
    gradient.addColorStop(1, theme.backgroundBottom);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  }

  private drawHome(): void {
    const view = this.controller.getViewState();
    this.text('找茬闯关', DESIGN_WIDTH / 2, 70, 50, 900, theme.ink, 'center');
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
    this.text(view.dailyRewardAvailable ? '每日奖励可领取' : '今日奖励已领取', 644, 876, 22, 700, '#ffffff', 'right');

    this.button(74, 982, 602, 76, '开始游戏', theme.accent, '#ffffff', 'start');
    this.button(74, 1084, 286, 70, '选择关卡', theme.sky, '#ffffff', 'level');
    this.button(390, 1084, 286, 70, view.dailyRewardAvailable ? '领取每日奖励' : '每日奖励', view.dailyRewardAvailable ? theme.gold : '#ffffff', view.dailyRewardAvailable ? '#ffffff' : theme.ink, 'daily');
    this.button(74, 1180, 286, 70, '设置', '#ffffff', theme.ink, 'settings');
    this.roundRect(390, 1180, 286, 70, 22, theme.cream, theme.panelStroke);
    this.text('7 关资源已接入', 533, 1224, 23, 800, theme.ink, 'center');

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
    this.text(`已完成 ${view.save.completedLevels.length} 关，最高解锁第 ${view.save.highestUnlockedLevel} 关`, 94, 468, 21, 700, theme.muted, 'left');
    this.text(`金币 ${view.save.coins}   提示 ${view.save.hints}`, 94, 512, 22, 700, theme.muted, 'left');
    this.text('声音关闭后，点击、失败和通关音效都会停止播放。', 94, 566, 20, 700, theme.muted, 'left');

    this.button(94, 626, 550, 66, '回到首页', theme.sky, '#ffffff', 'home');
    this.drawMessage(782);
  }

  private drawTopBar(title: string): void {
    this.roundRect(28, 28, 694, 118, 22, theme.panel, theme.panelStroke);
    this.text(title, 54, 88, 36, 900, theme.ink, 'left');
    this.button(496, 54, 92, 54, '首页', '#ffffff', theme.ink, 'home');
    this.button(604, 54, 92, 54, '设置', '#ffffff', theme.ink, 'settings');
  }

  private drawHeader(): void {
    const view = this.controller.getViewState();
    this.roundRect(28, 28, 694, 144, 22, theme.panel, theme.panelStroke);
    this.text('找不同', 54, 70, 32, 900, theme.ink, 'left');
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
      this.ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(view.feedback.point.x - 18, view.feedback.point.y - 18);
      this.ctx.lineTo(view.feedback.point.x + 18, view.feedback.point.y + 18);
      this.ctx.moveTo(view.feedback.point.x + 18, view.feedback.point.y - 18);
      this.ctx.lineTo(view.feedback.point.x - 18, view.feedback.point.y + 18);
      this.ctx.stroke();
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
    this.text('按顺序挑战，锁定关卡可主动看广告解锁。', DESIGN_WIDTH / 2, 190, 22, 700, theme.muted, 'center');
    for (const [index, level] of view.levels.entries()) {
      const unlocked = level.levelNo <= view.save.highestUnlockedLevel;
      const completed = view.save.completedLevels.includes(level.levelNo);
      const x = 62 + (index % 2) * 326;
      const y = 238 + Math.floor(index / 2) * 166;
      this.roundRect(x, y, 300, 136, 22, unlocked ? '#ffffff' : theme.locked, theme.panelStroke);
      const preview = this.imageCache.get(this.assetUrl(level.background));
      if (preview?.complete && preview.naturalWidth > 0) {
        this.drawCoverImage(preview, x + 16, y + 18, 96, 88, 14);
      } else {
        this.roundRect(x + 16, y + 18, 96, 88, 14, '#eef2f7');
        this.text(String(level.levelNo), x + 64, y + 64, 24, 900, theme.muted, 'center');
      }
      this.text(`第 ${level.levelNo} 关`, x + 130, y + 36, 24, 900, theme.ink, 'left');
      this.text(level.title, x + 130, y + 70, 20, 700, theme.muted, 'left');
      this.pill(x + 130, y + 88, 116, 28, completed ? '已完成' : unlocked ? '可挑战' : '锁定', completed ? theme.green : unlocked ? theme.gold : theme.muted);
      if (unlocked) {
        this.text('开始', x + 260, y + 116, 20, 800, theme.accent, 'right');
      } else {
        this.drawAdBadge(x + 128, y + 102, 38, 28);
        this.text('广告解锁', x + 260, y + 118, 20, 800, theme.gold, 'right');
      }
      this.hits.push({ type: 'level', levelNo: level.levelNo, rect: { x, y, width: 300, height: 136 } });
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
    const hit = [...this.hits].reverse().find((target) => point.x >= target.rect.x && point.x <= target.rect.x + target.rect.width && point.y >= target.rect.y && point.y <= target.rect.y + target.rect.height);
    const screen = this.controller.getViewState().screen;
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
      this.controller.nextLevel();
      return;
    }
    if (hit.type === 'level') {
      if (hit.levelNo) {
        const view = this.controller.getViewState();
        if (hit.levelNo <= view.save.highestUnlockedLevel) {
          this.controller.startLevel(hit.levelNo);
        } else {
          await this.controller.unlockLevelWithAd(hit.levelNo);
        }
      } else {
        this.controller.showLevels();
      }
      return;
    }
    if (hit.type === 'start') {
      this.controller.startGame();
      return;
    }
    if (hit.type === 'home') {
      this.controller.showHome();
      return;
    }
    if (hit.type === 'settings') {
      this.controller.showSettings();
      return;
    }
    if (hit.type === 'hint') {
      this.controller.useHint();
      return;
    }
    if (hit.type === 'adHint') {
      await this.controller.claimAdHint();
      return;
    }
    if (hit.type === 'adTime') {
      await this.controller.claimAdTimeBonus();
      return;
    }
    if (hit.type === 'daily') {
      this.controller.claimDailyReward();
      return;
    }
    if (hit.type === 'doubleReward') {
      await this.controller.claimDoubleReward();
      return;
    }
    if (hit.type === 'sound') {
      this.controller.toggleSound();
      return;
    }
    if (hit.type === 'retry') {
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
    const iconWidth = 38;
    const iconHeight = 28;
    const iconX = x + Math.max(16, width * 0.08);
    const iconY = y + (height - iconHeight) / 2;
    this.drawAdBadge(iconX, iconY, iconWidth, iconHeight);
    this.text(label, iconX + iconWidth + 12, y + height / 2 + 1, height >= 60 ? 24 : 19, 850, '#ffffff', 'left');
    this.hits.push({ type, rect: { x, y, width, height } });
  }

  private drawAdBadge(x: number, y: number, width: number, height: number): void {
    this.ctx.save();
    this.roundRect(x, y, width, height, 7, theme.accent, 'rgba(255,255,255,0.55)');
    this.ctx.fillStyle = 'rgba(255,255,255,0.92)';
    this.roundPath(x + 7, y + 7, width - 17, height - 14, 4);
    this.ctx.fill();
    this.ctx.fillStyle = theme.gold;
    this.ctx.beginPath();
    this.ctx.moveTo(x + width - 11, y + 8);
    this.ctx.lineTo(x + width - 5, y + height / 2);
    this.ctx.lineTo(x + width - 11, y + height - 8);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.fillStyle = theme.accent;
    this.ctx.beginPath();
    this.ctx.arc(x + 14, y + height / 2, 3.5, 0, Math.PI * 2);
    this.ctx.fill();
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
