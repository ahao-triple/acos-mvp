import { levels } from '../config/levels';
import { applyMove, applyPowerUp, createSession } from '../core/session';
import type { GameSession, LevelConfig, NodeReward, Position, PowerUpType } from '../core/types';
import type { PlatformAdapter } from '../platform/types';
import type { AudioCue, AudioCueType } from '../audio/soundEngine';
import { debugLog } from './debugLog';
import { createDefaultSave, loadSave, type SaveData, writeSave } from './save';
import { claimAdItemReward, claimDesktopReward, claimFavoriteReward, claimSidebarReward, requestExtraMoves, type InventoryItem } from './rewards';
import { chapterProgressForSave, levelById, type ChapterProgress } from './campaign';

export type Screen = 'loading' | 'menu' | 'levels' | 'playing' | 'paused' | 'won' | 'lost' | 'settings' | 'supplies';

export type RewardedAdRequest =
  | { type: 'extraMovesAd' }
  | { type: 'powerUpItem'; item: PowerUpType }
  | { type: 'skipLevel' }
  | { type: 'sponsor' };

export interface ControllerAdConfig {
  adPolicy: ControllerAdPolicy;
}

export interface ControllerAdPolicy {
  enabled: boolean;
  trigger: 'level_start';
  minLevel: number;
  cooldownSeconds: number;
  maxPerSession: number;
  request: RewardedAdRequest;
}

export type AppAction =
  | { type: 'loadingDone' }
  | { type: 'start' }
  | { type: 'openLevels' }
  | { type: 'openSettings' }
  | { type: 'openSupplies' }
  | { type: 'closeModal' }
  | { type: 'requestRewardedAd'; request: RewardedAdRequest }
  | { type: 'selectLevel'; levelId: number }
  | { type: 'tapCell'; position: Position }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'home' }
  | { type: 'retry' }
  | { type: 'nextLevel' }
  | { type: 'extraMovesAd' }
  | { type: 'claimAdItemReward'; item: InventoryItem }
  | { type: 'usePowerUp'; item: PowerUpType }
  | { type: 'desktopReward' }
  | { type: 'favoriteReward' }
  | { type: 'sidebarReward' }
  | { type: 'shareReward' }
  | { type: 'toggleSound' }
  | { type: 'toggleMusic' };

export interface WinSummary {
  levelId: number;
  chapterTitle: string;
  nodeReward: NodeReward | null;
  nextLevelId: number | null;
}

export interface AppViewState {
  screen: Screen;
  save: SaveData;
  session: GameSession | null;
  pendingLevel: LevelConfig | null;
  winSummary: WinSummary | null;
  chapterProgress: ChapterProgress[];
  feedback: string | null;
  visualCue: VisualCue | null;
  audioCue: AudioCue | null;
  highestLevel: number;
  levelCount: number;
  activePowerUp: PowerUpType | null;
  userId: string;
  platformName: string;
}

export type VisualCue =
  | { type: 'swapRejected'; from: Position; to: Position; id: number }
  | { type: 'combo'; combo: number; id: number };

export class GameController {
  private save: SaveData;
  private session: GameSession | null = null;
  // 冷启动展示 LoadingPage（规范 §三 P1）；LoadingScreen 进度条结束后 dispatch 'loadingDone' 切 menu
  private screen: Screen = 'loading';
  private feedback: string | null = null;
  private visualCue: VisualCue | null = null;
  private audioCue: AudioCue | null = null;
  private pendingLevelId: number | null = null;
  private winSummary: WinSummary | null = null;
  private activePowerUp: PowerUpType | null = null;
  private cueId = 0;
  private audioCueId = 0;
  private seed = 1000;
  private adConfig: ControllerAdConfig = {
    adPolicy: {
      enabled: false,
      trigger: 'level_start',
      minLevel: 1,
      cooldownSeconds: 0,
      maxPerSession: 0,
      request: { type: 'extraMovesAd' },
    },
  };
  private remoteAdCount = 0;
  private lastRemoteAdAtMs = 0;
  private readonly userId: string;

  constructor(private readonly platform: PlatformAdapter, options: { adConfig?: ControllerAdConfig } = {}) {
    this.save = loadSave(platform.storage);
    this.adConfig = options.adConfig ?? this.adConfig;
    this.userId = String(Math.abs(this.seed * 971 + 2077) % 10_000_000).padStart(7, '0');
  }

  getViewState(): AppViewState {
    return {
      screen: this.screen,
      save: this.save,
      session: this.session,
      pendingLevel: this.pendingLevelId ? levelById(this.pendingLevelId) : null,
      winSummary: this.winSummary,
      chapterProgress: chapterProgressForSave(this.save.highestUnlockedLevel, this.save.completedLevelCount),
      feedback: this.feedback,
      visualCue: this.visualCue,
      audioCue: this.audioCue,
      highestLevel: this.save.highestUnlockedLevel,
      levelCount: levels.length,
      activePowerUp: this.activePowerUp,
      userId: this.userId,
      platformName: this.platform.name,
    };
  }

