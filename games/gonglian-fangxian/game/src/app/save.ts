import { LEVEL_COUNT } from '../config/levels';

export const SAVE_KEY = 'gonglian-fangxian-save';

export interface SaveData {
  version: 1;
  highestUnlockedLevel: number;
  completedLevelCount: number;
  items: {
    extraMoves: number;
    bomb: number;
    suck: number;
    shuffle: number;
  };
  desktopRewardClaimed: boolean;
  favoriteRewardClaimed: boolean;
  sidebarRewardClaimed: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createDefaultSave(): SaveData {
  return {
    version: 1,
    highestUnlockedLevel: 1,
    completedLevelCount: 0,
    items: {
      extraMoves: 0,
      bomb: 0,
      suck: 0,
      shuffle: 0,
    },
    desktopRewardClaimed: false,
    favoriteRewardClaimed: false,
    sidebarRewardClaimed: false,
    soundEnabled: true,
    musicEnabled: true,
  };
}

export function loadSave(storage: StorageLike, key = SAVE_KEY): SaveData {
  const raw = storage.getItem(key);
  if (!raw) {
    return createDefaultSave();
  }

  try {
    return repairSaveData(JSON.parse(raw));
  } catch {
    return createDefaultSave();
  }
}

export function writeSave(storage: StorageLike, save: SaveData, key = SAVE_KEY): void {
  storage.setItem(key, JSON.stringify(repairSaveData(save)));
}

export function repairSaveData(input: unknown): SaveData {
  const defaults = createDefaultSave();
  if (!isRecord(input)) {
    return defaults;
  }

  const items = isRecord(input.items) ? input.items : {};
  const highestUnlockedLevel = readNumber(input.highestUnlockedLevel, defaults.highestUnlockedLevel, 1, LEVEL_COUNT);
  const completedLevelCount =
    'completedLevelCount' in input
      ? readNumber(input.completedLevelCount, defaults.completedLevelCount, 0, LEVEL_COUNT)
      : Math.max(0, highestUnlockedLevel - 1);

  return {
    version: 1,
    highestUnlockedLevel,
    completedLevelCount,
    items: {
      extraMoves: readNumber(items.extraMoves, defaults.items.extraMoves, 0),
      bomb: readNumber(items.bomb, defaults.items.bomb, 0),
      suck: readNumber(items.suck, defaults.items.suck, 0),
      shuffle: readNumber(items.shuffle, defaults.items.shuffle, 0),
    },
    desktopRewardClaimed: readBoolean(input.desktopRewardClaimed, defaults.desktopRewardClaimed),
    favoriteRewardClaimed: readBoolean(input.favoriteRewardClaimed, defaults.favoriteRewardClaimed),
    sidebarRewardClaimed: readBoolean(input.sidebarRewardClaimed, defaults.sidebarRewardClaimed),
    soundEnabled: readBoolean(input.soundEnabled, defaults.soundEnabled),
    musicEnabled: readBoolean(input.musicEnabled, defaults.musicEnabled),
  };
}

function readNumber(value: unknown, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
