import { rewardForLevel } from './rewards';
import {
  canSpendTool,
  consumeEnergy,
  loadSave,
  markLevelComplete,
  recoverEnergy,
  spendTool,
  writeSave,
  type TapGallerySave,
} from './save';
import type { LevelConfig } from '../assets/types';
import { activeCellCount, canClearCell, clearCell, createBoard, findHintCell, isBoardComplete, revealCellDirection } from '../core/board';
import { applyBomb, applyHammer, applyMagnet } from '../core/tools';
import type { BoardState } from '../core/types';
import { zhText } from '../i18n/zh';
import type { PlatformAdapter } from '../platform/types';
import { createBoardCamera, panCamera, resetCamera, zoomCamera, type BoardCameraState } from '../render/camera';

export type GameScreen = 'loading' | 'playing' | 'win' | 'failed' | 'levels' | 'error';
export type FeedbackEventType = 'clear' | 'invalid' | 'win' | 'failed' | 'tool' | 'none';
export type FeedbackAnimationKind = 'fly' | 'shake' | 'pulse' | 'reveal';

export interface FeedbackEvent {
  type: FeedbackEventType;
  indexes?: number[];
  message?: string;
  sound?: string;
  animation?: {
    kind: FeedbackAnimationKind;
    startedAtMs: number;
    durationMs: number;
  };
}

export interface GameViewState {
  screen: GameScreen;
  level: LevelConfig;
  levels: LevelConfig[];
  board: BoardState;
  camera: BoardCameraState;
  save: TapGallerySave;
  movesLeft: number;
  progress: number;
  feedback: FeedbackEvent;
  selectedTool: ToolName | null;
  timer: {
    freezeRemainingMs: number;
    remainingMs: number | null;
  };
  guidance: {
    type: 'firstTap';
    index: number;
    label: string;
  } | null;
  weakHint: {
    active: boolean;
    index: number | null;
  };
  reveal: {
    canContinue: boolean;
    elapsedMs: number;
  };
  levelSelect: Array<{
    levelNo: number;
    title: string;
    thumbnail: string;
    unlocked: boolean;
    completed: boolean;
  }>;
}

export type ToolName = 'hint' | 'bomb' | 'magnet' | 'hammer' | 'freeze';

export interface GameControllerOptions {
  levels: LevelConfig[];
  save?: TapGallerySave;
  platform: PlatformAdapter;
  now?: () => number;
}

export class GameController {
  private readonly levels: LevelConfig[];
  private readonly platform: PlatformAdapter;
  private save: TapGallerySave;
  private board: BoardState;
  private camera: BoardCameraState;
  private screen: GameScreen = 'playing';
  private movesLeft: number;
  private feedback: FeedbackEvent = { type: 'none' };
  private selectedTool: ToolName | null = null;
  private readonly now: () => number;
  private freezeUntilMs = 0;
  private lastActionMs: number;
  private lastWeakHintMs = -Infinity;
  private weakHintIndex: number | null = null;
  private guidanceDismissed = false;
  private revealStartedMs: number | null = null;
  private extraMoveAdUsed = false;
  private levelStartedAtMs: number;
  private frozenTimerMs = 0;
  private activeFreezeStartedAtMs: number | null = null;

  constructor(options: GameControllerOptions) {
    this.levels = [...options.levels].sort((a, b) => a.levelNo - b.levelNo);
    if (this.levels.length === 0) {
      throw new Error('GameController requires at least one level.');
    }
    this.platform = options.platform;
    this.now = options.now ?? (() => Date.now());
    this.save = recoverEnergy(options.save ?? loadSave(options.platform.storage), this.now());
    const level = this.findLevel(this.save.currentLevel) ?? this.levels[0];
    this.board = createBoard(level);
    this.camera = this.createCameraForLevel(level);
    this.movesLeft = level.moves;
    this.lastActionMs = this.now();
    this.levelStartedAtMs = this.now();
  }

