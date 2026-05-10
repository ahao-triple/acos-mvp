import type { HapticKind, PlatformAdapter } from './types';

export interface MiniPackGameApp {
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export interface MiniPackGameRuntime {
  canvas: HTMLCanvasElement;
  storage: {
    getString(key: string): string | null;
    setString(key: string, value: string): void;
    remove(key: string): void;
  };
  audio: {
    playSfx(name: string): Promise<void>;
    playMusic(name: string, loop: boolean): Promise<void>;
    stopMusic(): void;
    setMuted(muted: boolean): void;
  };
  haptics?: {
    trigger(kind: HapticKind): void;
  };
  ads: {
    isRewardedVideoReady(slot: 'add-steps' | 'claim-reward'): boolean;
    showRewardedVideo(slot: 'add-steps' | 'claim-reward'): Promise<{ completed: boolean }>;
  };
  logger: {
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
  };
  present?: () => void;
}

export function createMiniPackPlatformAdapter(runtime: MiniPackGameRuntime): PlatformAdapter {
  return {
    name: 'mini-pack',
    storage: {
      getItem(key) {
        return runtime.storage.getString(key);
      },
      setItem(key, value) {
        runtime.storage.setString(key, value);
      },
      removeItem(key) {
        runtime.storage.remove(key);
      },
    },
    triggerHaptic(kind) {
      runtime.haptics?.trigger(kind);
    },
    playSfx(name) {
      return runtime.audio.playSfx(name);
    },
    async showRewardedAd(reason) {
      const slot = reason === 'add_time' ? 'add-steps' : 'claim-reward';
      if (!runtime.ads.isRewardedVideoReady(slot)) {
        return { status: 'unsupported', message: '广告暂时不可用，已发放兜底奖励。' };
      }
      try {
        const result = await runtime.ads.showRewardedVideo(slot);
        return result.completed ? { status: 'success' } : { status: 'cancelled', message: '完整观看视频广告才能领取奖励。' };
      } catch (error) {
        runtime.logger.warn('Rewarded video failed.', error);
        return { status: 'failed', message: '广告加载失败，已发放兜底奖励。' };
      }
    },
  };
}
