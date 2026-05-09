import { rewardForLevel } from './rewards';
import { loadSave, markLevelComplete, spendTool, writeSave, type TapGallerySave } from './save';
import type { LevelConfig } from '../assets/types';
import { activeCellCount, canClearCell, clearCell, createBoard, findHintCell, isBoardComplete } from '../core/board';
import { applyBomb, applyHammer, applyMagnet } from '../core/tools';
import type { BoardState, Direction } from '../core/types';
import type { PlatformAdapter } from '../platform/types';

export type GameScreen = 'loading' | 'playing' | 'win' | 'failed' | 'levels' | 'error';
export type FeedbackEventType = 'clear' | 'invalid' | 'win' | 'failed' | 'tool' | 'none';

export interface FeedbackEvent {
  type: FeedbackEventType;
  indexes?: number[];
  message?: string;
  sound?: string;
}

export interface GameViewState {
  screen: GameScreen;
  level: LevelConfig;
  levels: LevelConfig[];
  board: BoardState;
  save: TapGallerySave;
  movesLeft: number;
  progress: number;
  feedback: FeedbackEvent;
  selectedTool: ToolName | null;
}

export type ToolName = 'hint' | 'bomb' | 'magnet' | 'hammer' | 'freeze';

export interface GameControllerOptions {
  levels: LevelConfig[];
  save?: TapGallerySave;
  platform: PlatformAdapter;
}

export class GameController {
  private readonly levels: LevelConfig[];
  private readonly platform: PlatformAdapter;
  private save: TapGallerySave;
  private board: BoardState;
  private screen: GameScreen = 'playing';
  private movesLeft: number;
  private feedback: FeedbackEvent = { type: 'none' };
  private selectedTool: ToolName | null = null;
  private freezeCharges = 0;

  constructor(options: GameControllerOptions) {
    this.levels = [...options.levels].sort((a, b) => a.levelNo - b.levelNo);
    if (this.levels.length === 0) {
      throw new Error('GameController requires at least one level.');
    }
    this.platform = options.platform;
    this.save = options.save ?? loadSave(options.platform.storage);
    const level = this.findLevel(this.save.currentLevel) ?? this.levels[0];
    this.board = createBoard(level);
    this.movesLeft = level.moves;
  }

  getViewState(): GameViewState {
    return {
      screen: this.screen,
      level: this.board.level,
      levels: this.levels,
      board: this.board,
      save: this.save,
      movesLeft: this.movesLeft,
      progress: this.progress(),
      feedback: this.feedback,
      selectedTool: this.selectedTool,
    };
  }

  tapCell(index: number): FeedbackEvent {
    if (this.screen !== 'playing') {
      return this.setFeedback({ type: 'invalid', message: 'Level is not active.', sound: 'invalid' });
    }

    if (this.selectedTool) {
      return this.applySelectedTool(index);
    }

    if (!canClearCell(this.board, index)) {
      if (this.freezeCharges <= 0) {
        this.movesLeft -= 1;
      } else {
        this.freezeCharges -= 1;
      }
      if (this.movesLeft <= 0) {
        this.screen = 'failed';
        return this.setFeedback({ type: 'failed', message: 'No moves left.', sound: 'invalid' });
      }
      this.platform.triggerHaptic('short');
      return this.setFeedback({ type: 'invalid', indexes: [index], sound: 'invalid' });
    }

    this.board = clearCell(this.board, index);
    this.movesLeft -= 1;
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
    const hint = findHintCell(this.board);
    if (!hint) {
      return this.setFeedback({ type: 'invalid', message: 'No move available.', sound: 'invalid' });
    }
    this.save = spendTool(this.save, 'hint');
    this.persist();
    return this.setFeedback({ type: 'tool', indexes: [hint.index], sound: 'hint' });
  }

  retryLevel(): void {
    this.startLevel(this.board.level.levelNo);
  }

  continueAfterWin(): void {
    this.startLevel(Math.min(this.board.level.levelNo + 1, this.levels[this.levels.length - 1].levelNo));
  }

  startLevel(levelNo: number): void {
    const level = this.findLevel(levelNo) ?? this.levels[0];
    this.board = createBoard(level);
    this.movesLeft = level.moves;
    this.screen = 'playing';
    this.feedback = { type: 'none' };
    this.selectedTool = null;
    this.freezeCharges = 0;
    this.save = {
      ...this.save,
      currentLevel: level.levelNo,
    };
    this.persist();
  }

  async requestExtraMoves(): Promise<FeedbackEvent> {
    const result = await this.platform.showRewardedAd('extra_moves');
    if (result.status !== 'success') {
      return this.setFeedback({ type: 'invalid', message: result.message ?? 'Extra moves unavailable.', sound: 'invalid' });
    }
    this.movesLeft += 8;
    this.screen = 'playing';
    return this.setFeedback({ type: 'tool', message: '+8 moves', sound: 'ad-reward' });
  }

  private applySelectedTool(index: number): FeedbackEvent {
    const tool = this.selectedTool;
    this.selectedTool = null;
    if (!tool) {
      return this.setFeedback({ type: 'none' });
    }

    if (tool === 'freeze') {
      this.save = spendTool(this.save, 'freeze');
      this.freezeCharges = 3;
      this.persist();
      return this.setFeedback({ type: 'tool', sound: 'freeze' });
    }

    let result = { board: this.board, removed: [] as number[] };
    if (tool === 'bomb') {
      result = applyBomb(this.board, index);
    } else if (tool === 'hammer') {
      result = applyHammer(this.board, index);
    } else if (tool === 'magnet') {
      const direction = this.board.cellsByIndex.get(index)?.direction ?? 0;
      result = applyMagnet(this.board, direction as Direction);
    } else if (tool === 'hint') {
      return this.useHint();
    }

    if (result.removed.length === 0) {
      return this.setFeedback({ type: 'invalid', indexes: [index], sound: 'invalid' });
    }
    this.save = spendTool(this.save, tool);
    this.board = result.board;
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
    this.platform.triggerHaptic('long');
    return this.setFeedback({ type: 'win', indexes, sound: 'win' });
  }

  private progress(): number {
    return 1 - activeCellCount(this.board) / Math.max(1, this.board.cells.length);
  }

  private findLevel(levelNo: number): LevelConfig | null {
    return this.levels.find((level) => level.levelNo === levelNo) ?? null;
  }

  private setFeedback(feedback: FeedbackEvent): FeedbackEvent {
    this.feedback = feedback;
    return feedback;
  }

  private persist(): void {
    writeSave(this.platform.storage, this.save);
  }
}
