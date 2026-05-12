import type { HapticKind, PlatformAdapter } from './types';

export interface MiniPackGameApp {
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export interface MiniPackGameRuntime {
  canvas: HTMLCanvasElement;
  config?: {
    platform: string;
    serverBaseUrl: string;
    pkgName?: string;
  };
  renderMode?: 'canvas' | 'webgl';
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
  auth: {
    login(): Promise<{ platform: string; code: string }>;
  };
  net: {
    request(options: {
      url: string;
      method?: 'GET' | 'POST';
      data?: unknown;
      headers?: Record<string, string>;
    }): Promise<{ status: number; data: unknown; headers?: Record<string, string> }>;
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
  createCanvas?: () => HTMLCanvasElement;
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
    login() {
      return runtime.auth.login();
    },
    request(options) {
      return runtime.net.request(options);
    },
    triggerHaptic(kind) {
      runtime.haptics?.trigger(kind);
    },
    playSfx(name) {
      return runtime.audio.playSfx(name);
    },
    playMusic(name, loop) {
      return runtime.audio.playMusic(name, loop);
    },
    stopMusic() {
      runtime.audio.stopMusic();
    },
    async showRewardedAd(reason) {
      const slot = reason === 'add_time' ? 'add-steps' : 'claim-reward';
      if (!runtime.ads.isRewardedVideoReady(slot)) {
        return { status: 'unsupported', message: '广告暂不可用。' };
      }
      try {
        const result = await runtime.ads.showRewardedVideo(slot);
        return result.completed ? { status: 'success' } : { status: 'cancelled', message: '未完成观看。' };
      } catch (error) {
        runtime.logger.warn('Rewarded video failed.', error);
        return { status: 'failed', message: '广告加载失败。' };
      }
    },
  };
}
