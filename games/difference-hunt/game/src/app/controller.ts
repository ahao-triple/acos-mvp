import { completeLevel, loadSave, rewardCoinsForLevel, writeSave, type DifferenceHuntSave, type StorageLike } from './save';
import type { DifferenceLevel, DifferenceTarget } from '../assets/types';
import { findTargetAt, type Point } from '../core/geometry';
import type { PlatformAdapter, PlatformResult } from '../platform/types';

export type GameScreen = 'home' | 'playing' | 'win' | 'levels' | 'settings' | 'failed';
export type FeedbackType = 'none' | 'found' | 'miss' | 'win';

export interface FeedbackEvent {
  type: FeedbackType;
  targetId?: string;
  point?: Point;
  message?: string;
}

export interface GameViewState {
  screen: GameScreen;
  level: DifferenceLevel;
  levels: DifferenceLevel[];
  foundIds: string[];
  remaining: number;
  feedback: FeedbackEvent;
  save: DifferenceHuntSave;
  timer: {
    remainingMs: number;
    totalMs: number;
  };
  hintTargetId: string | null;
  reward: {
    baseCoins: number;
    doubleClaimed: boolean;
  };
  dailyRewardAvailable: boolean;
}

export interface GameControllerOptions {
  levels: DifferenceLevel[];
  storage?: StorageLike;
  save?: DifferenceHuntSave;
  platform?: PlatformAdapter;
  now?: () => number;
}

const LEVEL_DURATION_MS = 120_000;
const AD_TIME_BONUS_MS = 30_000;
const DAILY_REWARD_COINS = 20;
const DAILY_REWARD_HINTS = 1;

export class GameController {
  private readonly levels: DifferenceLevel[];
  private readonly storage?: StorageLike;
  private readonly platform?: PlatformAdapter;
  private save: DifferenceHuntSave;
  private level: DifferenceLevel;
  private foundIds = new Set<string>();
  private screen: GameScreen = 'home';
  private feedback: FeedbackEvent = { type: 'none' };
  private readonly now: () => number;
  private levelEndsAtMs = 0;
  private hintTargetId: string | null = null;
  private doubleRewardClaimed = false;

  constructor(options: GameControllerOptions) {
    this.levels = [...options.levels].sort((a, b) => a.levelNo - b.levelNo);
    if (this.levels.length === 0) {
      throw new Error('GameController requires at least one level.');
    }
    this.storage = options.storage;
    this.platform = options.platform;
    this.now = options.now ?? (() => Date.now());
    this.save = options.save ?? loadSave(options.storage);
    this.level = this.findLevel(this.save.currentLevel) ?? this.levels[0];
  }

  getViewState(): GameViewState {
    return {
      screen: this.screen,
      level: this.level,
      levels: this.levels,
      foundIds: [...this.foundIds],
      remaining: this.level.targets.length - this.foundIds.size,
      feedback: this.feedback,
      save: this.save,
      timer: {
        remainingMs: this.timerRemainingMs(),
        totalMs: LEVEL_DURATION_MS,
      },
      hintTargetId: this.hintTargetId,
      reward: {
        baseCoins: rewardCoinsForLevel(this.level.levelNo),
        doubleClaimed: this.doubleRewardClaimed,
      },
      dailyRewardAvailable: this.isDailyRewardAvailable(),
    };
  }

  tick(): void {
    if (this.screen === 'playing' && this.timerRemainingMs() <= 0) {
      this.screen = 'failed';
      this.feedback = { type: 'miss', message: '时间用完了，再试一次。' };
      void this.platform?.playSfx('invalid');
    }
  }

  startGame(): GameViewState {
    return this.startLevel(this.save.currentLevel);
  }

