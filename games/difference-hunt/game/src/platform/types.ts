import type { StorageLike } from '../app/save';

export type HapticKind = 'short' | 'long';
export type RewardedAdReason = 'hint' | 'add_time' | 'unlock_level' | 'double_reward';
export type PlatformResultStatus = 'success' | 'failed' | 'cancelled' | 'unsupported';

export interface PlatformResult {
  status: PlatformResultStatus;
  message?: string;
}

export interface PlatformAdapter {
  name: string;
  storage: StorageLike;
  triggerHaptic(kind: HapticKind): void;
  playSfx(name: string): Promise<void>;
  playMusic(name: string, loop: boolean): Promise<void>;
  stopMusic(): void;
  showRewardedAd(reason: RewardedAdReason): Promise<PlatformResult>;
}