  getViewState(): GameViewState {
    return {
      screen: this.screen,
      level: this.board.level,
      levels: this.levels,
      board: this.board,
      camera: this.camera,
      save: this.save,
      movesLeft: this.movesLeft,
      progress: this.progress(),
      feedback: this.feedback,
      selectedTool: this.selectedTool,
      timer: {
        freezeRemainingMs: Math.max(0, this.freezeUntilMs - this.now()),
        remainingMs: this.timerRemainingMs(),
      },
      guidance: this.currentGuidance(),
      weakHint: {
        active: this.weakHintIndex !== null,
        index: this.weakHintIndex,
      },
      reveal: this.currentReveal(),
      levelSelect: this.levels.map((level) => ({
        levelNo: level.levelNo,
        title: level.title,
        thumbnail: level.thumbnail,
        unlocked: level.levelNo <= this.save.highestUnlockedLevel,
        completed: this.save.completedLevels.includes(level.levelNo),
      })),
    };
  }

  tick(): void {
    this.settleFreeze();
    if (this.screen === 'playing' && this.timerRemainingMs() === 0) {
      this.screen = 'failed';
      this.setFeedback({ type: 'failed', message: zhText.messages.timeExpired, sound: 'invalid' });
      return;
    }
    if (this.screen !== 'playing') {
      return;
    }
    const now = this.now();
    const delay = this.board.level.idleHintDelayMs;
    if (
      this.weakHintIndex === null &&
      this.board.level.guidance.weakHintEnabled &&
      now - this.lastActionMs >= delay &&
      now - this.lastWeakHintMs >= 7000
    ) {
      this.weakHintIndex = findHintCell(this.board)?.index ?? null;
      this.lastWeakHintMs = now;
    }
  }

  tapCell(index: number): FeedbackEvent {
    if (this.screen !== 'playing') {
      return this.setFeedback({ type: 'invalid', message: zhText.messages.inactiveLevel, sound: 'invalid' });
    }

    this.recordAction();
    if (this.selectedTool) {
      return this.applySelectedTool(index);
    }

    if (!canClearCell(this.board, index)) {
      this.movesLeft -= 1;
      if (this.movesLeft <= 0) {
        this.screen = 'failed';
        return this.setFeedback({ type: 'failed', message: zhText.messages.noMovesLeft, sound: 'invalid' });
      }
      this.platform.triggerHaptic('short');
      return this.setFeedback({ type: 'invalid', indexes: [index], sound: 'invalid' });
    }

    this.board = clearCell(this.board, index);
    this.movesLeft -= 1;
    this.applyCellClearBonus(index);
    if (isBoardComplete(this.board)) {
      return this.completeLevel([index]);
    }
    this.platform.triggerHaptic('short');
    return this.setFeedback({ type: 'clear', indexes: [index], sound: 'tap' });
  }

  selectTool(tool: ToolName | null): void {
    this.selectedTool = tool;
  }

  useHint(): FeedbackEvent {
    this.recordAction();
    const hint = findHintCell(this.board);
    if (!hint) {
      return this.setFeedback({ type: 'invalid', message: zhText.messages.noMoveAvailable, sound: 'invalid' });
    }
    this.save = spendTool(this.save, 'hint');
    if (hint.kind === 'secret' && !hint.revealed) {
      this.board = revealCellDirection(this.board, hint.index);
    }
    this.persist();
    return this.setFeedback({ type: 'tool', indexes: [hint.index], sound: 'hint' });
  }

  retryLevel(): FeedbackEvent {
    return this.startLevel(this.board.level.levelNo);
  }

  zoomBoardCamera(scale: number, origin: { x: number; y: number }): void {
    this.camera = zoomCamera(this.camera, scale, origin);
  }

  panBoardCamera(delta: { dx: number; dy: number }): void {
    this.camera = panCamera(this.camera, delta);
  }

  resetBoardCamera(): void {
    this.camera = resetCamera(this.camera);
  }

  continueAfterWin(): void {
    if (!this.currentReveal().canContinue) {
      return;
    }
    this.startLevel(Math.min(this.board.level.levelNo + 1, this.levels[this.levels.length - 1].levelNo));
  }

