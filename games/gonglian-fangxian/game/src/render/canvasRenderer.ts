import type { AppAction, GameController, AppViewState } from '../app/controller';
import type { Board, BoardCell, SessionEvent } from '../core/types';
import { impactForClearStep, impactForWinFinale, type ImpactDescriptor, type ImpactEvent } from '../feedback/impact';
import { clamp01, easeOutCubic } from './animation';
import { drawBriefingScreen } from './briefingScreen';
import { EffectsModel, type FloatingText, type Particle } from './effects';
import { BOARD_CELL_SIZE, BOARD_COLS, BOARD_GAP, BOARD_ROWS, BOARD_START_X, BOARD_START_Y, cellAt, drawGameScreen } from './gameScreen';
import { drawLevelsScreen } from './levelsScreen';
import { drawMenuScreen, drawSuppliesScreen } from './menuScreen';
import { drawLoadingScreen } from './loadingScreen';
import { drawLostResult, drawPausedResult, drawWinResult } from './resultScreen';
import { coverRect, fitLogicalCanvas, LOGICAL_HEIGHT, LOGICAL_WIDTH, toLogicalPoint, type CanvasFit } from './scaler';
import { pieceColors } from './theme';
import { nowMs } from './time';
import { actionKey, drawAdButton, drawButton, drawPanel, drawText, roundRect, type HitArea, type PressedButton, type UiRenderContext } from './uiPrimitives';
import { VisualBoardModel } from './visualBoard';

interface BoardPresentation {
  key: string;
  steps: PresentationStep[];
  index: number;
  stepStartedMs: number;
}

interface PresentationStep {
  type: SessionEvent['type'];
  eventIndex: number;
  board: Board;
  durationMs: number;
}

interface ScreenShake {
  startedMs: number;
  amplitude: number;
  durationMs: number;
  seed: number;
}

type ResultRevealPhase = 'waiting' | 'finale';

interface ResultReveal {
  key: string;
  phase: ResultRevealPhase;
  startedMs: number;
}

interface DragState {
  row: number;
  col: number;
  startX: number;
  startY: number;
  pointerId: number | null;
  consumed: boolean;
}

