import { describe, expect, it } from 'vitest';

import { defaultSave, loadSave, markLevelComplete, recoverEnergy, writeSave } from '../app/save';

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('save state', () => {
  it('loads defaults from empty storage', () => {
    expect(loadSave(new MemoryStorage())).toEqual(defaultSave());
  });

  it('falls back to defaults for corrupt JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem('tap-gallery-save-v1', '{bad');

    expect(loadSave(storage)).toEqual(defaultSave());
  });

  it('persists completion and unlocks the next level', () => {
    const save = markLevelComplete(defaultSave(), 2, { coins: 40, tools: { hint: 1 } });
    const storage = new MemoryStorage();
    writeSave(storage, save);

    expect(loadSave(storage).completedLevels).toEqual([2]);
    expect(loadSave(storage).highestUnlockedLevel).toBe(3);
    expect(loadSave(storage).coins).toBe(defaultSave().coins + 40);
    expect(loadSave(storage).tools.hint).toBe(defaultSave().tools.hint + 1);
  });

  it('recovers one energy every ten minutes up to the cap', () => {
    const save = {
      ...defaultSave(),
      energy: 2,
      lastEnergyAtMs: 0,
    };

    expect(recoverEnergy(save, 21 * 60 * 1000).energy).toBe(4);
    expect(recoverEnergy({ ...save, energy: 5 }, 21 * 60 * 1000).energy).toBe(5);
  });
});