  openLevelSelect(): void {
    this.screen = 'levels';
  }

  startLevel(levelNo: number): FeedbackEvent {
    const level = this.findLevel(levelNo) ?? this.levels[0];
    if (level.levelNo > this.save.highestUnlockedLevel) {
      return this.setFeedback({ type: 'invalid', message: zhText.messages.levelLocked, sound: 'invalid' });
    }
    if (!level.mechanics.includes('infiniteEnergy') && level.levelNo !== this.save.currentLevel) {
      const nextSave = consumeEnergy(this.save);
      if (!nextSave) {
        return this.setFeedback({ type: 'invalid', message: zhText.messages.notEnoughEnergy, sound: 'invalid' });
      }
      this.save = nextSave;
    }
    this.board = createBoard(level);
    this.camera = this.createCameraForLevel(level);
    this.movesLeft = level.moves;
    this.screen = 'playing';
    this.feedback = { type: 'none' };
    this.selectedTool = null;
    this.freezeUntilMs = 0;
    this.activeFreezeStartedAtMs = null;
    this.frozenTimerMs = 0;
    this.levelStartedAtMs = this.now();
    this.guidanceDismissed = false;
    this.weakHintIndex = null;
    this.revealStartedMs = null;
    this.lastActionMs = this.now();
    this.extraMoveAdUsed = false;
    this.save = {
      ...this.save,
      currentLevel: level.levelNo,
    };
    this.persist();
    return this.setFeedback({ type: 'none' });
  }

  async requestExtraMoves(): Promise<FeedbackEvent> {
    if (this.extraMoveAdUsed) {
      return this.setFeedback({ type: 'invalid', message: zhText.messages.continueUsed, sound: 'invalid' });
    }
    const result = await this.platform.showRewardedAd('extra_moves');
    if (result.status !== 'success') {
      return this.setFeedback({ type: 'invalid', message: result.message ?? zhText.messages.extraMovesUnavailable, sound: 'invalid' });
    }
    this.extraMoveAdUsed = true;
    this.movesLeft += 8;
    this.screen = 'playing';
    return this.setFeedback({ type: 'tool', message: zhText.messages.extraMovesReward, sound: 'ad-reward' });
  }

  private applySelectedTool(index: number): FeedbackEvent {
    const tool = this.selectedTool;
    this.selectedTool = null;
    if (!tool) {
      return this.setFeedback({ type: 'none' });
    }
    if (!canSpendTool(this.save, tool)) {
      return this.setFeedback({ type: 'invalid', indexes: [index], message: zhText.messages.toolUnavailable, sound: 'invalid' });
    }

    if (tool === 'freeze') {
      this.save = spendTool(this.save, 'freeze');
      this.activeFreezeStartedAtMs = this.now();
      this.freezeUntilMs = this.now() + 5000;
      this.persist();
      return this.setFeedback({ type: 'tool', sound: 'freeze' });
    }

    let result = { board: this.board, removed: [] as number[] };
    if (tool === 'bomb') {
      result = applyBomb(this.board, index);
    } else if (tool === 'hammer') {
      result = applyHammer(this.board, index);
    } else if (tool === 'magnet') {
      result = applyMagnet(this.board, index);
    } else if (tool === 'hint') {
      return this.useHint();
    }

    if (result.removed.length === 0) {
      return this.setFeedback({ type: 'invalid', indexes: [index], sound: 'invalid' });
    }
    this.save = spendTool(this.save, tool);
    this.board = result.board;
    for (const removed of result.removed) {
      this.applyCellClearBonus(removed);
    }
    this.persist();
    if (isBoardComplete(this.board)) {
      return this.completeLevel(result.removed);
    }
    return this.setFeedback({ type: 'tool', indexes: result.removed, sound: tool });
  }

  private completeLevel(indexes: number[]): FeedbackEvent {
    const reward = rewardForLevel(this.board.level.levelNo);
    this.save = markLevelComplete(this.save, this.board.level.levelNo, reward);
    this.persist();
    this.screen = 'win';
    this.resetBoardCamera();
    this.guidanceDismissed = true;
    this.revealStartedMs = this.now();
    this.platform.triggerHaptic('long');
    return this.setFeedback({ type: 'win', indexes, sound: 'win' });
  }