  async dispatch(action: AppAction): Promise<void> {
    this.feedback = null;
    this.visualCue = null;
    this.audioCue = null;
    // loadingDone 是 LoadingScreen 进度条结束后的自动切屏，不发"按钮"音
    if (action.type !== 'tapCell' && action.type !== 'loadingDone') {
      this.emitAudio('button');
    }

    switch (action.type) {
      case 'loadingDone':
        if (this.screen === 'loading') this.screen = 'menu';
        break;
      case 'start':
        this.startLevelWithGuard(this.save.highestUnlockedLevel);
        break;
      case 'openLevels':
        this.screen = 'levels';
        break;
      case 'openSettings':
        this.screen = 'settings';
        break;
      case 'openSupplies':
        this.screen = 'supplies';
        break;
      case 'closeModal':
        this.screen = this.session?.status === 'playing' ? 'playing' : 'menu';
        break;
      case 'requestRewardedAd':
        await this.executeRewardedAd(action.request);
        break;
      case 'selectLevel':
        this.startLevelWithGuard(action.levelId);
        break;
      case 'tapCell':
        this.tapCell(action.position);
        break;
      case 'pause':
        this.screen = 'paused';
        break;
      case 'resume':
        this.screen = 'playing';
        break;
      case 'home':
        debugLog('navigation_home', {
          from: this.screen,
          levelId: this.session?.levelId ?? null,
        });
        this.session = null;
        this.activePowerUp = null;
        this.pendingLevelId = null;
        this.winSummary = null;
        this.screen = 'menu';
        break;
      case 'retry':
        this.startLevelWithGuard(this.session?.levelId ?? this.pendingLevelId ?? this.save.highestUnlockedLevel);
        break;
      case 'nextLevel':
        this.startLevelWithGuard(Math.min(levels.length, (this.session?.levelId ?? this.pendingLevelId ?? 1) + 1));
        break;
      case 'extraMovesAd':
        await this.requestExtraMoves();
        break;
      case 'claimAdItemReward':
        await this.claimAdItemReward(action.item);
        break;
      case 'usePowerUp':
        await this.usePowerUp(action.item);
        break;
      case 'desktopReward':
        await this.claimDesktopReward();
        break;
      case 'favoriteReward':
        await this.claimFavoriteReward();
        break;
      case 'sidebarReward':
        await this.claimSidebarReward();
        break;
      case 'shareReward':
        this.feedback = '分享功能由平台接管，请通过平台菜单分享。';
        break;
      case 'toggleSound':
        this.updateSave({ ...this.save, soundEnabled: !this.save.soundEnabled });
        break;
      case 'toggleMusic':
        this.updateSave({ ...this.save, musicEnabled: !this.save.musicEnabled });
        break;
    }
  }

  private startLevelWithGuard(levelId: number): void {
    if (levelId > this.save.highestUnlockedLevel) {
      this.pendingLevelId = null;
      this.feedback = '该关卡尚未解锁。';
      this.screen = 'levels';
      return;
    }
    this.startLevel(levelId);
  }

  private startLevel(levelId: number): void {
    const level = levelById(levelId);
    const prevChapterId = this.session ? levelById(this.session.levelId).chapterId : -1;
    this.seed += 1;
    this.pendingLevelId = level.id;
    this.activePowerUp = null;
    this.winSummary = null;
    this.session = createSession(level, this.seed);
    this.screen = 'playing';
    // 章节切换时提示一次章节标题。当前 toast 系统尚未接入（audit P0），先用 console.log 占位。
    // TODO(toast): 接入 PlatformAdapter.showToast 后改为 toast 提示
    if (level.chapterId !== prevChapterId) {
      console.log('[chapter-enter] %s', level.chapterTitle);
    }
    void this.maybeRunRemoteAd('level_start', level.id);
  }

  private async maybeRunRemoteAd(trigger: 'level_start', levelId: number): Promise<void> {
    const policy = this.adConfig.adPolicy;
    if (!policy.enabled || policy.trigger !== trigger) {
      return;
    }
    if (levelId < policy.minLevel) {
      return;
    }
    if (policy.maxPerSession > 0 && this.remoteAdCount >= policy.maxPerSession) {
      return;
    }
    const now = Date.now();
    if (policy.cooldownSeconds > 0 && now - this.lastRemoteAdAtMs < policy.cooldownSeconds * 1000) {
      return;
    }
    this.remoteAdCount += 1;
    this.lastRemoteAdAtMs = now;
    await this.executeRewardedAd(policy.request);
  }

