import type { GameController, ToolName } from '../app/controller';
import type { AssetManifest } from '../assets/types';
import { resolveAssetUrl } from '../assets/loader';
import type { BoardCell, Direction } from '../core/types';
import { zhText } from '../i18n/zh';
import { feedbackCellMotion, feedbackProgress, hintPulse, revealMotion } from './animation';
import { boardDrawOrder } from './boardDrawPlan';
import { boardToCameraScreenPoint, type BoardCameraState } from './camera';
import { cellPresentation, formatTimerRemaining, type CellTone } from './cellPresentation';
import { BOARD_BOX, DESIGN_HEIGHT, DESIGN_WIDTH, boardLayout, cellRect, viewportScale } from './layout';
import { ImageCache } from './imageCache';
import { theme } from './theme';

interface HitTarget {
  type: 'cell' | 'continue' | 'retry' | 'tool' | 'hint' | 'levels' | 'level';
  index?: number;
  levelNo?: number;
  tool?: ToolName;
  rect: Rect;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  pointerId: number | null;
  start: { x: number; y: number };
  last: { x: number; y: number };
  moved: boolean;
}

interface PinchState {
  distance: number;
  origin: { x: number; y: number };
  startScale: number;
}

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly imageCache = new ImageCache();
  private readonly hits: HitTarget[] = [];
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private drag: DragState | null = null;
  private pinch: PinchState | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly controller: GameController,
    private readonly manifest: AssetManifest,
    private readonly assetBase: string,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is unavailable.');
    }
    this.ctx = ctx;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onDoubleClick = this.onDoubleClick.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('dblclick', this.onDoubleClick);
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd);
    canvas.addEventListener('touchcancel', this.onTouchEnd);
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('dblclick', this.onDoubleClick);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
  }

  resize(width: number, height: number, dpr: number): void {
    this.scale = viewportScale(width, height);
    const cssWidth = DESIGN_WIDTH * this.scale;
    const cssHeight = DESIGN_HEIGHT * this.scale;
    this.offsetX = (width - cssWidth) / 2 / this.scale;
    this.offsetY = (height - cssHeight) / 2 / this.scale;
    this.canvas.width = Math.max(1, Math.floor(width * dpr));
    this.canvas.height = Math.max(1, Math.floor(height * dpr));
    const style = (this.canvas as HTMLCanvasElement & { style?: CSSStyleDeclaration }).style;
    if (style) {
      style.width = `${width}px`;
      style.height = `${height}px`;
    }
    this.ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * this.offsetX * this.scale, dpr * this.offsetY * this.scale);
  }

  render(): void {
    const view = this.controller.getViewState();
    this.hits.length = 0;
    this.ctx.clearRect(-this.offsetX, -this.offsetY, DESIGN_WIDTH + Math.abs(this.offsetX) * 2, DESIGN_HEIGHT + Math.abs(this.offsetY) * 2);
    this.drawBackground();
    this.drawHud();
    this.drawLevelInfo();
    if (view.screen === 'levels') {
      this.drawLevelSelect();
      return;
    }
    this.drawBoard();
    this.drawTools();
    if (view.screen === 'win' && view.reveal.canContinue) {
      this.drawResult(zhText.results.winTitle, zhText.buttons.continue, 'continue');
    } else if (view.screen === 'failed') {
      this.drawResult(zhText.results.failedTitle, zhText.buttons.retry, 'retry');
    }
  }

  private drawBackground(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
    gradient.addColorStop(0, theme.backgroundTop);
    gradient.addColorStop(0.56, '#f8fbff');
    gradient.addColorStop(1, theme.backgroundBottom);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.46)';
    for (let y = 170; y < DESIGN_HEIGHT; y += 72) {
      this.ctx.fillRect(0, y, DESIGN_WIDTH, 2);
    }
  }

  private drawHud(): void {
    const { save } = this.controller.getViewState();
    this.roundRect(36, 32, 678, 92, 28, theme.panelStrong, 'rgba(16, 32, 51, 0.14)');
    this.text(zhText.title, 64, 86, 32, 700, theme.ink, 'left');
    this.pill(452, 48, 92, 46, zhText.energy(save.energy), theme.mint);
    this.pill(562, 48, 120, 46, zhText.coins(save.coins), theme.gold);
    this.roundRect(318, 48, 108, 46, 23, '#ffffff', 'rgba(16, 32, 51, 0.12)');
    this.text(zhText.buttons.levels, 372, 78, 18, 800, theme.ink, 'center');
    this.hits.push({ type: 'levels', rect: { x: 318, y: 48, width: 108, height: 46 } });
  }

  private drawLevelInfo(): void {
    const view = this.controller.getViewState();
    const timerLabel = formatTimerRemaining(view.timer.remainingMs);
    this.text(zhText.levelTitle(view.level.levelNo, view.level.title), 54, 190, 30, 800, theme.ink, 'left');
    this.text(timerLabel ? `${timerLabel}  ${zhText.moves(view.movesLeft)}` : zhText.moves(view.movesLeft), 696, 190, 26, 700, theme.ink, 'right');
    this.roundRect(54, 224, 642, 10, 5, 'rgba(16, 32, 51, 0.12)');
    this.roundRect(54, 224, 642 * view.progress, 10, 5, theme.coral);
  }

  private drawBoard(): void {
    const view = this.controller.getViewState();
    const now = Date.now();
    const animation = view.feedback.animation;
    const animationProgress = feedbackProgress(animation, now);
    this.roundRect(BOARD_BOX.x - 16, BOARD_BOX.y - 16, BOARD_BOX.size + 32, BOARD_BOX.size + 32, 34, 'rgba(255, 255, 255, 0.72)', 'rgba(35, 49, 66, 0.14)');
    this.roundRect(BOARD_BOX.x, BOARD_BOX.y, BOARD_BOX.size, BOARD_BOX.size, 20, '#eef7ff');

    this.ctx.save();
    this.clipBoardBox();
    this.applyBoardCamera(view.camera);

    const reveal = this.imageCache.get(resolveAssetUrl(this.assetBase, view.level.revealImage));
    if (reveal?.complete && reveal.naturalWidth > 0) {
      const motion = view.screen === 'win' && animation?.kind === 'reveal'
        ? revealMotion(animationProgress.progress)
        : { scale: 1, alpha: view.screen === 'win' ? 1 : 0.18 + view.progress * 0.42 };
      const size = BOARD_BOX.size * motion.scale;
      const x = BOARD_BOX.x + (BOARD_BOX.size - size) / 2;
      const y = BOARD_BOX.y + (BOARD_BOX.size - size) / 2;
      this.ctx.save();
      this.ctx.globalAlpha = motion.alpha;
      this.ctx.drawImage(reveal, x, y, size, size);
      this.ctx.restore();
    }

    const layout = boardLayout(view.level.board);
    const feedbackIndexes = new Set(view.feedback.indexes ?? []);
    const guidanceLabels: Array<{ label: string; x: number; y: number }> = [];
    for (const item of boardDrawOrder(view.board.cells, {
      feedbackIndexes: view.feedback.indexes,
      weakHint: view.weakHint,
      guidance: view.guidance,
    })) {
      const cell = view.board.cellsByIndex.get(item.index);
      if (!cell) {
        continue;
      }
      const rect = cellRect(layout, cell.index, view.board.width);
      if (item.layer === 'cell') {
        const isFeedbackCell = feedbackIndexes.has(cell.index) && animation && animationProgress.active;
        if (cell.cleared) {
          if (isFeedbackCell && (animation.kind === 'fly' || animation.kind === 'pulse')) {
            this.drawAnimatedCell(cell, rect, animation.kind, animationProgress.progress);
          }
          continue;
        }
        this.hits.push({
          type: 'cell',
          index: cell.index,
          rect: this.cameraRect({
            x: rect.x - layout.gap / 2,
            y: rect.y - layout.gap / 2,
            width: rect.width + layout.gap,
            height: rect.height + layout.gap,
          }, view.camera),
        });
        if (isFeedbackCell && (animation.kind === 'shake' || animation.kind === 'pulse')) {
          this.drawAnimatedCell(cell, rect, animation.kind, animationProgress.progress);
        } else {
          this.drawCell(cell, rect);
        }
      } else if (item.kind === 'weakHint') {
        this.drawHintRing(rect, 'rgba(255, 122, 104, 0.9)', now);
      } else {
        this.drawHintRing(rect, 'rgba(33, 166, 122, 0.95)', now);
        if (item.label) {
          const labelPoint = this.cameraPoint({ x: rect.x + rect.width / 2, y: rect.y - 24 }, view.camera);
          guidanceLabels.push({ label: item.label, x: labelPoint.x, y: labelPoint.y });
        }
      }
    }
    this.ctx.restore();
    for (const label of guidanceLabels) {
      this.text(label.label, label.x, label.y, 22, 800, theme.good, 'center');
    }
  }

  private clipBoardBox(): void {
    this.ctx.beginPath();
    this.ctx.rect(BOARD_BOX.x, BOARD_BOX.y, BOARD_BOX.size, BOARD_BOX.size);
    this.ctx.clip();
  }

  private applyBoardCamera(camera: BoardCameraState): void {
    const centerX = BOARD_BOX.x + BOARD_BOX.size / 2;
    const centerY = BOARD_BOX.y + BOARD_BOX.size / 2;
    this.ctx.translate(centerX + camera.x, centerY + camera.y);
    this.ctx.scale(camera.scale, camera.scale);
    this.ctx.translate(-centerX, -centerY);
  }

  private cameraRect(rect: Rect, camera: BoardCameraState): Rect {
    const topLeft = this.cameraPoint({ x: rect.x, y: rect.y }, camera);
    const bottomRight = this.cameraPoint({ x: rect.x + rect.width, y: rect.y + rect.height }, camera);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  private cameraPoint(point: { x: number; y: number }, camera: BoardCameraState): { x: number; y: number } {
    const transformed = boardToCameraScreenPoint(camera, { x: point.x - BOARD_BOX.x, y: point.y - BOARD_BOX.y });
    return {
      x: BOARD_BOX.x + transformed.x,
      y: BOARD_BOX.y + transformed.y,
    };
  }

  private drawHintRing(rect: Rect, color: string, now: number): void {
    const pulse = hintPulse(now);
    const width = (rect.width + 14) * pulse.scale;
    const height = (rect.height + 14) * pulse.scale;
    const x = rect.x + rect.width / 2 - width / 2;
    const y = rect.y + rect.height / 2 - height / 2;
    this.ctx.save();
    this.ctx.globalAlpha = pulse.alpha;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = pulse.lineWidth;
    this.ctx.setLineDash([12, 8]);
    this.ctx.lineDashOffset = pulse.dashOffset;
    this.roundRect(x, y, width, height, Math.max(8, rect.width * 0.18), 'rgba(255, 255, 255, 0)', color);
    this.ctx.restore();
  }

  private drawAnimatedCell(cell: BoardCell, rect: Rect, kind: 'fly' | 'shake' | 'pulse', progress: number): void {
    const motion = feedbackCellMotion(kind, cell.direction, progress, rect.width);
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    this.ctx.save();
    this.ctx.globalAlpha = motion.alpha;
    this.ctx.translate(cx + motion.offsetX, cy + motion.offsetY);
    this.ctx.scale(motion.scale, motion.scale);
    this.ctx.translate(-cx, -cy);
    this.drawCell(cell, rect);
    this.ctx.restore();
  }

  private drawCell(cell: BoardCell, rect: Rect): void {
    const view = this.controller.getViewState();
    const presentation = cellPresentation(view.board, cell);
    const highlighted = view.feedback.indexes?.includes(cell.index);
    const fill = highlighted ? '#fff2a8' : this.cellFill(presentation.tone);
    this.roundRect(rect.x, rect.y, rect.width, rect.height, Math.max(6, rect.width * 0.16), fill, 'rgba(16, 32, 51, 0.2)');

    if (presentation.arrowVisible) {
      this.ctx.fillStyle = this.cellInk(presentation.tone);
      this.drawArrow(rect.x + rect.width / 2, rect.y + rect.height / 2, Math.max(10, rect.width * 0.32), cell.direction);
    }
    if (presentation.label) {
      this.text(presentation.label, rect.x + rect.width / 2, rect.y + rect.height / 2, Math.max(16, rect.width * 0.18), 900, presentation.locked ? theme.muted : theme.ink, 'center');
    }
    if (presentation.locked) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.62;
      this.roundRect(rect.x + 6, rect.y + 6, rect.width - 12, rect.height - 12, Math.max(4, rect.width * 0.12), 'rgba(16, 32, 51, 0.08)', 'rgba(16, 32, 51, 0.22)');
      this.ctx.restore();
    }
    if (presentation.badge) {
      const size = Math.max(18, rect.width * 0.26);
      const x = rect.x + rect.width - size - 4;
      const y = rect.y + 4;
      this.roundRect(x, y, size, size, size / 2, this.badgeFill(presentation.tone), 'rgba(16, 32, 51, 0.14)');
      this.text(presentation.badge, x + size / 2, y + size / 2 + 1, Math.max(12, size * 0.54), 900, '#ffffff', 'center');
    }
  }

  private cellFill(tone: CellTone): string {
    if (tone === 'gold') {
      return '#fff3bf';
    }
    if (tone === 'timer') {
      return '#e2f3ff';
    }
    if (tone === 'bomb') {
      return '#ffe0dc';
    }
    if (tone === 'locked') {
      return 'rgba(255, 255, 255, 0.62)';
    }
    return '#ffffff';
  }

  private cellInk(tone: CellTone): string {
    if (tone === 'gold') {
      return '#b26a00';
    }
    if (tone === 'timer') {
      return '#1676a8';
    }
    if (tone === 'bomb') {
      return theme.coral;
    }
    return theme.ink;
  }

  private badgeFill(tone: CellTone): string {
    if (tone === 'gold') {
      return theme.gold;
    }
    if (tone === 'timer') {
      return theme.sky;
    }
    if (tone === 'bomb') {
      return theme.coral;
    }
    return theme.muted;
  }

  private drawArrow(cx: number, cy: number, size: number, direction: Direction): void {
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate((Math.PI / 2) * direction);
    this.ctx.beginPath();
    this.ctx.moveTo(0, -size);
    this.ctx.lineTo(size * 0.72, -size * 0.16);
    this.ctx.lineTo(size * 0.26, -size * 0.16);
    this.ctx.lineTo(size * 0.26, size);
    this.ctx.lineTo(-size * 0.26, size);
    this.ctx.lineTo(-size * 0.26, -size * 0.16);
    this.ctx.lineTo(-size * 0.72, -size * 0.16);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawTools(): void {
    const view = this.controller.getViewState();
    const tools: Array<{ key: ToolName; label: string }> = [
      { key: 'hint', label: zhText.tools.hint },
      { key: 'bomb', label: zhText.tools.bomb },
      { key: 'magnet', label: zhText.tools.magnet },
      { key: 'hammer', label: zhText.tools.hammer },
      { key: 'freeze', label: zhText.tools.freeze },
    ];
    const y = 996;
    const width = 120;
    for (let index = 0; index < tools.length; index += 1) {
      const tool = tools[index];
      const x = 45 + index * 132;
      const active = view.selectedTool === tool.key;
      this.roundRect(x, y, width, 132, 18, active ? '#dff8ef' : theme.panelStrong, 'rgba(16, 32, 51, 0.16)');
      this.text(tool.label, x + width / 2, y + 48, 20, 700, theme.ink, 'center');
      this.text(String(view.save.tools[tool.key]), x + width / 2, y + 92, 28, 800, active ? theme.good : theme.muted, 'center');
      this.hits.push({ type: tool.key === 'hint' ? 'hint' : 'tool', tool: tool.key, rect: { x, y, width, height: 132 } });
    }
  }

  private drawLevelSelect(): void {
    const view = this.controller.getViewState();
    this.text(zhText.screens.gallery, 54, 286, 34, 800, theme.ink, 'left');
    const cols = 5;
    const size = 108;
    const gap = 24;
    const startX = 54;
    const startY = 324;
    for (const item of view.levelSelect) {
      const index = item.levelNo - 1;
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (size + gap);
      const y = startY + row * (size + 46);
      const image = this.imageCache.get(resolveAssetUrl(this.assetBase, item.thumbnail));
      this.roundRect(x, y, size, size, 18, item.unlocked ? '#ffffff' : 'rgba(255, 255, 255, 0.48)', 'rgba(16, 32, 51, 0.14)');
      if (image?.complete && image.naturalWidth > 0) {
        this.ctx.save();
        this.ctx.globalAlpha = item.unlocked ? 1 : 0.28;
        this.ctx.drawImage(image, x + 10, y + 10, size - 20, size - 20);
        this.ctx.restore();
      }
      this.text(String(item.levelNo), x + size / 2, y + size + 24, 18, 800, item.unlocked ? theme.ink : theme.muted, 'center');
      if (item.unlocked) {
        this.hits.push({ type: 'level', levelNo: item.levelNo, rect: { x, y, width: size, height: size + 36 } });
      }
    }
  }

  private drawResult(title: string, action: string, type: 'continue' | 'retry'): void {
    this.roundRect(86, 1156, 578, 118, 30, theme.panelStrong, 'rgba(16, 32, 51, 0.18)');
    this.text(title, 124, 1210, 32, 800, theme.ink, 'left');
    this.roundRect(458, 1184, 168, 58, 20, type === 'continue' ? theme.good : theme.coral);
    this.text(action, 542, 1222, 22, 800, '#ffffff', 'center');
    this.hits.push({ type, rect: { x: 458, y: 1184, width: 168, height: 58 } });
  }

  private onPointerDown(event: PointerEvent): void {
    event.preventDefault?.();
    const point = this.eventToDesignPoint(event);
    if (this.canStartBoardDrag(point)) {
      this.drag = {
        pointerId: event.pointerId,
        start: point,
        last: point,
        moved: false,
      };
      return;
    }
    this.activateHit(point);
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.drag || (this.drag.pointerId !== null && event.pointerId !== this.drag.pointerId)) {
      return;
    }
    event.preventDefault?.();
    this.panDragTo(this.eventToDesignPoint(event));
  }

  private onPointerUp(event: PointerEvent): void {
    if (!this.drag || (this.drag.pointerId !== null && event.pointerId !== this.drag.pointerId)) {
      return;
    }
    event.preventDefault?.();
    const drag = this.drag;
    this.drag = null;
    if (!drag.moved) {
      this.activateHit(drag.start);
    }
  }

  private onWheel(event: WheelEvent): void {
    const point = this.eventToDesignPoint(event);
    const view = this.controller.getViewState();
    if (!view.camera.canZoom || !contains(boardRect(), point)) {
      return;
    }
    event.preventDefault?.();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.controller.zoomBoardCamera(view.camera.scale * factor, this.boardLocalPoint(point));
  }

  private onDoubleClick(event: MouseEvent): void {
    const point = this.eventToDesignPoint(event);
    const view = this.controller.getViewState();
    if (!view.camera.canZoom || !contains(boardRect(), point)) {
      return;
    }
    event.preventDefault?.();
    this.controller.zoomBoardCamera(view.camera.scale > 1.01 ? 1 : 1.8, this.boardLocalPoint(point));
  }

  private onTouchStart(event: TouchEvent): void {
    event.preventDefault?.();
    if (event.touches.length >= 2) {
      const view = this.controller.getViewState();
      const center = this.touchCenter(event);
      this.pinch = view.camera.canZoom && contains(boardRect(), center)
        ? {
            distance: this.touchDistance(event),
            origin: this.boardLocalPoint(center),
            startScale: view.camera.scale,
          }
        : null;
      return;
    }
    const point = this.eventToDesignPoint(event);
    if (this.canStartBoardDrag(point)) {
      this.drag = {
        pointerId: null,
        start: point,
        last: point,
        moved: false,
      };
      return;
    }
    this.activateHit(point);
  }

  private onTouchMove(event: TouchEvent): void {
    if (this.pinch && event.touches.length >= 2) {
      event.preventDefault?.();
      const ratio = this.touchDistance(event) / Math.max(1, this.pinch.distance);
      this.controller.zoomBoardCamera(this.pinch.startScale * ratio, this.pinch.origin);
      return;
    }
    if (this.drag) {
      event.preventDefault?.();
      this.panDragTo(this.eventToDesignPoint(event));
    }
  }

  private onTouchEnd(event: TouchEvent): void {
    if (event.touches.length < 2) {
      this.pinch = null;
    }
    if (!this.drag) {
      return;
    }
    const drag = this.drag;
    this.drag = null;
    if (!drag.moved) {
      this.activateHit(drag.start);
    }
  }

  private panDragTo(point: { x: number; y: number }): void {
    if (!this.drag) {
      return;
    }
    const dx = point.x - this.drag.last.x;
    const dy = point.y - this.drag.last.y;
    if (Math.abs(point.x - this.drag.start.x) > 4 || Math.abs(point.y - this.drag.start.y) > 4) {
      this.drag.moved = true;
    }
    if (dx !== 0 || dy !== 0) {
      this.controller.panBoardCamera({ dx, dy });
      this.drag.last = point;
    }
  }

  private canStartBoardDrag(point: { x: number; y: number }): boolean {
    const camera = this.controller.getViewState().camera;
    return camera.canPan && camera.scale > 1 && contains(boardRect(), point);
  }

  private activateHit(point: { x: number; y: number }): void {
    const hit = [...this.hits].reverse().find((target) => contains(target.rect, point));
    if (!hit) {
      return;
    }
    if (hit.type === 'cell' && !contains(boardRect(), point)) {
      return;
    }
    if (hit.type === 'cell' && hit.index !== undefined) {
      this.controller.tapCell(hit.index);
    } else if (hit.type === 'continue') {
      this.controller.continueAfterWin();
    } else if (hit.type === 'retry') {
      this.controller.retryLevel();
    } else if (hit.type === 'hint') {
      this.controller.useHint();
    } else if (hit.type === 'tool' && hit.tool) {
      this.controller.selectTool(hit.tool);
    } else if (hit.type === 'levels') {
      this.controller.openLevelSelect();
    } else if (hit.type === 'level' && hit.levelNo !== undefined) {
      this.controller.startLevel(hit.levelNo);
    }
  }

  private boardLocalPoint(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: point.x - BOARD_BOX.x,
      y: point.y - BOARD_BOX.y,
    };
  }

  private eventToDesignPoint(event: PointerEvent | TouchEvent | MouseEvent | WheelEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    const touch = 'touches' in event ? event.touches[0] ?? event.changedTouches[0] : null;
    const clientX = touch?.clientX ?? ('clientX' in event ? event.clientX : 0);
    const clientY = touch?.clientY ?? ('clientY' in event ? event.clientY : 0);
    return {
      x: (clientX - rect.left) / this.scale - this.offsetX,
      y: (clientY - rect.top) / this.scale - this.offsetY,
    };
  }

  private touchCenter(event: TouchEvent): { x: number; y: number } {
    const first = event.touches[0];
    const second = event.touches[1];
    const rect = this.canvas.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    return {
      x: ((first.clientX + second.clientX) / 2 - rect.left) / this.scale - this.offsetX,
      y: ((first.clientY + second.clientY) / 2 - rect.top) / this.scale - this.offsetY,
    };
  }

  private touchDistance(event: TouchEvent): number {
    const first = event.touches[0];
    const second = event.touches[1];
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string): void {
    const r = Math.min(radius, width / 2, height / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + width - r, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    this.ctx.lineTo(x + width, y + height - r);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    this.ctx.lineTo(x + r, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
    this.ctx.fillStyle = fill;
    this.ctx.fill();
    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  }

  private pill(x: number, y: number, width: number, height: number, label: string, fill: string): void {
    this.roundRect(x, y, width, height, height / 2, fill, 'rgba(16, 32, 51, 0.12)');
    this.text(label, x + width / 2, y + 31, 20, 800, theme.ink, 'center');
  }

  private text(text: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `${weight} ${size}px Avenir Next, Trebuchet MS, sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);
  }
}

function contains(rect: Rect, point: { x: number; y: number }): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x <= rect.x + rect.width && point.y <= rect.y + rect.height;
}

function boardRect(): Rect {
  return {
    x: BOARD_BOX.x,
    y: BOARD_BOX.y,
    width: BOARD_BOX.size,
    height: BOARD_BOX.size,
  };
}
