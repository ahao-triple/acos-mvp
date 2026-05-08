import { describe, expect, test, vi } from 'vitest';
import { GameController } from '../app/controller';
import { createDefaultSave, SAVE_KEY, type SaveData, type StorageLike } from '../app/save';
import { levels } from '../config/levels';
import type { GameSession } from '../core/types';
import type { PlatformAdapter } from '../platform/types';

describe('game controller visual cues', () => {
  test('emits select audio cue when a cell is selected', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'tapCell', position: { row: 0, col: 0 } });

    expect(controller.getViewState().audioCue).toMatchObject({ type: 'select' });
  });

  test('emits swapRejected cue for non-adjacent cell selection', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'tapCell', position: { row: 0, col: 0 } });
    await controller.dispatch({ type: 'tapCell', position: { row: 1, col: 1 } });

    expect(controller.getViewState().visualCue).toMatchObject({
      type: 'swapRejected',
      from: { row: 0, col: 0 },
      to: { row: 1, col: 1 },
    });
    expect(controller.getViewState().audioCue).toMatchObject({ type: 'invalid' });
  });

  test('emits button audio cue for normal command buttons', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'openSettings' });

    expect(controller.getViewState().audioCue).toMatchObject({ type: 'button' });
  });

  test('emits reward audio cue when a platform reward is granted', async () => {
    const controller = new GameController(mockPlatform({ desktop: { status: 'success' } }));

    await controller.dispatch({ type: 'desktopReward' });

    expect(controller.getViewState().audioCue).toMatchObject({ type: 'reward' });
  });

  test('in-game ad power-up activates after completed rewarded video', async () => {
    const controller = new GameController(mockPlatform({ ad: { status: 'success' } }));

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'usePowerUp', item: 'bomb' });

    expect(controller.getViewState().activePowerUp).toBe('bomb');
    expect(controller.getViewState().feedback).toContain('广告');
    expect(controller.getViewState().audioCue).toMatchObject({ type: 'reward' });
  });

  test('logs in-game rewarded power-up flow for device debugging', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const controller = new GameController(mockPlatform({ ad: { status: 'success' } }));

    try {
      await controller.dispatch({ type: 'start' });
      await controller.dispatch({ type: 'usePowerUp', item: 'bomb' });

      const events = info.mock.calls.map((call) => call[1]);
      expect(events).toEqual(expect.arrayContaining(['power_up_ad_request', 'power_up_activate']));
      expect(info).toHaveBeenCalledWith('[GLFX]', 'power_up_ad_request', expect.objectContaining({ item: 'bomb', available: 0 }));
      expect(info).toHaveBeenCalledWith('[GLFX]', 'power_up_activate', expect.objectContaining({ item: 'bomb', fromAd: true }));
    } finally {
      info.mockRestore();
    }
  });

  test('pause menu can return to the home screen', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'pause' });
    await controller.dispatch({ type: 'home' });

    expect(controller.getViewState().screen).toBe('menu');
    expect(controller.getViewState().session).toBeNull();
  });
});

describe('game controller campaign progress', () => {
  test('persists completed level count and unlocks next level when level one is won', () => {
    const storage = new MemoryStorage();
    const controller = new GameController(mockPlatform({ storage }));

    completeLevel(controller, 1);

    const save = controller.getViewState().save;
    const storedSave = readStoredSave(storage);
    expect(save.completedLevelCount).toBe(1);
    expect(save.highestUnlockedLevel).toBe(2);
    expect(save.coins).toBe(levels[0].rewards.coins);
    expect(storedSave.completedLevelCount).toBe(1);
    expect(storedSave.highestUnlockedLevel).toBe(2);
  });

  test('persists completed level thirty from an old repaired save without completed count', () => {
    const oldSave = createDefaultSave();
    const { completedLevelCount: _completedLevelCount, ...legacySave } = {
      ...oldSave,
      highestUnlockedLevel: 30,
      coins: 200,
    };
    const storage = new MemoryStorage({ [SAVE_KEY]: JSON.stringify(legacySave) });
    const controller = new GameController(mockPlatform({ storage }));

    expect(controller.getViewState().save.completedLevelCount).toBe(29);

    completeLevel(controller, 30);

    const save = controller.getViewState().save;
    const storedSave = readStoredSave(storage);
    expect(save.completedLevelCount).toBe(30);
    expect(save.highestUnlockedLevel).toBe(30);
    expect(save.coins).toBe(200 + levels[29].rewards.coins);
    expect(storedSave.completedLevelCount).toBe(30);
    expect(storedSave.highestUnlockedLevel).toBe(30);
  });
});

function mockPlatform(
  options: {
    ad?: { status: 'success' | 'failed' | 'cancelled' | 'unsupported' };
    desktop?: { status: 'success' | 'failed' | 'cancelled' | 'unsupported' };
    storage?: StorageLike;
  } = {},
): PlatformAdapter {
  return {
    name: 'test',
    storage: options.storage ?? new MemoryStorage(),
    async showRewardedAd() {
      return options.ad ?? { status: 'unsupported' };
    },
    async addDesktopShortcut() {
      return options.desktop ?? { status: 'unsupported' };
    },
    async showFavoriteGuide() {
      return { status: 'unsupported' };
    },
    async didEnterFromSidebar() {
      return false;
    },
    async requestSidebarEntry() {
      return { status: 'unsupported' };
    },
    getLaunchContext() {
      return { isSidebarEntry: false };
    },
  };
}

function completeLevel(controller: GameController, levelId: number): void {
  (controller as unknown as { handleWin(session: GameSession): void }).handleWin(createWonSession(levelId));
}

function createWonSession(levelId: number): GameSession {
  const level = levels.find((candidate) => candidate.id === levelId) ?? levels[0];
  return {
    levelId,
    board: [],
    movesLeft: 0,
    targetProgress: {},
    targets: level.targets,
    selectedCell: null,
    comboCount: 0,
    status: 'won',
    lastEvents: [{ type: 'win' }],
    piecePool: level.piecePool,
  };
}

function readStoredSave(storage: MemoryStorage): SaveData {
  const raw = storage.getItem(SAVE_KEY);
  expect(raw).not.toBeNull();
  return JSON.parse(raw ?? '') as SaveData;
}

class MemoryStorage implements StorageLike {
  private readonly data = new Map<string, string>();

  constructor(initialData: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initialData)) {
      this.data.set(key, value);
    }
  }

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
