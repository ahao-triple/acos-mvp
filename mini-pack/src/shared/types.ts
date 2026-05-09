import type { GameConfig } from '../core/schema.js';

export type PlatformName = 'douyin' | 'vivo';

export interface ResolvedPaths {
  configFileAbs: string;
  entryAbs: string;
  publicDirAbs: string;
  outDirAbs: string;
  douyinMaterialsAbs?: string;
}

export type LoadedGameConfig = GameConfig & {
  projectRoot: string;
  paths: ResolvedPaths;
};

export interface AssetStats {
  count: number;
  bytes: number;
}

export interface BundleResult {
  file: string;
  bytes: number;
}

export interface BuildReport {
  tool: 'mini-pack';
  platform: PlatformName;
  title: string;
  entry: string;
  publicDir: string;
  outDir: string;
  bundle: BundleResult;
  assets: AssetStats;
  warnings: string[];
}

export interface GameApp {
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export interface GameRuntime {
  canvas: HTMLCanvasElement;
  storage: RuntimeStorage;
  audio: RuntimeAudio;
  ads: RuntimeAds;
  haptics?: RuntimeHaptics;
  rewards: RuntimeRewards;
  logger: RuntimeLogger;
}

export interface RuntimeStorage {
  getString(key: string): string | null;
  setString(key: string, value: string): void;
  remove(key: string): void;
}

export interface RuntimeAudio {
  playSfx(name: string): Promise<void>;
  playMusic(name: string, loop: boolean): Promise<void>;
  stopMusic(): void;
  setMuted(muted: boolean): void;
}

export interface RuntimeAds {
  isRewardedVideoReady(slot: RewardedVideoSlot): boolean;
  showRewardedVideo(slot: RewardedVideoSlot): Promise<RewardedVideoResult>;
}

export interface RuntimeHaptics {
  trigger(kind: 'short' | 'long'): void;
}

export type RewardedVideoSlot = 'add-steps' | 'claim-reward';

export interface RewardedVideoResult {
  completed: boolean;
}

export interface RuntimeRewards {
  canAddDesktop(): Promise<boolean>;
  requestAddDesktop(): Promise<boolean>;
  canAddFavorite(): Promise<boolean>;
  requestAddFavorite(): Promise<boolean>;
  didEnterFromSidebar(): Promise<boolean>;
  requestSidebarEntry(): Promise<boolean>;
}

export interface RuntimeLogger {
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}