  private progress(): number {
    return 1 - activeCellCount(this.board) / Math.max(1, this.board.cells.length);
  }

  private findLevel(levelNo: number): LevelConfig | null {
    return this.levels.find((level) => level.levelNo === levelNo) ?? null;
  }

  private createCameraForLevel(level: LevelConfig): BoardCameraState {
    return createBoardCamera({
      levelNo: level.levelNo,
      allowPan: level.board.allowPan,
      allowZoom: level.board.allowZoom,
      initialZoom: level.board.initialZoom,
    });
  }

  private setFeedback(feedback: FeedbackEvent): FeedbackEvent {
    const nextFeedback = {
      ...feedback,
      animation: feedback.animation ?? this.defaultAnimation(feedback.type),
    };
    this.feedback = nextFeedback;
    return nextFeedback;
  }

  private persist(): void {
    writeSave(this.platform.storage, this.save);
  }

  private applyCellClearBonus(index: number): void {
    const cell = this.board.cellsByIndex.get(index);
    if (!cell) {
      return;
    }
    if (cell.kind === 'golden') {
      this.movesLeft += 3;
      this.save = {
        ...this.save,
        coins: this.save.coins + 10,
      };
      this.persist();
    }
    if (cell.kind === 'timer') {
      this.levelStartedAtMs += 5000;
    }
  }

  private recordAction(): void {
    this.lastActionMs = this.now();
    this.weakHintIndex = null;
  }

  private currentGuidance(): GameViewState['guidance'] {
    const firstTapIndex = this.board.level.guidance.firstTapIndex;
    if (
      this.screen !== 'playing' ||
      this.guidanceDismissed ||
      this.board.level.guidance.introCue !== 'tap' ||
      firstTapIndex === undefined ||
      this.board.cellsByIndex.get(firstTapIndex)?.cleared
    ) {
      return null;
    }

    return {
      type: 'firstTap',
      index: firstTapIndex,
      label: zhText.guidance.tap,
    };
  }

  private currentReveal(): GameViewState['reveal'] {
    if (this.screen !== 'win' || this.revealStartedMs === null) {
      return {
        canContinue: false,
        elapsedMs: 0,
      };
    }
    const elapsedMs = Math.max(0, this.now() - this.revealStartedMs);
    return {
      canContinue: elapsedMs >= 800,
      elapsedMs,
    };
  }

  private timerRemainingMs(): number | null {
    if (!this.board.level.mechanics.includes('timer') && !this.board.cells.some((cell) => cell.kind === 'timer')) {
      return null;
    }
    const activeFreezeMs = this.activeFreezeStartedAtMs === null
      ? 0
      : Math.max(0, Math.min(this.now(), this.freezeUntilMs) - this.activeFreezeStartedAtMs);
    const elapsedMs = Math.max(0, this.now() - this.levelStartedAtMs - this.frozenTimerMs - activeFreezeMs);
    return Math.max(0, 30_000 - elapsedMs);
  }

  private settleFreeze(): void {
    if (this.activeFreezeStartedAtMs === null || this.now() < this.freezeUntilMs) {
      return;
    }
    this.frozenTimerMs += Math.max(0, this.freezeUntilMs - this.activeFreezeStartedAtMs);
    this.activeFreezeStartedAtMs = null;
  }

  private defaultAnimation(type: FeedbackEventType): FeedbackEvent['animation'] | undefined {
    const startedAtMs = this.now();
    if (type === 'clear') {
      return { kind: 'fly', startedAtMs, durationMs: 320 };
    }
    if (type === 'invalid' || type === 'failed') {
      return { kind: 'shake', startedAtMs, durationMs: 240 };
    }
    if (type === 'tool') {
      return { kind: 'pulse', startedAtMs, durationMs: 520 };
    }
    if (type === 'win') {
      return { kind: 'reveal', startedAtMs, durationMs: 900 };
    }
    return undefined;
  }
}
