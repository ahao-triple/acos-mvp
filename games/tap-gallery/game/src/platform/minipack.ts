import type { HapticKind, PlatformAdapter, PlatformResult } from './types';

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
  ads: {
    isRewardedVideoReady(slot: 'add-steps' | 'claim-reward'): boolean;
    showRewardedVideo(slot: 'add-steps' | 'claim-reward'): Promise<{ completed: boolean }>;
  };
  haptics?: {
    trigger(kind: HapticKind): void;
  };
  logger: {
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
  };
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
    async showRewardedAd(reason): Promise<PlatformResult> {
      const slot = reason === 'extra_moves' ? 'add-steps' : 'claim-reward';
      if (!runtime.ads.isRewardedVideoReady(slot)) {
        return { status: 'unsupported' };
      }
      try {
        const result = await runtime.ads.showRewardedVideo(slot);
        return result.completed ? { status: 'success' } : { status: 'cancelled' };
      } catch (error) {
        runtime.logger.warn('Rewarded video failed.', error);
        return { status: 'failed', message: error instanceof Error ? error.message : String(error) };
      }
    },
    triggerHaptic(kind) {
      runtime.haptics?.trigger(kind);
    },
  };
}
