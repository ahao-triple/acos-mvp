export const SAVE_KEY = 'tap-gallery-save-v1';

export interface SaveToolInventory {
  hint: number;
  bomb: number;
  magnet: number;
  hammer: number;
  freeze: number;
}

export interface SaveSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export interface TapGallerySave {
  schemaVersion: 1;
  currentLevel: number;
  highestUnlockedLevel: number;
  completedLevels: number[];
  coins: number;
  energy: number;
  lastEnergyAtMs: number;
  tools: SaveToolInventory;
  settings: SaveSettings;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function defaultSave(): TapGallerySave {
  return {
    schemaVersion: 1,
    currentLevel: 1,
    highestUnlockedLevel: 1,
    completedLevels: [],
    coins: 120,
    energy: 5,
    lastEnergyAtMs: 0,
    tools: {
      hint: 3,
      bomb: 1,
      magnet: 1,
      hammer: 1,
      freeze: 1,
    },
    settings: {
      soundEnabled: true,
      musicEnabled: true,
    },
  };
}

export function loadSave(storage: StorageLike): TapGallerySave {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) {
    return defaultSave();
  }

  try {
    return sanitizeSave(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function writeSave(storage: StorageLike, save: TapGallerySave): void {
  storage.setItem(SAVE_KEY, JSON.stringify(sanitizeSave(save)));
}

export function markLevelComplete(save: TapGallerySave, levelNo: number, reward: { coins: number; tools?: Partial<SaveToolInventory> }): TapGallerySave {
  const completed = new Set(save.completedLevels);
  completed.add(levelNo);
  return sanitizeSave({
    ...save,
    currentLevel: Math.max(save.currentLevel, levelNo + 1),
    highestUnlockedLevel: Math.max(save.highestUnlockedLevel, levelNo + 1),
    completedLevels: [...completed].sort((a, b) => a - b),
    coins: save.coins + reward.coins,
    tools: addTools(save.tools, reward.tools ?? {}),
  });
}

export function recoverEnergy(save: TapGallerySave, nowMs: number, maxEnergy = 5): TapGallerySave {
  if (save.energy >= maxEnergy) {
    return {
      ...save,
      energy: maxEnergy,
      lastEnergyAtMs: nowMs,
    };
  }
  const elapsedMs = Math.max(0, nowMs - save.lastEnergyAtMs);
  const recovered = Math.floor(elapsedMs / 600_000);
  if (recovered <= 0) {
    return save;
  }
  const energy = Math.min(maxEnergy, save.energy + recovered);
  return {
    ...save,
    energy,
    lastEnergyAtMs: energy >= maxEnergy ? nowMs : save.lastEnergyAtMs + recovered * 600_000,
  };
}

export function consumeEnergy(save: TapGallerySave): TapGallerySave | null {
  if (save.energy <= 0) {
    return null;
  }
  return {
    ...save,
    energy: save.energy - 1,
  };
}

export function spendTool(save: TapGallerySave, tool: keyof SaveToolInventory): TapGallerySave {
  if (save.tools[tool] <= 0) {
    return save;
  }
  return {
    ...save,
    tools: {
      ...save.tools,
      [tool]: save.tools[tool] - 1,
    },
  };
}

export function canSpendTool(save: TapGallerySave, tool: keyof SaveToolInventory): boolean {
  return save.tools[tool] > 0;
}

export function addTools(base: SaveToolInventory, delta: Partial<SaveToolInventory>): SaveToolInventory {
  return {
    hint: base.hint + (delta.hint ?? 0),
    bomb: base.bomb + (delta.bomb ?? 0),
    magnet: base.magnet + (delta.magnet ?? 0),
    hammer: base.hammer + (delta.hammer ?? 0),
    freeze: base.freeze + (delta.freeze ?? 0),
  };
}

function sanitizeSave(value: unknown): TapGallerySave {
  if (!isRecord(value)) {
    return defaultSave();
  }
  const base = defaultSave();
  const tools = isRecord(value.tools) ? value.tools : {};
  const settings = isRecord(value.settings) ? value.settings : {};
  const completedLevels = Array.isArray(value.completedLevels)
    ? value.completedLevels.filter((item): item is number => Number.isInteger(item) && item > 0)
    : base.completedLevels;

  return {
    schemaVersion: 1,
    currentLevel: readPositiveInteger(value.currentLevel) ?? base.currentLevel,
    highestUnlockedLevel: readPositiveInteger(value.highestUnlockedLevel) ?? base.highestUnlockedLevel,
    completedLevels: [...new Set(completedLevels)].sort((a, b) => a - b),
    coins: readNonNegativeInteger(value.coins) ?? base.coins,
    energy: readNonNegativeInteger(value.energy) ?? base.energy,
    lastEnergyAtMs: readNonNegativeInteger(value.lastEnergyAtMs) ?? base.lastEnergyAtMs,
    tools: {
      hint: readNonNegativeInteger(tools.hint) ?? base.tools.hint,
      bomb: readNonNegativeInteger(tools.bomb) ?? base.tools.bomb,
      magnet: readNonNegativeInteger(tools.magnet) ?? base.tools.magnet,
      hammer: readNonNegativeInteger(tools.hammer) ?? base.tools.hammer,
      freeze: readNonNegativeInteger(tools.freeze) ?? base.tools.freeze,
    },
    settings: {
      soundEnabled: typeof settings.soundEnabled === 'boolean' ? settings.soundEnabled : base.settings.soundEnabled,
      musicEnabled: typeof settings.musicEnabled === 'boolean' ? settings.musicEnabled : base.settings.musicEnabled,
    },
  };
}

function readPositiveInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
