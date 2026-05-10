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

interface TextureInfo {
  texture: WebGLTexture;
  width: number;
  height: number;
}

export class WebglRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly imageCache = new ImageCache();
  private readonly imageTextures = new WeakMap<object, TextureInfo>();
  private readonly textTextures = new Map<string, TextureInfo>();
  private readonly hits: HitTarget[] = [];
  private transform: ViewportTransform = { scale: 1, offsetX: 0, offsetY: 0 };
  private pixelWidth = DESIGN_WIDTH;
  private pixelHeight = DESIGN_HEIGHT;

  private readonly colorProgram: WebGLProgram;
  private readonly colorPosition: number;
  private readonly colorUniform: WebGLUniformLocation;
  private readonly textureProgram: WebGLProgram;
  private readonly texturePosition: number;
  private readonly textureCoord: number;
  private readonly textureUniform: WebGLUniformLocation;
  private readonly buffer: WebGLBuffer;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly controller: GameController,
    private readonly assetBase: string,
    private readonly createRuntimeCanvas?: () => HTMLCanvasElement,
  ) {
    const gl = canvas.getContext('webgl', { alpha: false }) as WebGLRenderingContext | null;
    if (!gl) {
      throw new Error('WebGL context is unavailable.');
    }
    this.gl = gl;
    this.colorProgram = this.createProgram(
      'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}',
      'precision mediump float;uniform vec4 c;void main(){gl_FragColor=c;}',
    );
    this.colorPosition = gl.getAttribLocation(this.colorProgram, 'a');
    const colorUniform = gl.getUniformLocation(this.colorProgram, 'c');
    if (!colorUniform) throw new Error('Missing WebGL color uniform.');
    this.colorUniform = colorUniform;

    this.textureProgram = this.createProgram(
      'attribute vec2 a;attribute vec2 t;varying vec2 v;void main(){gl_Position=vec4(a,0.0,1.0);v=t;}',
      'precision mediump float;varying vec2 v;uniform sampler2D s;void main(){gl_FragColor=texture2D(s,v);}',
    );
    this.texturePosition = gl.getAttribLocation(this.textureProgram, 'a');
    this.textureCoord = gl.getAttribLocation(this.textureProgram, 't');
    const textureUniform = gl.getUniformLocation(this.textureProgram, 's');
    if (!textureUniform) throw new Error('Missing WebGL texture uniform.');
    this.textureUniform = textureUniform;

    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Unable to create WebGL buffer.');
    this.buffer = buffer;

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
    this.pixelWidth = Math.max(1, Math.floor(width * dpr));
    this.pixelHeight = Math.max(1, Math.floor(height * dpr));
    this.canvas.width = this.pixelWidth;
    this.canvas.height = this.pixelHeight;
    const style = (this.canvas as HTMLCanvasElement & { style?: CSSStyleDeclaration }).style;
    if (style) {
      style.width = `${width}px`;
      style.height = `${height}px`;
    }
    this.gl.viewport(0, 0, this.pixelWidth, this.pixelHeight);
  }

  render(): void {
    const view = this.controller.getViewState();
    this.hits.length = 0;
    this.clear(theme.backgroundBottom);
    this.rect(-this.transform.offsetX, -this.transform.offsetY, DESIGN_WIDTH + Math.abs(this.transform.offsetX) * 2, DESIGN_HEIGHT + Math.abs(this.transform.offsetY) * 2, theme.backgroundBottom);
    this.rect(0, 0, DESIGN_WIDTH, 410, theme.backgroundTop);

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
      if (view.screen === 'win') this.drawWinOverlay();
      if (view.screen === 'failed') this.drawFailedOverlay();
    }
    if (view.adPrompt) {
      this.hits.length = 0;
      this.drawAdPrompt(view.adPrompt);
    }
  }

  private drawHome(): void {
    const view = this.controller.getViewState();
    this.text('就你眼神好', DESIGN_WIDTH / 2, 70, 50, 900, theme.ink, 'center');
    this.text(`第 ${view.level.levelNo} 关 · ${view.level.title}`, DESIGN_WIDTH / 2, 124, 24, 800, theme.muted, 'center');

    const preview = this.imageCache.get(this.assetUrl(view.level.background));
    this.roundRect(54, 164, 642, 770, 28, '#ffffff', theme.panelStroke);
    if (this.isImageReady(preview)) {
      this.drawCoverImage(preview, 68, 178, 614, 742);
    } else {
      this.roundRect(68, 178, 614, 742, 22, '#eef2f7');
      this.text('图片加载中', DESIGN_WIDTH / 2, 552, 30, 800, theme.muted, 'center');
    }
    this.rect(68, 790, 614, 130, 'rgba(15, 23, 42, 0.48)');
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
    if (this.isImageReady(image)) {
      this.drawImage(image, 0, 0, this.imageWidth(image), this.imageHeight(image), frame.x, frame.y, frame.width, frame.height);
    } else {
      this.rect(frame.x, frame.y, frame.width, frame.height, '#f1f5f9');
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
      if (!foundIds.has(target.id)) continue;
      const image = this.imageCache.get(this.assetUrl(target.image));
      for (const zone of hitZonesForTarget(view.level, target)) {
        if (this.isImageReady(image)) {
          this.drawImage(image, 0, 0, this.imageWidth(image), this.imageHeight(image), zone.x, zone.y, zone.width, zone.height);
        }
        this.strokeEllipse(zone.x + zone.width / 2, zone.y + zone.height / 2, Math.max(28, zone.width / 2), Math.max(28, zone.height / 2), theme.accent, 7);
      }
    }
    const hintedTarget = view.hintTargetId ? foundTargetById(view.level, view.hintTargetId) : undefined;
    if (hintedTarget && !foundIds.has(hintedTarget.id)) {
      for (const zone of hitZonesForTarget(view.level, hintedTarget)) {
        this.strokeEllipse(zone.x + zone.width / 2, zone.y + zone.height / 2, Math.max(32, zone.width / 2 + 10), Math.max(32, zone.height / 2 + 10), 'rgba(245, 158, 11, 0.72)', 9);
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
    const slotSize = 52;
    const gap = 12;
    for (let index = 0; index < view.level.targets.length; index += 1) {
      const x = 58 + index * (slotSize + gap);
      const slotY = y + 86;
      this.roundRect(x, slotY, slotSize, slotSize, 14, view.foundIds[index] ? theme.accentSoft : '#ffffff', view.foundIds[index] ? theme.accent : theme.panelStroke);
      const target = view.foundIds[index] ? foundTargetById(view.level, view.foundIds[index]) : undefined;
      const image = target ? this.imageCache.get(this.assetUrl(target.image)) : null;
      if (this.isImageReady(image)) {
        this.drawImage(image, 0, 0, this.imageWidth(image), this.imageHeight(image), x + 6, slotY + 6, slotSize - 12, slotSize - 12);
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
      if (this.isImageReady(preview)) {
        this.drawCoverImage(preview, x + 16, y + 18, 92, 84);
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
    this.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 'rgba(15, 23, 42, 0.42)');
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
    this.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 'rgba(15, 23, 42, 0.42)');
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
    if (!touch) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    void this.handleDesignPoint(clientPointToDesign(this.canvas, { x: touch.clientX, y: touch.clientY }, this.transform));
  };

  private async handleDesignPoint(point: Point): Promise<void> {
    const view = this.controller.getViewState();
    const hit = [...this.hits].reverse().find((target) => point.x >= target.rect.x && point.x <= target.rect.x + target.rect.width && point.y >= target.rect.y && point.y <= target.rect.y + target.rect.height);
    const screen = view.screen;
    if (view.adPrompt) {
      if (hit?.type === 'adConfirm') {
        this.controller.playUiClick();
        await this.controller.confirmRewardedAd();
      } else if (hit?.type === 'adCancel') {
        this.controller.playUiClick();
        this.controller.cancelRewardedAd();
      }
      return;
    }
    if (!shouldHandleHit(screen, hit?.type ?? null)) return;
    if (!hit) {
      if (screen === 'playing') this.controller.tap(point);
      return;
    }
    if (hit.type === 'target') {
      if (screen === 'playing') this.controller.tap(point);
      return;
    }
    if (hit.type === 'continue') this.controller.nextLevel();
    else if (hit.type === 'level') this.controller.startLevel(hit.levelNo ?? view.level.levelNo);
    else if (hit.type === 'start') this.controller.startGame();
    else if (hit.type === 'home') this.controller.showHome();
    else if (hit.type === 'settings') this.controller.showSettings();
    else if (hit.type === 'hint') this.controller.useHint();
    else if (hit.type === 'adHint') this.controller.requestRewardedAd({ type: 'hint' });
    else if (hit.type === 'adTime') this.controller.requestRewardedAd({ type: 'add_time' });
    else if (hit.type === 'daily') this.controller.claimDailyReward();
    else if (hit.type === 'doubleReward') this.controller.requestRewardedAd({ type: 'double_reward' });
    else if (hit.type === 'sound') this.controller.toggleSound();
    else if (hit.type === 'retry') this.controller.startLevel(view.level.levelNo);
    this.controller.playUiClick();
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

  private adButton(x: number, y: number, width: number, height: number, label: string, type: AdButtonType): void {
    this.roundRect(x, y, width, height, Math.min(22, height / 2), theme.gold, theme.panelStroke);
    this.text(label, x + width / 2, y + height / 2 + 1, height >= 60 ? 24 : 18, 850, '#ffffff', 'center');
    this.hits.push({ type, rect: { x, y, width, height } });
  }

  private drawAdPrompt(prompt: AdPrompt): void {
    this.rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, 'rgba(15, 23, 42, 0.52)');
    this.roundRect(88, 420, 574, 334, 28, '#ffffff', 'rgba(15, 23, 42, 0.18)');
    this.text('领取奖励', DESIGN_WIDTH / 2, 486, 42, 900, theme.ink, 'center');
    this.text(prompt.title, DESIGN_WIDTH / 2, 548, 28, 800, theme.muted, 'center');
    this.text('看完后领取。', DESIGN_WIDTH / 2, 592, 21, 700, theme.muted, 'center');
    this.adButton(130, 640, 220, 66, '确认观看', 'adConfirm');
    this.button(368, 640, 206, 66, '取消', '#ffffff', theme.ink, 'adCancel');
  }

  private drawMissMarker(point: Point): void {
    this.fillEllipse(point.x, point.y, 28, 28, 'rgba(225, 29, 72, 0.16)');
    this.line(point.x - 15, point.y - 15, point.x + 15, point.y + 15, '#ffffff', 10);
    this.line(point.x + 15, point.y - 15, point.x - 15, point.y + 15, '#ffffff', 10);
    this.strokeEllipse(point.x, point.y, 24, 24, theme.accent, 5);
  }

  private drawCoverImage(image: HTMLImageElement | null, x: number, y: number, width: number, height: number): void {
    if (!this.isImageReady(image)) return;
    const sourceRatio = this.imageWidth(image) / this.imageHeight(image);
    const targetRatio = width / height;
    let sx = 0;
    let sy = 0;
    let sw = this.imageWidth(image);
    let sh = this.imageHeight(image);
    if (sourceRatio > targetRatio) {
      sw = this.imageHeight(image) * targetRatio;
      sx = (this.imageWidth(image) - sw) / 2;
    } else {
      sh = this.imageWidth(image) / targetRatio;
      sy = (this.imageHeight(image) - sh) / 2;
    }
    this.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  }

  private drawMessage(y: number): void {
    const message = this.controller.getViewState().feedback.message;
    if (message) this.text(message, DESIGN_WIDTH / 2, y, 21, 800, theme.accent, 'center');
  }

  private roundRect(x: number, y: number, width: number, height: number, _radius: number, fill: string, stroke?: string): void {
    this.rect(x, y, width, height, fill);
    if (stroke) {
      this.line(x, y, x + width, y, stroke, 2);
      this.line(x + width, y, x + width, y + height, stroke, 2);
      this.line(x + width, y + height, x, y + height, stroke, 2);
      this.line(x, y + height, x, y, stroke, 2);
    }
  }

  private text(text: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign): void {
    const texture = this.getTextTexture(text, size, weight, color);
    if (!texture) return;
    const scale = size / Math.max(1, texture.height * 0.66);
    const width = texture.width * scale;
    const height = texture.height * scale;
    const left = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    this.drawTexture(texture.texture, texture.width, texture.height, 0, 0, texture.width, texture.height, left, y - height / 2, width, height);
  }

  private rect(x: number, y: number, width: number, height: number, color: string): void {
    const gl = this.gl;
    gl.useProgram(this.colorProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.rectVertices(x, y, width, height)), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this.colorPosition);
    gl.vertexAttribPointer(this.colorPosition, 2, gl.FLOAT, false, 0, 0);
    gl.uniform4fv(this.colorUniform, this.parseColor(color));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private line(x1: number, y1: number, x2: number, y2: number, color: string, width: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length * width / 2;
    const ny = dx / length * width / 2;
    const vertices = [
      this.toClip(x1 + nx, y1 + ny), this.toClip(x1 - nx, y1 - ny),
      this.toClip(x2 + nx, y2 + ny), this.toClip(x2 - nx, y2 - ny),
    ].flat();
    const gl = this.gl;
    gl.useProgram(this.colorProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this.colorPosition);
    gl.vertexAttribPointer(this.colorPosition, 2, gl.FLOAT, false, 0, 0);
    gl.uniform4fv(this.colorUniform, this.parseColor(color));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private fillEllipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    const points = [this.toClip(cx, cy)];
    for (let i = 0; i <= 40; i += 1) {
      const a = (i / 40) * Math.PI * 2;
      points.push(this.toClip(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
    }
    this.drawColorFan(points.flat(), color);
  }

  private strokeEllipse(cx: number, cy: number, rx: number, ry: number, color: string, width: number): void {
    let previous = { x: cx + rx, y: cy };
    for (let i = 1; i <= 40; i += 1) {
      const a = (i / 40) * Math.PI * 2;
      const next = { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
      this.line(previous.x, previous.y, next.x, next.y, color, width);
      previous = next;
    }
  }

  private drawColorFan(vertices: number[], color: string): void {
    const gl = this.gl;
    gl.useProgram(this.colorProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this.colorPosition);
    gl.vertexAttribPointer(this.colorPosition, 2, gl.FLOAT, false, 0, 0);
    gl.uniform4fv(this.colorUniform, this.parseColor(color));
    gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length / 2);
  }

  private drawImage(image: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void {
    const texture = this.getImageTexture(image);
    if (!texture) return;
    this.drawTexture(texture.texture, texture.width, texture.height, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  private drawTexture(texture: WebGLTexture, textureWidth: number, textureHeight: number, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void {
    const gl = this.gl;
    const u0 = sx / textureWidth;
    const v0 = sy / textureHeight;
    const u1 = (sx + sw) / textureWidth;
    const v1 = (sy + sh) / textureHeight;
    const p = this.rectVertices(dx, dy, dw, dh);
    const vertices = new Float32Array([
      p[0], p[1], u0, v0,
      p[2], p[3], u0, v1,
      p[4], p[5], u1, v0,
      p[6], p[7], u1, v1,
    ]);
    gl.useProgram(this.textureProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(this.texturePosition);
    gl.vertexAttribPointer(this.texturePosition, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.textureCoord);
    gl.vertexAttribPointer(this.textureCoord, 2, gl.FLOAT, false, 16, 8);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.textureUniform, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private getImageTexture(image: HTMLImageElement): TextureInfo | null {
    const existing = this.imageTextures.get(image);
    if (existing) return existing;
    const texture = this.createTextureFromSource(image);
    if (!texture) return null;
    this.imageTextures.set(image, texture);
    return texture;
  }

  private getTextTexture(text: string, size: number, weight: number, color: string): TextureInfo | null {
    const key = `${text}|${size}|${weight}|${color}`;
    const existing = this.textTextures.get(key);
    if (existing) return existing;
    const canvas = this.createTextCanvas(text, size, weight, color);
    if (!canvas) return null;
    const texture = this.createTextureFromSource(canvas);
    if (!texture) return null;
    this.textTextures.set(key, texture);
    return texture;
  }

  private createTextCanvas(text: string, size: number, weight: number, color: string): HTMLCanvasElement | null {
    const source = typeof document !== 'undefined' && typeof document.createElement === 'function'
      ? document.createElement('canvas')
      : this.createRuntimeCanvas?.() ?? null;
    if (!source) return null;
    const ctx = source.getContext('2d');
    if (!ctx) return null;
    ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const metrics = ctx.measureText(text);
    source.width = Math.max(8, Math.ceil(metrics.width + size));
    source.height = Math.max(8, Math.ceil(size * 1.7));
    ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, source.width / 2, source.height / 2);
    return source;
  }

  private createTextureFromSource(source: TexImageSource & { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }): TextureInfo | null {
    const width = source.naturalWidth || source.width || 0;
    const height = source.naturalHeight || source.height || 0;
    if (!width || !height) return null;
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) return null;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return { texture, width, height };
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;
    const vertex = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create WebGL program.');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Unable to link WebGL program.');
    }
    return program;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to create WebGL shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Unable to compile WebGL shader.');
    }
    return shader;
  }

  private clear(color: string): void {
    const [r, g, b, a] = this.parseColor(color);
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  private rectVertices(x: number, y: number, width: number, height: number): number[] {
    return [
      ...this.toClip(x, y),
      ...this.toClip(x, y + height),
      ...this.toClip(x + width, y),
      ...this.toClip(x + width, y + height),
    ];
  }

  private toClip(x: number, y: number): [number, number] {
    const px = (x + this.transform.offsetX) * this.transform.scale;
    const py = (y + this.transform.offsetY) * this.transform.scale;
    return [(px / this.pixelWidth) * 2 - 1, 1 - (py / this.pixelHeight) * 2];
  }

  private parseColor(color: string): Float32Array {
    const rgba = color.match(/^rgba?\(([^)]+)\)$/);
    if (rgba) {
      const parts = rgba[1].split(',').map((part) => Number(part.trim()));
      return new Float32Array([(parts[0] || 0) / 255, (parts[1] || 0) / 255, (parts[2] || 0) / 255, parts[3] ?? 1]);
    }
    const hex = color.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      const value = Number.parseInt(hex[1], 16);
      return new Float32Array([((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, 1]);
    }
    return new Float32Array([1, 1, 1, 1]);
  }

  private isImageReady(image: HTMLImageElement | null): image is HTMLImageElement {
    return !!image && (image.complete || this.imageWidth(image) > 0) && this.imageWidth(image) > 0 && this.imageHeight(image) > 0;
  }

  private imageWidth(image: HTMLImageElement): number {
    return image.naturalWidth || (image as HTMLImageElement & { width?: number }).width || 0;
  }

  private imageHeight(image: HTMLImageElement): number {
    return image.naturalHeight || (image as HTMLImageElement & { height?: number }).height || 0;
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
}
