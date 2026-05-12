import type { StorageLike } from '../app/save';

export type HapticKind = 'short' | 'long';
export type RewardedAdReason = 'hint' | 'add_time' | 'unlock_level' | 'double_reward';
export type PlatformResultStatus = 'success' | 'failed' | 'cancelled' | 'unsupported';

export interface PlatformResult {
  status: PlatformResultStatus;
  message?: string;
}

export interface PlatformLoginResult {
  platform: string;
  code: string;
}

export interface PlatformRequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  data?: unknown;
  headers?: Record<string, string>;
}

export interface PlatformResponse {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
}

export interface PlatformAdapter {
  name: string;
  storage: StorageLike;
  login(): Promise<PlatformLoginResult>;
  request(options: PlatformRequestOptions): Promise<PlatformResponse>;
  triggerHaptic(kind: HapticKind): void;
  playSfx(name: string): Promise<void>;
  playMusic(name: string, loop: boolean): Promise<void>;
  stopMusic(): void;
  showRewardedAd(reason: RewardedAdReason): Promise<PlatformResult>;
}
