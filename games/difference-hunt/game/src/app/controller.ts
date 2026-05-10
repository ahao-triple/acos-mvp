import { completeLevel, loadSave, rewardCoinsForLevel, writeSave, type DifferenceHuntSave, type StorageLike } from './save';
import type { DifferenceLevel, DifferenceTarget } from '../assets/types';
import { findTargetAt, type Point } from '../core/geometry';
import type { PlatformAdapter, PlatformResult } from '../platform/types';

export type GameScreen = 'home' | 'playing' | 'win' | 'levels' | 'settings' | 'failed';
export type FeedbackType = 'none' | 'found' | 'miss' | 'win';

export type RewardedAdRequest =
  | { type: 'hint' }
  | { type: 'add_time' }
  | { type: 'unlock_level'; levelNo: number }
  | { type: 'double_reward' };

export interface AdPrompt {
  title: string;
  request: RewardedAdRequest;
}

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
  adPrompt: AdPrompt | null;
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
  private adPrompt: AdPrompt | null = null;
  private feedbackExpiresAtMs = 0;
  private musicPlaying = false;

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
      adPrompt: this.adPrompt,
    };
  }

  tick(): void {
    if (this.screen === 'playing' && this.timerRemainingMs() <= 0) {
      this.screen = 'failed';
      this.feedback = { type: 'miss', message: '时间用完了，再试一次。' };
      this.feedbackExpiresAtMs = this.now() + 2000;
      this.playSound('lose');
    }
    if (this.feedback.message && this.feedbackExpiresAtMs > 0 && this.now() >= this.feedbackExpiresAtMs) {
      this.clearFeedback();
    }
  }

  startGame(): GameViewState {
    return this.startLevel(this.save.currentLevel);
  }

  requestRewardedAd(request: RewardedAdRequest): GameViewState {
    this.adPrompt = {
      title: rewardedAdPromptTitle(request),
      request,
    };
    return this.getViewState();
  }

  cancelRewardedAd(): GameViewState {
    this.adPrompt = null;
    return this.getViewState();
  }

  playUiClick(): void {
    this.playSound('tap');
  }

  async confirmRewardedAd(): Promise<GameViewState> {
    const request = this.adPrompt?.request;
    this.adPrompt = null;
    if (!request) {
      return this.getViewState();
    }

    if (request.type === 'hint') {
      return this.claimAdHint();
    }
    if (request.type === 'add_time') {
      return this.claimAdTimeBonus();
    }
    if (request.type === 'unlock_level') {
      return this.unlockLevelWithAd(request.levelNo);
    }
    return this.claimDoubleReward();
  }

  tap(point: Point): FeedbackEvent {
    if (this.screen !== 'playing') {
      this.playSound('invalid');
      this.feedback = { type: 'miss', point };
      return this.feedback;
    }
    const target = findTargetAt(this.level, this.foundIds, point);
    if (!target) {
      this.playSound('invalid');
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
      this.playSound('win');
      this.feedback = { type: 'win', targetId: target.id, point };
      return this.feedback;
    }
    this.playSound('found');
    this.feedback = { type: 'found', targetId: target.id, point };
    return this.feedback;
  }

  startLevel(levelNo: number): GameViewState {
    const nextLevel = this.findLevel(levelNo) ?? this.levels[0];
    if (nextLevel.levelNo > this.save.highestUnlockedLevel) {
      return this.requestRewardedAd({ type: 'unlock_level', levelNo: nextLevel.levelNo });
    }
    this.level = nextLevel;
    this.foundIds = new Set();
    this.screen = 'playing';
    this.feedback = { type: 'none' };
    this.hintTargetId = null;
    this.doubleRewardClaimed = false;
    this.adPrompt = null;
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
    this.adPrompt = null;
    this.clearFeedback();
    return this.getViewState();
  }

  showHome(): GameViewState {
    this.screen = 'home';
    this.adPrompt = null;
    this.clearFeedback();
    return this.getViewState();
  }

  showSettings(): GameViewState {
    this.screen = 'settings';
    this.adPrompt = null;
    this.clearFeedback();
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
    this.syncBackgroundMusic();
    return this.getViewState();
  }

  useHint(): FeedbackEvent {
    if (this.screen !== 'playing') {
      return this.setMessage('请先开始游戏。');
    }
    const target = this.firstMissingTarget();
    if (!target) {
      return this.setMessage('已经找完了。');
    }
    if (this.save.hints <= 0) {
      return this.setMessage('提示不足。');
    }
    this.save = {
      ...this.save,
      hints: this.save.hints - 1,
    };
    this.hintTargetId = target.id;
    writeSave(this.storage, this.save);
    this.playSound('found');
    return this.setMessage('已标出一个位置。');
  }

  async claimAdHint(): Promise<GameViewState> {
    const result = await this.showRewardedAdWithFallback('hint');
    if (!isRewardGranted(result)) {
      this.setMessage(result.message ?? '未完成观看。');
      return this.getViewState();
    }
    this.save = {
      ...this.save,
      hints: this.save.hints + 1,
    };
    const target = this.firstMissingTarget();
    this.hintTargetId = target?.id ?? null;
    this.setMessage(result.message ?? '获得提示 x1。');
    writeSave(this.storage, this.save);
    this.playSound('win');
    return this.getViewState();
  }

  async claimAdTimeBonus(): Promise<GameViewState> {
    const result = await this.showRewardedAdWithFallback('add_time');
    if (!isRewardGranted(result)) {
      this.setMessage(result.message ?? '未完成观看。');
      return this.getViewState();
    }
    this.levelEndsAtMs = Math.max(this.levelEndsAtMs, this.now()) + AD_TIME_BONUS_MS;
    if (this.screen === 'failed') {
      this.screen = 'playing';
    }
    this.setMessage(result.message ?? '已增加 30 秒。');
    this.playSound('win');
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
      this.setMessage(result.message ?? '解锁失败。');
      return this.getViewState();
    }
    this.save = {
      ...this.save,
      highestUnlockedLevel: Math.max(this.save.highestUnlockedLevel, levelNo),
    };
    writeSave(this.storage, this.save);
    this.playSound('win');
    return this.startLevel(levelNo);
  }

  async claimDoubleReward(): Promise<GameViewState> {
    if (this.screen !== 'win' || this.doubleRewardClaimed) {
      return this.getViewState();
    }
    const result = await this.showRewardedAdWithFallback('double_reward');
    if (!isRewardGranted(result)) {
      this.setMessage(result.message ?? '未完成观看。');
      return this.getViewState();
    }
    this.doubleRewardClaimed = true;
    this.save = {
      ...this.save,
      coins: this.save.coins + rewardCoinsForLevel(this.level.levelNo),
    };
    this.setMessage(result.message ?? '金币奖励已翻倍。');
    writeSave(this.storage, this.save);
    this.playSound('win');
    return this.getViewState();
  }

  claimDailyReward(day = formatLocalDay(this.now())): GameViewState {
    if (this.save.lastDailyRewardDay === day) {
      this.setMessage('今日已领。');
      return this.getViewState();
    }
    this.save = {
      ...this.save,
      coins: this.save.coins + DAILY_REWARD_COINS,
      hints: this.save.hints + DAILY_REWARD_HINTS,
      lastDailyRewardDay: day,
    };
    this.setMessage('已领取奖励。');
    writeSave(this.storage, this.save);
    this.playSound('win');
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
    this.feedbackExpiresAtMs = this.now() + 2200;
    return this.feedback;
  }

  private playSound(name: string): void {
    if (!this.save.settings.soundEnabled) {
      return;
    }
    this.syncBackgroundMusic();
    void this.platform?.playSfx(name);
  }

  syncBackgroundMusic(): void {
    if (!this.platform) {
      return;
    }
    if (!this.save.settings.soundEnabled) {
      this.platform.stopMusic();
      this.musicPlaying = false;
      return;
    }
    if (this.musicPlaying) {
      return;
    }
    this.musicPlaying = true;
    void this.platform.playMusic('bgm', true).catch(() => {
      this.musicPlaying = false;
    });
  }

  private clearFeedback(): void {
    this.feedback = { type: 'none' };
    this.feedbackExpiresAtMs = 0;
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

function rewardedAdPromptTitle(request: RewardedAdRequest): string {
  if (request.type === 'hint') {
    return '看视频领取提示';
  }
  if (request.type === 'add_time') {
    return '看视频加 30 秒';
  }
  if (request.type === 'unlock_level') {
    return `看视频解锁第 ${request.levelNo} 关`;
  }
  return '看视频领翻倍奖励';
}

function formatLocalDay(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
