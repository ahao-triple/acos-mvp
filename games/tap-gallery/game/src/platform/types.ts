import type { StorageLike } from '../app/save';

export type PlatformResultStatus = 'success' | 'failed' | 'cancelled' | 'unsupported';
export type HapticKind = 'short' | 'long';

export interface PlatformResult {
  status: PlatformResultStatus;
  message?: string;
}

export interface PlatformAdapter {
  name: string;
  storage: StorageLike;
  showRewardedAd(reason: 'extra_moves' | 'reward'): Promise<PlatformResult>;
  triggerHaptic(kind: HapticKind): void;
}