  tap(point: Point): FeedbackEvent {
    if (this.screen !== 'playing') {
      void this.platform?.playSfx('invalid');
      this.feedback = { type: 'miss', point };
      return this.feedback;
    }
    const target = findTargetAt(this.level, this.foundIds, point);
    if (!target) {
      void this.platform?.playSfx('invalid');
      this.feedback = { type: 'miss', point };
      return this.feedback;
    }
    this.foundIds.add(target.id);
    if (this.hintTargetId === target.id) {
      this.hintTargetId = null;
    }
    this.platform?.triggerHaptic('short');
    if (this.foundIds.size === this.level.targets.length) {
      this.screen = 'win';
      this.save = completeLevel(this.save, this.level.levelNo, this.levels.length);
      writeSave(this.storage, this.save);
      void this.platform?.playSfx('win');
      this.feedback = { type: 'win', targetId: target.id, point };
      return this.feedback;
    }
    void this.platform?.playSfx('tap');
    this.feedback = { type: 'found', targetId: target.id, point };
    return this.feedback;
  }

  startLevel(levelNo: number): GameViewState {
    const nextLevel = this.findLevel(levelNo) ?? this.levels[0];
    if (nextLevel.levelNo > this.save.highestUnlockedLevel) {
      this.screen = 'levels';
      this.feedback = { type: 'miss', message: '先观看视频解锁这一关。' };
      return this.getViewState();
    }
    this.level = nextLevel;
    this.foundIds = new Set();
    this.screen = 'playing';
    this.feedback = { type: 'none' };
    this.hintTargetId = null;
    this.doubleRewardClaimed = false;
    this.levelEndsAtMs = this.now() + LEVEL_DURATION_MS;
    this.save = {
      ...this.save,
      currentLevel: nextLevel.levelNo,
    };
    writeSave(this.storage, this.save);
    return this.getViewState();
  }

  nextLevel(): GameViewState {
    const currentIndex = this.levels.findIndex((level) => level.levelNo === this.level.levelNo);
    const next = this.levels[Math.min(this.levels.length - 1, currentIndex + 1)];
    return this.startLevel(next.levelNo);
  }

  showLevels(): GameViewState {
    this.screen = 'levels';
    return this.getViewState();
  }

  showHome(): GameViewState {
    this.screen = 'home';
    return this.getViewState();
  }

  showSettings(): GameViewState {
    this.screen = 'settings';
    return this.getViewState();
  }

  toggleSound(): GameViewState {
    this.save = {
      ...this.save,
      settings: {
        ...this.save.settings,
        soundEnabled: !this.save.settings.soundEnabled,
      },
    };
    writeSave(this.storage, this.save);
    return this.getViewState();
  }

  useHint(): FeedbackEvent {
    if (this.screen !== 'playing') {
      return this.setMessage('先开始关卡再使用提示。');
    }
    const target = this.firstMissingTarget();
    if (!target) {
      return this.setMessage('已经全部找到了。');
    }
    if (this.save.hints <= 0) {
      return this.setMessage('提示不足，可以看广告获得提示。');
    }
    this.save = {
      ...this.save,
      hints: this.save.hints - 1,
    };
    this.hintTargetId = target.id;
    writeSave(this.storage, this.save);
    void this.platform?.playSfx('tap');
    return this.setMessage('已标出一个还没找到的位置。');
  }

  async claimAdHint(): Promise<GameViewState> {
    const result = await this.showRewardedAdWithFallback('hint');
    if (!isRewardGranted(result)) {
      this.setMessage(result.message ?? '完整观看视频广告才能领取奖励。');
      return this.getViewState();
    }
    this.save = {
      ...this.save,
      hints: this.save.hints + 1,
    };
    const target = this.firstMissingTarget();
    this.hintTargetId = target?.id ?? null;
    this.feedback = { type: 'none', message: result.message ?? '已获得 1 次提示。' };
    writeSave(this.storage, this.save);
    void this.platform?.playSfx('win');
    return this.getViewState();
  }

  async claimAdTimeBonus(): Promise<GameViewState> {
    const result = await this.showRewardedAdWithFallback('add_time');
    if (!isRewardGranted(result)) {
      this.setMessage(result.message ?? '完整观看视频广告才能领取奖励。');
      return this.getViewState();
    }
    this.levelEndsAtMs = Math.max(this.levelEndsAtMs, this.now()) + AD_TIME_BONUS_MS;
    if (this.screen === 'failed') {
      this.screen = 'playing';
    }
    this.feedback = { type: 'none', message: result.message ?? '已增加 30 秒。' };
    void this.platform?.playSfx('win');
    return this.getViewState();
  }

