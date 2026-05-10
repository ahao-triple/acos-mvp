export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DifferenceHuntSave {
  highestUnlockedLevel: number;
  completedLevels: number[];
  currentLevel: number;
  hints: number;
  coins: number;
  settings: {
    soundEnabled: boolean;
  };
  lastDailyRewardDay: string;
}

export const DEFAULT_SAVE: DifferenceHuntSave = {
  highestUnlockedLevel: 1,
  completedLevels: [],
  currentLevel: 1,
  hints: 0,
  coins: 0,
  settings: {
    soundEnabled: true,
  },
  lastDailyRewardDay: '',
};

const SAVE_KEY = 'difference-hunt-save-v1';

export function loadSave(storage?: StorageLike): DifferenceHuntSave {
  if (!storage) {
    return { ...DEFAULT_SAVE };
  }
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) {
      return { ...DEFAULT_SAVE };
    }
    return normalizeSave(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function writeSave(storage: StorageLike | undefined, save: DifferenceHuntSave): void {
  storage?.setItem(SAVE_KEY, JSON.stringify(save));
}

export function completeLevel(save: DifferenceHuntSave, levelNo: number, maxLevel: number): DifferenceHuntSave {
  const completed = new Set(save.completedLevels);
  completed.add(levelNo);
  const nextLevel = Math.min(maxLevel, levelNo + 1);
  return {
    highestUnlockedLevel: Math.max(save.highestUnlockedLevel, nextLevel),
    completedLevels: [...completed].sort((a, b) => a - b),
    currentLevel: nextLevel,
    hints: save.hints,
    coins: save.coins + rewardCoinsForLevel(levelNo),
    settings: save.settings,
    lastDailyRewardDay: save.lastDailyRewardDay,
  };
}

export function rewardCoinsForLevel(levelNo: number): number {
  return 20 + levelNo * 10;
}

function normalizeSave(value: unknown): DifferenceHuntSave {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_SAVE };
  }
  const record = value as Partial<DifferenceHuntSave>;
  return {
    highestUnlockedLevel: positiveInteger(record.highestUnlockedLevel) ?? DEFAULT_SAVE.highestUnlockedLevel,
    completedLevels: Array.isArray(record.completedLevels) ? record.completedLevels.filter((item) => positiveInteger(item) !== null) : [],
    currentLevel: positiveInteger(record.currentLevel) ?? DEFAULT_SAVE.currentLevel,
    hints: nonNegativeInteger(record.hints) ?? DEFAULT_SAVE.hints,
    coins: nonNegativeInteger(record.coins) ?? DEFAULT_SAVE.coins,
    settings: {
      soundEnabled: typeof record.settings?.soundEnabled === 'boolean' ? record.settings.soundEnabled : DEFAULT_SAVE.settings.soundEnabled,
    },
    lastDailyRewardDay: typeof record.lastDailyRewardDay === 'string' ? record.lastDailyRewardDay : '',
  };
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}
