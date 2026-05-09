import type { SaveToolInventory } from './save';

export interface LevelReward {
  coins: number;
  tools: Partial<SaveToolInventory>;
}

export function rewardForLevel(levelNo: number): LevelReward {
  const tools: Partial<SaveToolInventory> = {};
  if (levelNo % 4 === 0) {
    tools.hint = 1;
  }
  if (levelNo % 10 === 0) {
    tools.bomb = 1;
  }
  if (levelNo % 15 === 0) {
    tools.magnet = 1;
  }
  if (levelNo % 20 === 0) {
    tools.hammer = 1;
  }
  if (levelNo % 25 === 0) {
    tools.freeze = 1;
  }

  return {
    coins: 20 + levelNo * 5,
    tools,
  };
}