  private async executeRewardedAd(request: RewardedAdRequest): Promise<void> {
    if (request.type === 'skipLevel') {
      await this.skipLevelReward();
      return;
    }

    if (request.type === 'sponsor') {
      await this.claimAdItemReward('extraMoves');
      return;
    }

    if (request.type === 'extraMovesAd') {
      await this.requestExtraMoves();
      return;
    }

    await this.claimPowerUpItemFromAd(request.item);
  }

  private tapCell(position: Position): void {
    if (!this.session || this.screen !== 'playing') {
      return;
    }

    if (this.activePowerUp) {
      this.applyActivePowerUp(position);
      return;
    }

    if (!this.session.selectedCell) {
      this.session = { ...this.session, selectedCell: position };
      this.emitAudio('select');
      return;
    }

    const previous = this.session.selectedCell;
    const previousMoves = this.session.movesLeft;
    try {
      const next = applyMove(this.session, previous, position, this.seed);
      this.seed += 1;
      this.session = next;

      if (next.lastEvents.length === 0 && next.movesLeft === previousMoves) {
        this.feedback = '未形成消除。';
        this.visualCue = { type: 'swapRejected', from: previous, to: position, id: ++this.cueId };
        this.emitAudio('invalid');
      }

      if (next.status === 'won') {
        this.handleWin(next);
        this.emitAudio('win');
      } else if (next.status === 'lost') {
        this.screen = 'lost';
        this.emitAudio('lose');
      }
      if (next.comboCount >= 2) {
        this.visualCue = { type: 'combo', combo: next.comboCount, id: ++this.cueId };
      }
    } catch (error) {
      this.session = { ...this.session, selectedCell: position };
      this.feedback = swapErrorFeedback(error);
      this.visualCue = { type: 'swapRejected', from: previous, to: position, id: ++this.cueId };
      this.emitAudio('invalid');
    }
  }

  private handleWin(session: GameSession): void {
    const level = levelById(session.levelId);
    const nextHighest = Math.min(levels.length, Math.max(this.save.highestUnlockedLevel, session.levelId + 1));
    const nextLevelId = session.levelId < levels.length ? session.levelId + 1 : null;
    const rewardSave = this.addNodeReward(
      {
        ...this.save,
        highestUnlockedLevel: nextHighest,
        completedLevelCount: Math.min(levels.length, Math.max(this.save.completedLevelCount, session.levelId)),
      },
      level.nodeReward,
    );

    this.updateSave(rewardSave);
    this.winSummary = {
      levelId: session.levelId,
      chapterTitle: level.chapterTitle,
      nodeReward: level.nodeReward ?? null,
      nextLevelId,
    };
    this.screen = 'won';
  }

  private addNodeReward(save: SaveData, reward: NodeReward | undefined): SaveData {
    if (!reward) {
      return save;
    }

    return {
      ...save,
      items: {
        ...save.items,
        bomb: save.items.bomb + (reward.bomb ?? 0),
        suck: save.items.suck + (reward.suck ?? 0),
        shuffle: save.items.shuffle + (reward.shuffle ?? 0),
      },
    };
  }

  private async requestExtraMoves(): Promise<void> {
    if (!this.session) {
      return;
    }

    const outcome = await requestExtraMoves(this.session, this.platform);
    this.session = outcome.session;
    this.feedback = outcome.feedback;
    this.emitAudio(outcome.granted ? 'reward' : 'invalid');
    if (outcome.granted) {
      this.screen = 'playing';
    }
  }

  private async claimAdItemReward(item: InventoryItem): Promise<void> {
    const outcome = await claimAdItemReward(this.save, item, this.platform);
    this.updateSave(outcome.save);
    this.feedback = outcome.feedback;
    this.emitAudio(outcome.granted ? 'reward' : 'invalid');
  }

  private async usePowerUp(item: PowerUpType): Promise<void> {
    if (!this.session || this.screen !== 'playing') {
      this.feedback = '进入关卡后才能使用道具。';
      this.emitAudio('invalid');
      debugLog('power_up_rejected', { item, screen: this.screen });
      return;
    }

    if (this.save.items[item] <= 0) {
      await this.claimPowerUpItemFromAd(item);
      return;
    }

    this.activateOwnedPowerUp(item, false);
  }

