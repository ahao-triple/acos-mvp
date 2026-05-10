import { describe, expect, test } from 'vitest';

import { completeLevel, loadSave, type StorageLike } from '../app/save';

describe('difference hunt save compatibility', () => {
  test('loads old saves with missing optional fields', () => {
    const storage = memoryStorage(JSON.stringify({
      highestUnlockedLevel: 5,
      completedLevels: [1, 2, 3, 4],
      currentLevel: 5,
    }));

    const save = loadSave(storage);

    expect(save.highestUnlockedLevel).toBe(5);
    expect(save.currentLevel).toBe(5);
    expect(save.hints).toBe(0);
    expect(save.coins).toBe(0);
    expect(save.settings.soundEnabled).toBe(true);
    expect(save.lastDailyRewardDay).toBe('');
  });

  test('falls back to defaults when stored data is corrupt', () => {
    const save = loadSave(memoryStorage('{bad json'));

    expect(save.highestUnlockedLevel).toBe(1);
    expect(save.currentLevel).toBe(1);
    expect(save.completedLevels).toEqual([]);
  });

  test('completing the sixth level unlocks the seventh level', () => {
    const next = completeLevel({
      highestUnlockedLevel: 6,
      completedLevels: [1, 2, 3, 4, 5],
      currentLevel: 6,
      hints: 0,
      coins: 0,
      settings: { soundEnabled: true },
      lastDailyRewardDay: '',
    }, 6, 7);

    expect(next.highestUnlockedLevel).toBe(7);
    expect(next.currentLevel).toBe(7);
    expect(next.completedLevels).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

function memoryStorage(value: string | null): StorageLike {
  return {
    getItem() {
      return value;
    },
    setItem() {},
    removeItem() {},
  };
}
