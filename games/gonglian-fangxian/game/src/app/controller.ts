import { levels } from '../config/levels';
import { applyMove, applyPowerUp, createSession } from '../core/session';
import type { GameSession, LevelConfig, NodeReward, Position, PowerUpType } from '../core/types';
import type { PlatformAdapter } from '../platform/types';
import type { AudioCue, AudioCueType } from '../audio/soundEngine';
import { debugLog } from './debugLog';
import { createDefaultSave, loadSave, type SaveData, writeSave } from './save';
import { claimAdItemReward, claimDesktopReward, claimDoubleCoinsReward, claimFavoriteReward, claimSidebarReward, requestExtraMoves, type InventoryItem } from './rewards';
import { chapterProgressForSave, levelById, type ChapterProgress } from './campaign';

export type Screen = 'menu' | 'levels' | 'briefing' | 'playing' | 'paused' | 'won' | 'lost' | 'settings' | 'supplies';

export type RewardedAdRequest =
  | { type: 'doubleWinReward' }
  | { type: 'extraMovesAd' }
  | { type: 'powerUpItem'; item: PowerUpType };

export interface AdPrompt {
  title: string;
  request: RewardedAdRequest;
}

export type AppAction =
  | { type: 'start' }
  | { type: 'openLevels' }
  | { type: 'openSettings' }
  | { type: 'openSupplies' }
  | { type: 'closeModal' }
  | { type: 'requestRewardedAd'; request: RewardedAdRequest }
  | { type: 'confirmRewardedAd' }
  | { type: 'cancelRewardedAd' }
  | { type: 'selectLevel'; levelId: number }
  | { type: 'beginLevel' }
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
  | { type: 'doubleWinReward' }
  | { type: 'toggleSound' }
  | { type: 'toggleMusic' };

export interface WinSummary {
  levelId: number;
  chapterTitle: string;
  baseCoins: number;
  nodeReward: NodeReward | null;
  nextLevelId: number | null;
  doubled: boolean;
}

export interface AppViewState {
  screen: Screen;
  save: SaveData;
  session: GameSession | null;
  pendingLevel: LevelConfig | null;
  winSummary: WinSummary | null;
  adPrompt: AdPrompt | null;
  chapterProgress: ChapterProgress[];
  feedback: string | null;
  visualCue: VisualCue | null;
  audioCue: AudioCue | null;
  highestLevel: number;
  levelCount: number;
  activePowerUp: PowerUpType | null;
}

export type VisualCue =
  | { type: 'swapRejected'; from: Position; to: Position; id: number }
  | { type: 'combo'; combo: number; id: number };

export class GameController {
  private save: SaveData;
  private session: GameSession | null = null;
  private screen: Screen = 'menu';
  private feedback: string | null = null;
  private visualCue: VisualCue | null = null;
  private audioCue: AudioCue | null = null;
  private pendingLevelId: number | null = null;
  private winSummary: WinSummary | null = null;
  private adPrompt: AdPrompt | null = null;
  private doubleRewardPending = false;
  private activePowerUp: PowerUpType | null = null;
  private cueId = 0;
  private audioCueId = 0;
  private seed = 1000;

  constructor(private readonly platform: PlatformAdapter) {
    this.save = loadSave(platform.storage);
  }

  getViewState(): AppViewState {
    return {
      screen: this.screen,
      save: this.save,
      session: this.session,
      pendingLevel: this.pendingLevelId ? levelById(this.pendingLevelId) : null,
      winSummary: this.winSummary,
      adPrompt: this.adPrompt,
      chapterProgress: chapterProgressForSave(this.save.highestUnlockedLevel, this.save.completedLevelCount),
      feedback: this.feedback,
      visualCue: this.visualCue,
      audioCue: this.audioCue,
      highestLevel: this.save.highestUnlockedLevel,
      levelCount: levels.length,
      activePowerUp: this.activePowerUp,
    };
  }

  async dispatch(action: AppAction): Promise<void> {
    this.feedback = null;
    this.visualCue = null;
    this.audioCue = null;
    if (action.type !== 'tapCell') {
      this.emitAudio('button');
    }

    switch (action.type) {
      case 'start':
        this.openBriefing(this.save.highestUnlockedLevel);
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
        this.adPrompt = null;
        this.screen = this.session?.status === 'playing' ? 'playing' : 'menu';
        break;
      case 'requestRewardedAd':
        this.openRewardedAdPrompt(action.request);
        break;
      case 'confirmRewardedAd':
        await this.confirmRewardedAd();
        break;
      case 'cancelRewardedAd':
        this.adPrompt = null;
        break;
      case 'selectLevel':
        this.openBriefing(action.levelId);
        break;
      case 'beginLevel':
        this.beginPendingLevel();
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
        this.adPrompt = null;
        this.screen = 'menu';
        break;
      case 'retry':
        this.openBriefing(this.session?.levelId ?? this.pendingLevelId ?? this.save.highestUnlockedLevel);
        break;
      case 'nextLevel':
        this.openBriefing(Math.min(levels.length, (this.session?.levelId ?? this.pendingLevelId ?? 1) + 1));
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
      case 'doubleWinReward':
        await this.doubleWinReward();
        break;
      case 'toggleSound':
        this.updateSave({ ...this.save, soundEnabled: !this.save.soundEnabled });
        break;
      case 'toggleMusic':
        this.updateSave({ ...this.save, musicEnabled: !this.save.musicEnabled });
        break;
    }
  }

