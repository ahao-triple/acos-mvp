import type { SoundEngineOptions } from '../audio/soundEngine';
import type { PlatformAdapter, PlatformResult } from './types';

export type MiniPackRewardedVideoSlot = 'add-steps' | 'claim-reward';

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
    isRewardedVideoReady(slot: MiniPackRewardedVideoSlot): boolean;
    showRewardedVideo(slot: MiniPackRewardedVideoSlot): Promise<{ completed: boolean }>;
  };
  rewards: {
    canAddDesktop(): Promise<boolean>;
    requestAddDesktop(): Promise<boolean>;
    canAddFavorite(): Promise<boolean>;
    requestAddFavorite(): Promise<boolean>;
    didEnterFromSidebar(): Promise<boolean>;
    requestSidebarEntry(): Promise<boolean>;
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
      getItem(key: string) {
        return runtime.storage.getString(key);
      },
      setItem(key: string, value: string) {
        runtime.storage.setString(key, value);
      },
      removeItem(key: string) {
        runtime.storage.remove(key);
      },
    },
    async showRewardedAd(reason): Promise<PlatformResult> {
      const slot = reason === 'extra_moves' ? 'add-steps' : 'claim-reward';
      runtimeDebugLog(runtime, 'rewarded_ad_request', { reason, slot });
      try {
        if (!runtime.ads.isRewardedVideoReady(slot)) {
          runtimeDebugLog(runtime, 'rewarded_ad_platform_result', { reason, slot, status: 'unsupported' });
          return { status: 'unsupported' };
        }
        const result = await runtime.ads.showRewardedVideo(slot);
        runtimeDebugLog(runtime, 'rewarded_ad_platform_result', { reason, slot, status: result.completed ? 'success' : 'cancelled' });
        return result.completed ? { status: 'success' } : { status: 'cancelled' };
      } catch (error) {
        runtime.logger.warn('Rewarded video failed.', error);
        runtimeDebugLog(runtime, 'rewarded_ad_platform_result', { reason, slot, status: 'failed', message: errorMessage(error) });
        return { status: 'failed', message: errorMessage(error) };
      }
    },
    async addDesktopShortcut(): Promise<PlatformResult> {
      try {
        if (!(await runtime.rewards.canAddDesktop())) {
          return { status: 'unsupported' };
        }
        return (await runtime.rewards.requestAddDesktop()) ? { status: 'success' } : { status: 'failed' };
      } catch (error) {
        runtime.logger.warn('Add desktop failed.', error);
        return { status: 'failed', message: errorMessage(error) };
      }
    },
    async showFavoriteGuide(): Promise<PlatformResult> {
      try {
        if (!(await runtime.rewards.canAddFavorite())) {
          return { status: 'unsupported' };
        }
        return (await runtime.rewards.requestAddFavorite()) ? { status: 'success' } : { status: 'failed' };
      } catch (error) {
        runtime.logger.warn('Add favorite failed.', error);
        return { status: 'failed', message: errorMessage(error) };
      }
    },
    async didEnterFromSidebar(): Promise<boolean> {
      try {
        return await runtime.rewards.didEnterFromSidebar();
      } catch (error) {
        runtime.logger.warn('Sidebar entry check failed.', error);
        return false;
      }
    },
    async requestSidebarEntry(): Promise<PlatformResult> {
      try {
        return (await runtime.rewards.requestSidebarEntry())
          ? { status: 'success' }
          : { status: 'failed', message: '侧边栏跳转未完成。' };
      } catch (error) {
        runtime.logger.warn('Sidebar entry request failed.', error);
        return { status: 'failed', message: errorMessage(error) };
      }
    },
    getLaunchContext() {
      return { isSidebarEntry: false };
    },
  };
}

export function createMiniPackSoundOptions(runtime: MiniPackGameRuntime): SoundEngineOptions {
  return {
    createContext: () => null,
    createAssetPlayer: (asset) => ({
      preload() {},
      async play() {
        await runtime.audio.playSfx(asset.type);
      },
    }),
    createMusicPlayer: () => ({
      async play() {
        await runtime.audio.playMusic('bgm', true);
      },
      pause() {
        runtime.audio.stopMusic();
      },
    }),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function runtimeDebugLog(runtime: MiniPackGameRuntime, event: string, data: Record<string, unknown>): void {
  runtime.logger.info(`[GLFX] ${event}`, data);
}