  async unlockLevelWithAd(levelNo: number): Promise<GameViewState> {
    const level = this.findLevel(levelNo);
    if (!level) {
      this.setMessage('关卡不存在。');
      return this.getViewState();
    }
    if (levelNo <= this.save.highestUnlockedLevel) {
      return this.startLevel(levelNo);
    }
    const result = await this.showRewardedAdWithFallback('unlock_level');
    if (!isRewardGranted(result)) {
      this.setMessage(result.message ?? '完整观看视频广告才能解锁。');
      return this.getViewState();
    }
    this.save = {
      ...this.save,
      highestUnlockedLevel: Math.max(this.save.highestUnlockedLevel, levelNo),
    };
    this.screen = 'levels';
    this.feedback = { type: 'none', message: result.message ?? `已解锁第 ${levelNo} 关。` };
    writeSave(this.storage, this.save);
    void this.platform?.playSfx('win');
    return this.getViewState();
  }

  async claimDoubleReward(): Promise<GameViewState> {
    if (this.screen !== 'win' || this.doubleRewardClaimed) {
      return this.getViewState();
    }
    const result = await this.showRewardedAdWithFallback('double_reward');
    if (!isRewardGranted(result)) {
      this.setMessage(result.message ?? '完整观看视频广告才能领取奖励。');
      return this.getViewState();
    }
    this.doubleRewardClaimed = true;
    this.save = {
      ...this.save,
      coins: this.save.coins + rewardCoinsForLevel(this.level.levelNo),
    };
    this.feedback = { type: 'none', message: result.message ?? '金币奖励已翻倍。' };
    writeSave(this.storage, this.save);
    void this.platform?.playSfx('win');
    return this.getViewState();
  }

  claimDailyReward(day = formatLocalDay(this.now())): GameViewState {
    if (this.save.lastDailyRewardDay === day) {
      this.feedback = { type: 'none', message: '今日奖励已经领取。' };
      return this.getViewState();
    }
    this.save = {
      ...this.save,
      coins: this.save.coins + DAILY_REWARD_COINS,
      hints: this.save.hints + DAILY_REWARD_HINTS,
      lastDailyRewardDay: day,
    };
    this.feedback = { type: 'none', message: '已领取每日奖励：金币 20、提示 1。' };
    writeSave(this.storage, this.save);
    void this.platform?.playSfx('win');
    return this.getViewState();
  }

  private findLevel(levelNo: number): DifferenceLevel | undefined {
    return this.levels.find((level) => level.levelNo === levelNo);
  }

  private timerRemainingMs(): number {
    if (this.screen !== 'playing' || this.levelEndsAtMs <= 0) {
      return LEVEL_DURATION_MS;
    }
    return Math.max(0, this.levelEndsAtMs - this.now());
  }

  private firstMissingTarget(): DifferenceTarget | null {
    return this.level.targets.find((target) => !this.foundIds.has(target.id)) ?? null;
  }

  private setMessage(message: string): FeedbackEvent {
    this.feedback = { type: 'none', message };
    return this.feedback;
  }

  private async showRewardedAdWithFallback(reason: Parameters<PlatformAdapter['showRewardedAd']>[0]): Promise<PlatformResult> {
    if (!this.platform) {
      return { status: 'success', message: '预览环境已直接发放奖励。' };
    }
    const result = await this.platform.showRewardedAd(reason);
    if (result.status === 'failed' || result.status === 'unsupported') {
      return {
        ...result,
        status: 'success',
        message: result.message ?? '广告暂不可用，已直接发放奖励。',
      };
    }
    return result;
  }

  private isDailyRewardAvailable(): boolean {
    return this.save.lastDailyRewardDay !== formatLocalDay(this.now());
  }
}

export function foundTargetById(level: DifferenceLevel, targetId: string): DifferenceTarget | undefined {
  return level.targets.find((target) => target.id === targetId);
}

function isRewardGranted(result: PlatformResult): boolean {
  return result.status === 'success' || result.status === 'unsupported' || result.status === 'failed';
}

function formatLocalDay(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