  private openBriefing(levelId: number): void {
    if (levelId > this.save.highestUnlockedLevel) {
      this.pendingLevelId = null;
      this.feedback = '该关卡尚未解锁。';
      this.screen = 'levels';
      return;
    }

    const level = levelById(levelId);
    this.pendingLevelId = level.id;
    this.session = null;
    this.activePowerUp = null;
    this.winSummary = null;
    this.screen = 'briefing';
  }

  private beginPendingLevel(): void {
    this.startLevel(this.pendingLevelId ?? this.save.highestUnlockedLevel);
  }

  private startLevel(levelId: number): void {
    const level = levelById(levelId);
    this.seed += 1;
    this.pendingLevelId = level.id;
    this.winSummary = null;
    this.adPrompt = null;
    this.session = createSession(level, this.seed);
    this.screen = 'playing';
  }

  private openRewardedAdPrompt(request: RewardedAdRequest): void {
    this.adPrompt = {
      request,
      title: rewardedAdPromptTitle(request),
    };
  }

  private async confirmRewardedAd(): Promise<void> {
    const request = this.adPrompt?.request;
    this.adPrompt = null;
    if (!request) {
      return;
    }

    if (request.type === 'doubleWinReward') {
      await this.doubleWinReward();
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
      } else if (next.comboCount >= 2) {
        this.emitAudio('combo', next.comboCount);
      } else if (next.lastEvents.length > 0) {
        this.emitAudio('match');
      }
      if (next.comboCount >= 2) {
        this.visualCue = { type: 'combo', combo: next.comboCount, id: ++this.cueId };
      }
    } catch (error) {
      this.session = { ...this.session, selectedCell: position };
      this.feedback = error instanceof Error ? error.message : '该位置无法交换。';
      this.visualCue = { type: 'swapRejected', from: previous, to: position, id: ++this.cueId };
      this.emitAudio('invalid');
    }
  }

  private handleWin(session: GameSession): void {
    const level = levelById(session.levelId);
    const baseCoins = level.rewards.coins;
    const nextHighest = Math.min(levels.length, Math.max(this.save.highestUnlockedLevel, session.levelId + 1));
    const nextLevelId = session.levelId < levels.length ? session.levelId + 1 : null;
    const rewardSave = this.addNodeReward(
      {
        ...this.save,
        highestUnlockedLevel: nextHighest,
        completedLevelCount: Math.min(levels.length, Math.max(this.save.completedLevelCount, session.levelId)),
        coins: this.save.coins + baseCoins,
      },
      level.nodeReward,
    );

    this.updateSave(rewardSave);
    this.winSummary = {
      levelId: session.levelId,
      chapterTitle: level.chapterTitle,
      baseCoins,
      nodeReward: level.nodeReward ?? null,
      nextLevelId,
      doubled: false,
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
      this.openRewardedAdPrompt({ type: 'powerUpItem', item });
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
      this.feedback = '已重排防线。';
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
      this.feedback = item === 'bomb' ? `${prefix}选择一个格子炸开周围区域。` : `${prefix}选择一个格子吸走同类资源。`;
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

  private async doubleWinReward(): Promise<void> {
    if (!this.winSummary || this.screen !== 'won') {
      this.feedback = '通关后才能领取翻倍奖励。';
      this.emitAudio('invalid');
      return;
    }

    if (this.winSummary.doubled || this.doubleRewardPending) {
      this.feedback = this.doubleRewardPending ? '翻倍奖励领取中。' : '翻倍奖励已领取。';
      this.emitAudio('invalid');
      return;
    }

    this.doubleRewardPending = true;
    try {
      const outcome = await claimDoubleCoinsReward(this.save, this.winSummary.baseCoins, this.platform);
      this.feedback = outcome.feedback;
      this.emitAudio(outcome.granted ? 'reward' : 'invalid');
      if (outcome.granted) {
        this.updateSave(outcome.save);
        this.winSummary = { ...this.winSummary, doubled: true };
      }
    } finally {
      this.doubleRewardPending = false;
    }
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

function rewardedAdPromptTitle(request: RewardedAdRequest): string {
  if (request.type === 'doubleWinReward') {
    return '观看视频让本关金币奖励翻倍';
  }

  if (request.type === 'extraMovesAd') {
    return '观看视频领取 5 步补给';
  }

  const labels: Record<PowerUpType, string> = {
    bomb: '炸开',
    suck: '吸走',
    shuffle: '重排',
  };
  return `观看视频领取${labels[request.item]}道具`;
}
