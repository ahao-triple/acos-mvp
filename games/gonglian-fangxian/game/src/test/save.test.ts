import { describe, expect, test } from 'vitest';
import { createDefaultSave, loadSave, repairSaveData, writeSave } from '../app/save';

describe('save data', () => {
  test('creates default save data with all MVP fields', () => {
    const save = createDefaultSave();

    expect(save.version).toBe(1);
    expect(save.highestUnlockedLevel).toBe(1);
    expect(save.coins).toBe(0);
    expect(save.items.extraMoves).toBe(0);
    expect(save.items.bomb).toBe(0);
    expect(save.items.suck).toBe(0);
    expect(save.items.shuffle).toBe(0);
    expect(save.desktopRewardClaimed).toBe(false);
    expect(save.favoriteRewardClaimed).toBe(false);
    expect(save.sidebarRewardClaimed).toBe(false);
    expect(save.soundEnabled).toBe(true);
    expect(save.musicEnabled).toBe(true);
  });

  test('repairs malformed save data without blocking startup', () => {
    const save = repairSaveData({
      version: 1,
      highestUnlockedLevel: 4,
      coins: 'bad',
      items: { bomb: 2, suck: 1, shuffle: 3 },
      desktopRewardClaimed: true,
    });

    expect(save.highestUnlockedLevel).toBe(4);
    expect(save.coins).toBe(0);
    expect(save.items.extraMoves).toBe(0);
    expect(save.items.bomb).toBe(2);
    expect(save.items.suck).toBe(1);
    expect(save.items.shuffle).toBe(3);
    expect(save.desktopRewardClaimed).toBe(true);
    expect(save.favoriteRewardClaimed).toBe(false);
  });

  test('repairs highest unlocked level up to campaign level count', () => {
    const save = repairSaveData({
      highestUnlockedLevel: 30,
    });

    expect(save.highestUnlockedLevel).toBe(30);
  });

  test('loads and writes save data through storage', () => {
    const storage = new MemoryStorage();
    const save = createDefaultSave();
    save.highestUnlockedLevel = 5;
    save.coins = 120;
    save.items.extraMoves = 1;
    save.soundEnabled = false;

    writeSave(storage, save);

    expect(loadSave(storage)).toEqual(save);
  });

  test('returns repaired defaults when stored JSON is invalid', () => {
    const storage = new MemoryStorage();
    storage.setItem('gonglian-fangxian-save', '{bad json');

    const save = loadSave(storage);

    expect(save.highestUnlockedLevel).toBe(1);
    expect(save.coins).toBe(0);
  });
});

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}
