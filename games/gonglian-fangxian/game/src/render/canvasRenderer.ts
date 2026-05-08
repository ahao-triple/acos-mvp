import type { GameController, AppViewState } from '../app/controller';
import type { Board, SessionEvent } from '../core/types';
import { drawBriefingScreen } from './briefingScreen';
import { EffectsModel, type FloatingText, type Particle } from './effects';
import { BOARD_CELL_SIZE, BOARD_GAP, BOARD_START_X, BOARD_START_Y, cellAt, drawGameScreen } from './gameScreen';
import { drawLevelsScreen } from './levelsScreen';
import { drawMenuScreen, drawSuppliesScreen } from './menuScreen';
import { drawLostResult, drawPausedResult, drawWinResult } from './resultScreen';
import { coverRect, fitLogicalCanvas, LOGICAL_HEIGHT, LOGICAL_WIDTH, toLogicalPoint, type CanvasFit } from './scaler';
import { actionKey, drawButton, drawPanel, drawText, roundRect, type HitArea, type PressedButton, type UiRenderContext } from './uiPrimitives';
import { VisualBoardModel } from './visualBoard';

interface BoardPresentation {
  key: string;
  steps: Array<{ board: Board; durationMs: number }>;
  index: number;
  stepStartedMs: number;
}

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private fit: CanvasFit = fitLogicalCanvas(LOGICAL_WIDTH, LOGICAL_HEIGHT);
  private hitAreas: HitArea[] = [];
  private readonly visualBoard = new VisualBoardModel({
    cellSize: BOARD_CELL_SIZE,
    gap: BOARD_GAP,
    startX: BOARD_START_X,
    startY: BOARD_START_Y,
  });
  private readonly effects = new EffectsModel(80, 2026);
  private handledCueId = 0;
  private pressedButton: PressedButton | null = null;
  private lastFeedback: string | null = null;
  private feedbackSinceMs = 0;
  private presentation: BoardPresentation | null = null;
  private handledPresentationKey: string | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly controller: GameController,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is unavailable');
    }
    this.ctx = ctx;
    if (typeof this.canvas.addEventListener === 'function') {
      this.canvas.addEventListener('pointerdown', (event) => {
        void this.handlePointer(event);
      });
    }
  }

  resize(width: number, height: number, dpr = window.devicePixelRatio || 1): void {
    this.fit = fitLogicalCanvas(width, height);
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    if (this.canvas.style) {
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(): void {
    const nowMs = performance.now();
    const view = this.controller.getViewState();
    this.trackViewTiming(view, nowMs);
    this.hitAreas = [];

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawViewportBackground(view, nowMs);

    this.ctx.save();
    this.ctx.translate(this.fit.offsetX, this.fit.offsetY);
    this.ctx.scale(this.fit.scale, this.fit.scale);
    this.drawBackground(view, nowMs);

    if (view.screen === 'menu') {
      drawMenuScreen(this.ui(), view);
    } else if (view.screen === 'levels') {
      drawLevelsScreen(this.ui(), view);
    } else if (view.screen === 'briefing') {
      drawBriefingScreen(this.ui(), view);
    } else if (view.screen === 'supplies') {
      drawSuppliesScreen(this.ui(), view);
    } else if (view.screen === 'settings') {
      this.drawSettings(view);
    } else if (view.screen === 'playing' || view.screen === 'paused' || view.screen === 'won' || view.screen === 'lost') {
      drawGameScreen({
        ui: view.screen === 'playing' ? this.ui() : this.nonInteractiveUi(),
        nowMs,
        visualBoard: this.visualBoard,
        effects: this.effects,
        presentedBoard: (session, time) => this.presentedBoard(session, time),
        handleVisualCue: (state, time) => this.handleVisualCue(state, time),
        drawEffects: (time) => this.drawEffects(time),
      }, view);
      if (view.screen === 'paused') {
        drawPausedResult(this.ui());
      }
      if (view.screen === 'won') {
        drawWinResult(this.ui(), view);
      }
      if (view.screen === 'lost') {
        drawLostResult(this.ui(), view);
      }
    }

    if (view.feedback) {
      this.drawToast(view.feedback, nowMs);
    }

    this.ctx.restore();
  }

  private trackViewTiming(view: AppViewState, nowMs: number): void {
    if (this.lastFeedback !== view.feedback) {
      this.lastFeedback = view.feedback;
      this.feedbackSinceMs = nowMs;
    }
  }

  private async handlePointer(event: PointerEvent | MiniGamePointerEvent): Promise<void> {
    const clientPoint = readClientPoint(event);
    if (!clientPoint) {
      return;
    }

    const bounds = typeof this.canvas.getBoundingClientRect === 'function'
      ? this.canvas.getBoundingClientRect()
      : { left: 0, top: 0 };
    const point = toLogicalPoint(clientPoint.clientX - bounds.left, clientPoint.clientY - bounds.top, this.fit);
    const area = [...this.hitAreas].reverse().find((candidate) => point.x >= candidate.x && point.x <= candidate.x + candidate.width && point.y >= candidate.y && point.y <= candidate.y + candidate.height);
    if (area) {
      this.pressedButton = { key: actionKey(area.action), untilMs: performance.now() + 240 };
      await this.controller.dispatch(area.action);
      return;
    }

    const cell = cellAt(point.x, point.y);
    if (cell) {
      const nowMs = performance.now();
      if (this.visualBoard.isBusy(nowMs) || this.presentation) {
        return;
      }
      await this.controller.dispatch({ type: 'tapCell', position: cell });
    }
  }

  private drawViewportBackground(view: AppViewState, nowMs: number): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.fit.viewportHeight);
    gradient.addColorStop(0, view.screen === 'menu' ? '#123526' : '#20384a');
    gradient.addColorStop(0.55, '#2d4d4e');
    gradient.addColorStop(1, '#16243a');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.fit.viewportWidth, this.fit.viewportHeight);

    this.ctx.fillStyle = 'rgba(255,255,255,0.022)';
    for (let x = 0; x < this.fit.viewportWidth; x += 64) {
      this.ctx.fillRect(x, 0, 1, this.fit.viewportHeight);
    }

    this.ctx.save();
    for (const particle of this.effects.backgroundParticles(this.fit.viewportWidth, this.fit.viewportHeight, nowMs, 24)) {
      this.ctx.globalAlpha = particle.alpha * 0.38;
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawBackground(view: AppViewState, nowMs: number): void {
    const rect = coverRect(900, 1600, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    const gradient = this.ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.height);
    gradient.addColorStop(0, view.screen === 'menu' ? '#123526' : '#20384a');
    gradient.addColorStop(0.55, '#2d4d4e');
    gradient.addColorStop(1, '#16243a');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    this.ctx.fillStyle = 'rgba(255,255,255,0.032)';
    for (let x = -100; x < LOGICAL_WIDTH + 120; x += 120) {
      this.ctx.fillRect(x, 0, 2, LOGICAL_HEIGHT);
    }
    for (let y = -80; y < LOGICAL_HEIGHT + 120; y += 120) {
      this.ctx.fillRect(0, y, LOGICAL_WIDTH, 2);
    }

    this.drawParticles(this.effects.backgroundParticles(LOGICAL_WIDTH, LOGICAL_HEIGHT, nowMs, 18));
  }

  private drawSettings(view: AppViewState): void {
    this.drawTitle('设置', '音频开关会保存到本地');
    drawPanel(this.ctx, 100, 300, 550, 500);
    drawButton(this.ui(), 160, 380, 430, 86, `音效：${view.save.soundEnabled ? '开' : '关'}`, { type: 'toggleSound' });
    drawButton(this.ui(), 160, 500, 430, 86, `音乐：${view.save.musicEnabled ? '开' : '关'}`, { type: 'toggleMusic' });
    drawButton(this.ui(), 160, 620, 430, 86, '返回', { type: 'closeModal' });
  }

  private presentedBoard(session: NonNullable<AppViewState['session']>, nowMs: number): Board {
    const steps = presentationSteps(session.lastEvents, session.board);
    if (steps.length === 0) {
      this.presentation = null;
      return session.board;
    }

    const key = presentationKey(session.lastEvents, session.board);
    if (this.presentation?.key !== key && this.handledPresentationKey !== key) {
      this.presentation = {
        key,
        steps,
        index: 0,
        stepStartedMs: nowMs,
      };
    }

    const presentation = this.presentation;
    if (!presentation || presentation.key !== key) {
      return session.board;
    }

    while (
      presentation.index < presentation.steps.length - 1 &&
      nowMs - presentation.stepStartedMs >= presentation.steps[presentation.index].durationMs
    ) {
      presentation.stepStartedMs += presentation.steps[presentation.index].durationMs;
      presentation.index += 1;
    }

    const currentStep = presentation.steps[presentation.index];
    if (presentation.index === presentation.steps.length - 1 && nowMs - presentation.stepStartedMs >= currentStep.durationMs) {
      this.handledPresentationKey = key;
      this.presentation = null;
      return session.board;
    }

    return currentStep.board;
  }

  private drawTitle(title: string, subtitle: string): void {
    drawText(this.ctx, title, 375, 126, 72, '#ffffff', 'center');
    drawText(this.ctx, subtitle, 375, 184, 28, '#d1fae5', 'center');
  }

  private ui(): UiRenderContext {
    return {
      ctx: this.ctx,
      hitAreas: this.hitAreas,
      pressedButton: this.pressedButton,
    };
  }

  private nonInteractiveUi(): UiRenderContext {
    return {
      ctx: this.ctx,
      hitAreas: [],
      pressedButton: this.pressedButton,
    };
  }

  private drawToast(message: string, nowMs: number): void {
    const progress = Math.min(1, (nowMs - this.feedbackSinceMs) / 180);
    const y = 1040 - (1 - progress) * 24;
    this.ctx.save();
    this.ctx.globalAlpha = progress;
    this.ctx.fillStyle = 'rgba(17,24,39,0.94)';
    roundRect(this.ctx, 70, y, 610, 76, 8);
    this.ctx.fill();
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    drawText(this.ctx, message, 375, y + 48, 24, '#ffffff', 'center');
    this.ctx.restore();
  }

  private handleVisualCue(view: AppViewState, nowMs: number): void {
    const cue = view.visualCue;
    if (!cue || cue.id === this.handledCueId) {
      return;
    }

    this.handledCueId = cue.id;
    if (cue.type === 'combo') {
      this.effects.floatText(cue.combo >= 5 ? `超级连击 x${cue.combo}` : `连击 x${cue.combo}`, 375, 275, '#ffd166', nowMs);
      return;
    }

    const from = this.visualBoard.cellCenter(cue.from.row, cue.from.col);
    const to = this.visualBoard.cellCenter(cue.to.row, cue.to.col);
    this.effects.floatText('未形成消除', (from.x + to.x) / 2 + 43, (from.y + to.y) / 2 + 43, '#ffd166', nowMs);
    this.effects.burst(from.x + 43, from.y + 43, '#ffd166', nowMs, 4);
    this.effects.burst(to.x + 43, to.y + 43, '#ffd166', nowMs, 4);
  }

  private drawEffects(nowMs: number): void {
    this.drawParticles(this.effects.particlesAt(nowMs));
    for (const text of this.effects.textsAt(nowMs)) {
      this.drawFloatingText(text);
    }
  }

  private drawParticles(particles: Particle[]): void {
    this.ctx.save();
    for (const particle of particles) {
      this.ctx.globalAlpha = particle.alpha;
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  private drawFloatingText(text: FloatingText): void {
    this.ctx.save();
    this.ctx.globalAlpha = text.alpha;
    this.ctx.translate(text.x, text.y);
    this.ctx.scale(text.scale, text.scale);
    drawText(this.ctx, text.text, 0, 0, 34, text.color, 'center');
    this.ctx.restore();
  }

}

interface MiniGamePointerEvent {
  clientX?: number;
  clientY?: number;
  touches?: MiniGameTouchPoint[];
  changedTouches?: MiniGameTouchPoint[];
}

interface MiniGameTouchPoint {
  clientX?: number;
  clientY?: number;
  x?: number;
  y?: number;
}

function readClientPoint(event: PointerEvent | MiniGamePointerEvent): { clientX: number; clientY: number } | null {
  if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    return { clientX: event.clientX, clientY: event.clientY };
  }

  const miniGameEvent = event as MiniGamePointerEvent;
  const touch = miniGameEvent.touches?.[0] ?? miniGameEvent.changedTouches?.[0];
  if (touch) {
    if (typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
      return { clientX: touch.clientX, clientY: touch.clientY };
    }
    if (typeof touch.x === 'number' && typeof touch.y === 'number') {
      return { clientX: touch.x, clientY: touch.y };
    }
  }

  return null;
}

function presentationSteps(events: SessionEvent[], finalBoard: Board): Array<{ board: Board; durationMs: number }> {
  const steps = events
    .filter((event): event is SessionEvent & { board: Board } => Boolean(event.board))
    .map((event) => ({
      board: event.board,
      durationMs: event.phaseDurationMs ?? defaultPhaseDuration(event.type),
    }));

  if (steps.length > 0 && boardSignature(steps[steps.length - 1].board) !== boardSignature(finalBoard)) {
    steps.push({ board: finalBoard, durationMs: 420 });
  }

  return steps;
}

function defaultPhaseDuration(type: SessionEvent['type']): number {
  if (type === 'swap') return 520;
  if (type === 'clear') return 680;
  if (type === 'fall') return 620;
  if (type === 'refill') return 720;
  return 420;
}

function presentationKey(events: SessionEvent[], finalBoard: Board): string {
  const eventPart = events
    .map((event) => `${event.type}:${event.kind ?? ''}:${event.count ?? ''}:${event.cells?.map((cell) => `${cell.row},${cell.col}`).join('|') ?? ''}`)
    .join(';');
  return `${eventPart}#${boardSignature(finalBoard)}`;
}

function boardSignature(board: Board): string {
  return board
    .map((row) =>
      row
        .map((cell) => {
          if (cell.kind === 'empty') return 'empty';
          if (cell.kind === 'blocker') return `${cell.blockerKind}:${cell.durability}`;
          if (cell.kind === 'special') return `${cell.id}:${cell.pieceKind}:${cell.specialKind}`;
          return `${cell.id}:${cell.pieceKind}`;
        })
        .join(','),
    )
    .join('/');
}