const VICTORY_FINALE_MS = 700;
// 滑动触发阈值：超过单元格 40% 即视为方向手势（约 25px）
const DRAG_THRESHOLD_PX = BOARD_CELL_SIZE * 0.4;

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
  private impactCues: ImpactEvent[] = [];
  private impactCueId = 20_000;
  private handledImpactKey: string | null = null;
  private screenShake: ScreenShake | null = null;
  private shakeSeed = 0;
  private resultReveal: ResultReveal | null = null;
  private dragState: DragState | null = null;
  private readonly startedAtMs = nowMs();
  private readonly enableBootLoading = !(
    typeof process !== 'undefined' &&
    process?.env &&
    (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test')
  );

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
        void this.handlePointerDown(event);
      });
      this.canvas.addEventListener('pointermove', (event) => {
        void this.handlePointerMove(event);
      });
      this.canvas.addEventListener('pointerup', (event) => {
        this.handlePointerUp(event);
      });
      this.canvas.addEventListener('pointercancel', (event) => {
        this.handlePointerUp(event);
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
    const currentTimeMs = nowMs();
    const view = this.controller.getViewState();
    const isLoading = this.enableBootLoading && currentTimeMs - this.startedAtMs < 1500;
    this.trackViewTiming(view, currentTimeMs);
    this.hitAreas = [];

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawViewportBackground(view, currentTimeMs);

    this.ctx.save();
    this.ctx.translate(this.fit.offsetX, this.fit.offsetY);
    this.ctx.scale(this.fit.scale, this.fit.scale);
    const shake = this.screenShakeOffset(currentTimeMs);
    this.ctx.translate(shake.x, shake.y);
    this.drawBackground(view, currentTimeMs);

    if (view.screen !== 'won' && view.screen !== 'lost') {
      this.resultReveal = null;
      this.visualBoard.clearFinaleBlocks();
    }

    if (isLoading) {
      drawLoadingScreen(this.ui(), currentTimeMs - this.startedAtMs);
    } else if (view.screen === 'menu') {
      drawMenuScreen(this.ui(), view);
    } else if (view.screen === 'levels') {
      drawLevelsScreen(this.ui(), view);
    } else if (view.screen === 'briefing') {
      drawBriefingScreen(this.ui(), view);
    } else if (view.screen === 'supplies') {
      drawSuppliesScreen(this.ui(), view);
    } else if (view.screen === 'settings') {
      this.drawSettings(view, view.session?.status === 'playing');
    } else if (view.screen === 'playing' || view.screen === 'paused' || view.screen === 'won' || view.screen === 'lost') {
      drawGameScreen({
        ui: view.screen === 'playing' ? this.ui() : this.nonInteractiveUi(),
        nowMs: currentTimeMs,
        visualBoard: this.visualBoard,
        effects: this.effects,
        presentedBoard: (session, time) => this.presentedBoard(session, time),
        handleVisualCue: (state, time) => this.handleVisualCue(state, time),
        drawEffects: (time) => this.drawEffects(time),
      }, view);
      if (view.screen === 'paused') {
        drawPausedResult(this.ui());
      }
      if (view.screen === 'won' && this.resultOverlayReady(view, currentTimeMs)) {
        drawWinResult(this.ui(), view);
      }
      if (view.screen === 'lost' && this.resultOverlayReady(view, currentTimeMs)) {
        drawLostResult(this.ui(), view);
      }
    }

    if (view.feedback) {
      this.drawToast(view.feedback, currentTimeMs);
    }

    this.ctx.restore();
  }

  consumeImpactCue(): ImpactEvent | null {
    return this.impactCues.shift() ?? null;
  }

  consumeAudioCue(): { type: ImpactEvent['sound']; id: number } | null {
    const cue = this.consumeImpactCue();
    if (!cue) {
      return null;
    }

    return { type: cue.sound, id: cue.id };
  }

  applyImpact(impact: ImpactEvent, currentTimeMs = nowMs()): void {
    if (impact.shake.amplitude <= 0 || impact.shake.durationMs <= 0) {
      return;
    }

    this.screenShake = {
      startedMs: currentTimeMs,
      amplitude: impact.shake.amplitude,
      durationMs: impact.shake.durationMs,
      seed: ++this.shakeSeed,
    };
  }

  private trackViewTiming(view: AppViewState, nowMs: number): void {
    if (this.lastFeedback !== view.feedback) {
      this.lastFeedback = view.feedback;
      this.feedbackSinceMs = nowMs;
    }
  }

  private async handlePointerDown(event: PointerEvent | MiniGamePointerEvent): Promise<void> {
    const point = this.eventToLogicalPoint(event);
    if (!point) {
      return;
    }

    const area = [...this.hitAreas].reverse().find((candidate) => point.x >= candidate.x && point.x <= candidate.x + candidate.width && point.y >= candidate.y && point.y <= candidate.y + candidate.height);
    if (area) {
      this.dragState = null;
      if (this.shouldLockAction(area.action)) {
        return;
      }
      this.pressedButton = { key: actionKey(area.action), untilMs: nowMs() + 240 };
      await this.controller.dispatch(area.action);
      return;
    }

    if (this.controller.getViewState().screen !== 'playing') {
      this.dragState = null;
      return;
    }

    const cell = cellAt(point.x, point.y);
    if (!cell) {
      this.dragState = null;
      return;
    }

    const currentTimeMs = nowMs();
    if (this.visualBoard.isBusy(currentTimeMs) || this.presentation) {
      this.dragState = null;
      return;
    }

    await this.controller.dispatch({ type: 'tapCell', position: cell });
    this.dragState = {
      row: cell.row,
      col: cell.col,
      startX: point.x,
      startY: point.y,
      pointerId: pointerIdOf(event),
      consumed: false,
    };
  }

  private async handlePointerMove(event: PointerEvent | MiniGamePointerEvent): Promise<void> {
    const drag = this.dragState;
    if (!drag || drag.consumed) {
      return;
    }
    if (drag.pointerId !== null && pointerIdOf(event) !== drag.pointerId) {
      return;
    }

    const point = this.eventToLogicalPoint(event);
    if (!point) {
      return;
    }

    const dx = point.x - drag.startX;
    const dy = point.y - drag.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < DRAG_THRESHOLD_PX) {
      return;
    }

    const target: { row: number; col: number } = absDx >= absDy
      ? { row: drag.row, col: drag.col + (dx > 0 ? 1 : -1) }
      : { row: drag.row + (dy > 0 ? 1 : -1), col: drag.col };

    drag.consumed = true;
    if (target.row < 0 || target.col < 0 || target.row >= BOARD_ROWS || target.col >= BOARD_COLS) {
      return;
    }

    const view = this.controller.getViewState();
    const selected = view.session?.selectedCell;
    if (!selected || selected.row !== drag.row || selected.col !== drag.col) {
      return;
    }

    const currentTimeMs = nowMs();
    if (this.visualBoard.isBusy(currentTimeMs) || this.presentation) {
      return;
    }

    await this.controller.dispatch({ type: 'tapCell', position: target });
  }

  private handlePointerUp(event: PointerEvent | MiniGamePointerEvent): void {
    const drag = this.dragState;
    if (!drag) {
      return;
    }
    if (drag.pointerId !== null && pointerIdOf(event) !== drag.pointerId) {
      return;
    }
    this.dragState = null;
  }

  private shouldLockAction(action: AppAction): boolean {
    if (action.type !== 'usePowerUp') {
      return false;
    }
    if (this.controller.getViewState().screen !== 'playing') {
      return false;
    }
    return this.visualBoard.isBusy(nowMs()) || this.presentation !== null;
  }

  private eventToLogicalPoint(event: PointerEvent | MiniGamePointerEvent): { x: number; y: number } | null {
    const clientPoint = readClientPoint(event);
    if (!clientPoint) {
      return null;
    }
    const bounds = typeof this.canvas.getBoundingClientRect === 'function'
      ? this.canvas.getBoundingClientRect()
      : { left: 0, top: 0 };
    return toLogicalPoint(clientPoint.clientX - bounds.left, clientPoint.clientY - bounds.top, this.fit);
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

  private drawSettings(view: AppViewState, inGame: boolean): void {
    this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
    this.ctx.fillRect(0, 0, 750, 1334);
    drawPanel(this.ctx, 80, 220, 590, 860);
    drawText(this.ctx, '设置', 375, 282, 52, '#ffffff', 'center');
    drawText(this.ctx, `用户编号 ${view.userId}`, 375, 340, 24, '#d1fae5', 'center');
    drawButton(this.ui(), 596, 238, 50, 50, '关', { type: 'closeModal' });
    drawButton(this.ui(), 150, 390, 450, 72, `音乐：${view.save.musicEnabled ? '开' : '关'}`, { type: 'toggleMusic' });
    drawButton(this.ui(), 150, 482, 450, 72, `音效：${view.save.soundEnabled ? '开' : '关'}`, { type: 'toggleSound' });
    drawButton(this.ui(), 150, 574, 450, 72, '返回主页', { type: 'home' });
    drawAdButton(this.ui(), 150, 666, 450, 72, '赞助支持', { type: 'requestRewardedAd', request: { type: 'sponsor' } });
    if (inGame) {
      drawButton(this.ui(), 150, 758, 450, 72, '重新开始', { type: 'retry' });
      drawAdButton(this.ui(), 150, 850, 450, 72, '跳过本关', { type: 'requestRewardedAd', request: { type: 'skipLevel' } });
    }
  }

  private resultOverlayReady(view: AppViewState, nowMs: number): boolean {
    if (view.screen !== 'won' && view.screen !== 'lost') {
      return true;
    }

    if (!view.session) {
      return true;
    }

    const key = `${view.screen}:${view.session.levelId}:${view.winSummary?.doubled ? 'doubled' : 'base'}`;
    if (this.resultReveal?.key !== key) {
      this.resultReveal = { key, phase: 'waiting', startedMs: nowMs };
    }

    if (this.resultReveal.phase === 'finale') {
      return nowMs - this.resultReveal.startedMs >= VICTORY_FINALE_MS && !this.visualBoard.isBusy(nowMs);
    }

    if (this.presentation || this.visualBoard.isBusy(nowMs)) {
      return false;
    }

    if (view.screen === 'lost') {
      return true;
    }

    this.startVictoryFinale(nowMs);
    this.resultReveal = { key, phase: 'finale', startedMs: nowMs };
    return false;
  }

  private startVictoryFinale(nowMs: number): void {
    const blasted = this.visualBoard.blastAll(nowMs);
    for (const tile of blasted) {
      this.effects.burst(tile.x + BOARD_CELL_SIZE / 2, tile.y + BOARD_CELL_SIZE / 2, colorForPresentationCell(tile.cell), nowMs, 10);
    }
    this.effects.floatText('防线推进', 375, 640, '#ffd166', nowMs);
    this.queueImpact(`win-finale:${Math.round(nowMs)}`, impactForWinFinale());
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
      this.emitPresentationStepImpact(key, 0, steps, session.lastEvents);
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
      this.emitPresentationStepImpact(presentation.key, presentation.index, presentation.steps, session.lastEvents);
    }

    const currentStep = presentation.steps[presentation.index];
    if (presentation.index === presentation.steps.length - 1 && nowMs - presentation.stepStartedMs >= currentStep.durationMs) {
      this.handledPresentationKey = key;
      this.presentation = null;
      return session.board;
    }

    return currentStep.board;
  }

  private emitPresentationStepImpact(key: string, index: number, steps: PresentationStep[], events: SessionEvent[]): void {
    const step = steps[index];
    if (!step || step.type !== 'clear') {
      return;
    }

    const impact = impactForClearStep(events, step.eventIndex);
    if (!impact) {
      return;
    }

    this.queueImpact(`${key}:${index}`, impact);
  }

  private queueImpact(key: string, descriptor: ImpactDescriptor): void {
    if (this.handledImpactKey === key) {
      return;
    }

    this.handledImpactKey = key;
    this.impactCues.push({
      ...descriptor,
      id: ++this.impactCueId,
    });
  }

  private screenShakeOffset(nowMs: number): { x: number; y: number } {
    const shake = this.screenShake;
    if (!shake) {
      return { x: 0, y: 0 };
    }

    const progress = clamp01((nowMs - shake.startedMs) / shake.durationMs);
    if (progress >= 1) {
      this.screenShake = null;
      return { x: 0, y: 0 };
    }

    const envelope = 1 - easeOutCubic(progress);
    const wave = progress * 28 + shake.seed * 2.399963;
    const amplitude = shake.amplitude * envelope;
    return {
      x: Math.sin(wave) * amplitude,
      y: Math.cos(wave * 1.37) * amplitude,
    };
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
  pointerId?: number;
  touches?: MiniGameTouchPoint[];
  changedTouches?: MiniGameTouchPoint[];
}

