import type { StorageLike } from '../app/save';

export type PlatformResultStatus = 'success' | 'failed' | 'cancelled' | 'unsupported';
export type HapticKind = 'short' | 'long';

export interface PlatformResult {
  status: PlatformResultStatus;
  message?: string;
}

export interface LaunchContext {
  isSidebarEntry: boolean;
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
  showRewardedAd(reason: 'extra_moves' | 'reward'): Promise<PlatformResult>;
  addDesktopShortcut(): Promise<PlatformResult>;
  showFavoriteGuide(): Promise<PlatformResult>;
  didEnterFromSidebar(): Promise<boolean>;
  requestSidebarEntry(): Promise<PlatformResult>;
  getLaunchContext(): LaunchContext;
  triggerHaptic(kind: HapticKind): void;
}