  private async claimPowerUpItemFromAd(item: PowerUpType): Promise<void> {
    if (!this.session || this.screen !== 'playing') {
      this.feedback = '进入关卡后才能使用道具。';
      this.emitAudio('invalid');
      return;
    }

    debugLog('power_up_ad_request', {
      item,
      available: this.save.items[item],
      levelId: this.session.levelId,
    });
    const outcome = await claimAdItemReward(this.save, item, this.platform);
    this.updateSave(outcome.save);
    debugLog('power_up_ad_outcome', {
      item,
      granted: outcome.granted,
      available: this.save.items[item],
      feedback: outcome.feedback,
    });
    if (!outcome.granted) {
      this.feedback = outcome.feedback;
      this.emitAudio('invalid');
      return;
    }

    this.activateOwnedPowerUp(item, true);
  }

  private activateOwnedPowerUp(item: PowerUpType, watchedAd: boolean): void {
    if (!this.session) {
      return;
    }

    if (item === 'shuffle') {
      this.session = applyPowerUp(this.session, item, { row: 0, col: 0 }, this.seed);
      this.seed += 1;
      this.updateSave({
        ...this.save,
        items: {
          ...this.save.items,
          shuffle: this.save.items.shuffle - 1,
        },
      });
      this.feedback = '已重排梗池。';
      this.emitAudio('reward');
      debugLog('power_up_apply', {
        item,
        fromAd: watchedAd,
        remaining: this.save.items.shuffle,
        levelId: this.session.levelId,
      });
      return;
    }

    this.activePowerUp = this.activePowerUp === item ? null : item;
    if (this.activePowerUp === item) {
      const prefix = watchedAd ? '广告已完成，' : '';
      this.feedback = item === 'bomb' ? `${prefix}选择一个格子炸开周围梗。` : `${prefix}选择一个格子吸走同类梗。`;
      debugLog('power_up_activate', {
        item,
        fromAd: watchedAd,
        available: this.save.items[item],
        levelId: this.session.levelId,
      });
    } else {
      this.feedback = null;
      debugLog('power_up_cancel', {
        item,
        available: this.save.items[item],
        levelId: this.session.levelId,
      });
    }
    if (this.activePowerUp === item) {
      this.emitAudio('reward');
    }
  }

  private applyActivePowerUp(position: Position): void {
    if (!this.session || !this.activePowerUp) {
      return;
    }

    const item = this.activePowerUp;
    this.session = applyPowerUp(this.session, item, position, this.seed);
    this.seed += 1;
    this.activePowerUp = null;
    this.updateSave({
      ...this.save,
      items: {
        ...this.save.items,
        [item]: this.save.items[item] - 1,
      },
    });
    this.feedback = item === 'bomb' ? '已使用炸开道具。' : '已使用吸走道具。';
    this.emitAudio('reward');
    debugLog('power_up_apply', {
      item,
      row: position.row,
      col: position.col,
      remaining: this.save.items[item],
      levelId: this.session.levelId,
    });
  }

  private async claimDesktopReward(): Promise<void> {
    const outcome = await claimDesktopReward(this.save, this.platform);
    this.updateSave(outcome.save);
    this.feedback = outcome.feedback;
    this.emitAudio(outcome.granted ? 'reward' : 'invalid');
  }

  private async claimFavoriteReward(): Promise<void> {
    const outcome = await claimFavoriteReward(this.save, this.platform);
    this.updateSave(outcome.save);
    this.feedback = outcome.feedback;
    this.emitAudio(outcome.granted ? 'reward' : 'invalid');
  }

  private async claimSidebarReward(): Promise<void> {
    const outcome = await claimSidebarReward(this.save, this.platform);
    this.updateSave(outcome.save);
    this.feedback = outcome.feedback;
    this.emitAudio(outcome.granted ? 'reward' : 'invalid');
  }

  private async skipLevelReward(): Promise<void> {
    if (!this.session || this.screen !== 'playing') {
      this.feedback = '进入关卡后才能跳过。';
      this.emitAudio('invalid');
      return;
    }

    const result = await this.platform.showRewardedAd('reward');
    if (result.status !== 'success' && result.status !== 'unsupported' && result.status !== 'failed') {
      this.feedback = '未完整观看，暂未跳关。';
      this.emitAudio('invalid');
      return;
    }
    this.handleWin({ ...this.session, status: 'won' });
    this.feedback = '已跳过本关。';
    this.emitAudio('reward');
  }

  private updateSave(save: SaveData): void {
    this.save = createDefaultSave();
    this.save = { ...this.save, ...save, items: { ...this.save.items, ...save.items } };
    writeSave(this.platform.storage, this.save);
  }

  private emitAudio(type: AudioCueType, intensity = 1): void {
    this.audioCue = {
      type,
      intensity,
      id: ++this.audioCueId,
    };
  }
}

function swapErrorFeedback(error: unknown): string {
  if (error instanceof Error && error.message === 'Cells must be adjacent') {
    return '只能交换相邻格子。';
  }

  return '该位置无法交换。';
}