interface MiniGameTouchPoint {
  clientX?: number;
  clientY?: number;
  x?: number;
  y?: number;
  identifier?: number;
}

function pointerIdOf(event: PointerEvent | MiniGamePointerEvent): number | null {
  if (typeof event.pointerId === 'number') {
    return event.pointerId;
  }
  const miniGameEvent = event as MiniGamePointerEvent;
  const touch = miniGameEvent.touches?.[0] ?? miniGameEvent.changedTouches?.[0];
  if (touch && typeof touch.identifier === 'number') {
    return touch.identifier;
  }
  return null;
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

function presentationSteps(events: SessionEvent[], finalBoard: Board): PresentationStep[] {
  const steps = events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter((entry): entry is { event: SessionEvent & { board: Board }; eventIndex: number } => Boolean(entry.event.board))
    .map(({ event, eventIndex }) => ({
      type: event.type,
      eventIndex,
      board: event.board,
      durationMs: event.phaseDurationMs ?? defaultPhaseDuration(event.type),
    }));

  if (steps.length > 0 && boardSignature(steps[steps.length - 1].board) !== boardSignature(finalBoard)) {
    steps.push({ type: 'refill', eventIndex: -1, board: finalBoard, durationMs: 280 });
  }

  return steps;
}

function defaultPhaseDuration(type: SessionEvent['type']): number {
  if (type === 'swap') return 360;
  if (type === 'clear') return 460;
  if (type === 'fall') return 420;
  if (type === 'refill') return 480;
  return 280;
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

function colorForPresentationCell(cell: BoardCell): string {
  if (cell.kind === 'normal' || cell.kind === 'special') {
    return pieceColors[cell.pieceKind];
  }

  if (cell.kind === 'blocker') {
    return cell.blockerKind === 'sandbag' ? '#9b6a3a' : '#6b7280';
  }

  return '#ffffff';
}
