import { describe, expect, test, vi } from 'vitest';
import { GameController } from '../app/controller';
import { createDefaultSave, SAVE_KEY, type SaveData, type StorageLike } from '../app/save';
import { levels } from '../config/levels';
import type { Board, GameSession } from '../core/types';
import type { PlatformAdapter } from '../platform/types';

describe('game controller visual cues', () => {
  test('emits select audio cue when a cell is selected', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'beginLevel' });
    await controller.dispatch({ type: 'tapCell', position: { row: 0, col: 0 } });

    expect(controller.getViewState().audioCue).toMatchObject({ type: 'select' });
  });

  test('emits swapRejected cue for non-adjacent cell selection', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'beginLevel' });
    await controller.dispatch({ type: 'tapCell', position: { row: 0, col: 0 } });
    await controller.dispatch({ type: 'tapCell', position: { row: 1, col: 1 } });

    expect(controller.getViewState().visualCue).toMatchObject({
      type: 'swapRejected',
      from: { row: 0, col: 0 },
      to: { row: 1, col: 1 },
    });
    expect(controller.getViewState().feedback).toBe('只能交换相邻格子。');
    expect(controller.getViewState().feedback).not.toContain('Cells');
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

  test('defers settled clear audio to board presentation timing', async () => {
    const controller = new GameController(mockPlatform());
    forcePrivatePlayingSession(controller, {
      ...sessionWithBoard([
        row(['shield', 'ammo', 'shield']),
        row(['shield', 'ammo', 'radar']),
        row(['ammo', 'shield', 'wrench']),
      ]),
      selectedCell: { row: 2, col: 0 },
    });

    await controller.dispatch({ type: 'tapCell', position: { row: 2, col: 1 } });

    expect(controller.getViewState().session?.lastEvents.some((event) => event.type === 'clear')).toBe(true);
    expect(controller.getViewState().audioCue).toBeNull();
  });

  test('in-game ad power-up directly shows rewarded video when out of stock and coins', async () => {
    let adCalls = 0;
    const platform = mockPlatform({ ad: { status: 'success' } });
    platform.showRewardedAd = async () => {
      adCalls += 1;
      return { status: 'success' };
    };
    const controller = new GameController(platform);

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'beginLevel' });
    await controller.dispatch({ type: 'usePowerUp', item: 'bomb' });

    expect(adCalls).toBe(1);
    expect(controller.getViewState().activePowerUp).toBe('bomb');
    expect(controller.getViewState().feedback).toContain('广告');
    expect(controller.getViewState().audioCue).toMatchObject({ type: 'reward' });
  });

  test('remote config triggers level-start rewarded ad directly', async () => {
    let adCalls = 0;
    const platform = mockPlatform({ ad: { status: 'success' } });
    platform.showRewardedAd = async () => {
      adCalls += 1;
      return { status: 'success' };
    };
    const controller = new GameController(platform, {
      remoteConfig: {
        adPolicy: {
          enabled: true,
          trigger: 'level_start',
          minLevel: 1,
          cooldownSeconds: 0,
          maxPerSession: 1,
          request: { type: 'extraMovesAd' },
        },
      },
    });

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'beginLevel' });

    expect(adCalls).toBe(1);
  });

  test('in-game power-up purchase spends coins before falling back to ads', async () => {
    let adCalls = 0;
    const platform = mockPlatform({
      storedSave: {
        ...createDefaultSave(),
        coins: 120,
      },
    });
    platform.showRewardedAd = async () => {
      adCalls += 1;
      return { status: 'success' };
    };
    const controller = new GameController(platform);

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'beginLevel' });
    await controller.dispatch({ type: 'usePowerUp', item: 'bomb' });

    expect(adCalls).toBe(0);
    expect(controller.getViewState().save.coins).toBe(0);
    expect(controller.getViewState().save.items.bomb).toBe(1);
    expect(controller.getViewState().activePowerUp).toBe('bomb');
  });

  test('in-game power-up directly shows ad when coins are insufficient', async () => {
    let adCalls = 0;
    const platform = mockPlatform({
      storedSave: {
        ...createDefaultSave(),
        coins: 119,
      },
    });
    platform.showRewardedAd = async () => {
      adCalls += 1;
      return { status: 'success' };
    };
    const controller = new GameController(platform);

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'beginLevel' });
    await controller.dispatch({ type: 'usePowerUp', item: 'bomb' });

    expect(adCalls).toBe(1);
    expect(controller.getViewState().save.coins).toBe(119);
    expect(controller.getViewState().activePowerUp).toBe('bomb');
  });

  test('logs in-game rewarded power-up flow for device debugging', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const controller = new GameController(mockPlatform({ ad: { status: 'success' } }));

    try {
      await controller.dispatch({ type: 'start' });
      await controller.dispatch({ type: 'beginLevel' });
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
    await controller.dispatch({ type: 'beginLevel' });
    await controller.dispatch({ type: 'pause' });
    await controller.dispatch({ type: 'home' });

    expect(controller.getViewState().screen).toBe('menu');
    expect(controller.getViewState().session).toBeNull();
  });
});

describe('game controller briefing flow', () => {
  test('openSupplies opens the supplies screen', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'openSupplies' });

    expect(controller.getViewState().screen).toBe('supplies');
  });

  test('start opens a briefing for the highest unlocked level before play', async () => {
    const controller = new GameController(mockPlatform({
      storedSave: {
        version: 1,
        highestUnlockedLevel: 12,
        coins: 0,
        items: { extraMoves: 0, bomb: 0, suck: 0, shuffle: 0 },
        desktopRewardClaimed: false,
        favoriteRewardClaimed: false,
        sidebarRewardClaimed: false,
        soundEnabled: true,
        musicEnabled: true,
      },
    }));

    await controller.dispatch({ type: 'start' });

    expect(controller.getViewState().screen).toBe('briefing');
    expect(controller.getViewState().pendingLevel?.id).toBe(12);
    expect(controller.getViewState().pendingLevel?.chapterTitle).toBe('阵地修复');

    await controller.dispatch({ type: 'beginLevel' });

    expect(controller.getViewState().screen).toBe('playing');
    expect(controller.getViewState().session?.levelId).toBe(12);
  });

  test('unlocked level selection opens briefing for the selected level', async () => {
    const controller = new GameController(mockPlatform({
      storedSave: {
        ...createDefaultSave(),
        highestUnlockedLevel: 4,
        completedLevelCount: 3,
      },
    }));

    await controller.dispatch({ type: 'openLevels' });
    await controller.dispatch({ type: 'selectLevel', levelId: 3 });

    expect(controller.getViewState().screen).toBe('briefing');
    expect(controller.getViewState().pendingLevel?.id).toBe(3);
  });

  test('locked level selection stays on levels screen with feedback', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'openLevels' });
    await controller.dispatch({ type: 'selectLevel', levelId: 5 });

    expect(controller.getViewState().screen).toBe('levels');
    expect(controller.getViewState().feedback).toContain('尚未解锁');
    expect(controller.getViewState().pendingLevel).toBeNull();
  });

  test('retry from a played level returns to briefing for the same level', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'beginLevel' });
    await controller.dispatch({ type: 'retry' });

    expect(controller.getViewState().screen).toBe('briefing');
    expect(controller.getViewState().pendingLevel?.id).toBe(1);
    expect(controller.getViewState().session).toBeNull();
  });

  test('nextLevel from a won current session opens briefing for the next level', async () => {
    const controller = new GameController(mockPlatform({
      storedSave: {
        ...createDefaultSave(),
        highestUnlockedLevel: 2,
        completedLevelCount: 1,
      },
    }));

    await controller.dispatch({ type: 'selectLevel', levelId: 2 });
    await controller.dispatch({ type: 'beginLevel' });
    completeLevel(controller, 2);
    await controller.dispatch({ type: 'nextLevel' });

    expect(controller.getViewState().screen).toBe('briefing');
    expect(controller.getViewState().pendingLevel?.id).toBe(3);
    expect(controller.getViewState().session).toBeNull();
  });

  test('view state exposes chapter progress for rendering', () => {
    const controller = new GameController(mockPlatform());
    const progress = controller.getViewState().chapterProgress;

    expect(progress).toBeDefined();
    expect(progress.map((chapter) => chapter.title)).toEqual([
      '前线集结',
      '阵地修复',
      '最终防线',
    ]);
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

  test('chapter finale grants node reward when won', () => {
    const controller = new GameController(mockPlatform());

    completeLevel(controller, 10);

    expect(controller.getViewState().screen).toBe('won');
    expect(controller.getViewState().save.items.bomb).toBe(1);
    expect(controller.getViewState().winSummary).toMatchObject({
      levelId: 10,
      chapterTitle: '前线集结',
      baseCoins: levels[9].rewards.coins,
      nodeReward: { bomb: 1 },
      nextLevelId: 11,
      doubled: false,
    });
  });

  test('double win reward can only be claimed once', async () => {
    const controller = new GameController(mockPlatform({ ad: { status: 'success' } }));

    forcePrivateWinSummary(controller, {
      levelId: 1,
      chapterTitle: '前线集结',
      baseCoins: 70,
      nodeReward: null,
      nextLevelId: 2,
      doubled: false,
    });
    await controller.dispatch({ type: 'doubleWinReward' });
    const afterFirst = controller.getViewState().save.coins;
    await controller.dispatch({ type: 'doubleWinReward' });

    expect(afterFirst).toBe(70);
    expect(controller.getViewState().save.coins).toBe(afterFirst);
    expect(controller.getViewState().feedback).toContain('已领取');
    expect(controller.getViewState().winSummary?.doubled).toBe(true);
  });

  test('double win reward triggers rewarded video directly on request', async () => {
    let adCalls = 0;
    const platform = mockPlatform({ ad: { status: 'success' } });
    platform.showRewardedAd = async () => {
      adCalls += 1;
      return { status: 'success' };
    };
    const controller = new GameController(platform);

    forcePrivateWinSummary(controller, {
      levelId: 1,
      chapterTitle: '前线集结',
      baseCoins: 70,
      nodeReward: null,
      nextLevelId: 2,
      doubled: false,
    });

    await controller.dispatch({ type: 'requestRewardedAd', request: { type: 'doubleWinReward' } });

    expect(adCalls).toBe(1);
    expect(controller.getViewState().winSummary?.doubled).toBe(true);
  });

  test('concurrent double win reward dispatches only grant once', async () => {
    let resolveAd: (value: { status: 'success' }) => void = () => undefined;
    let adCalls = 0;
    const adResult = new Promise<{ status: 'success' }>((resolve) => {
      resolveAd = resolve;
    });
    const platform = mockPlatform();
    platform.showRewardedAd = async () => {
      adCalls += 1;
      return adResult;
    };
    const controller = new GameController(platform);

    forcePrivateWinSummary(controller, {
      levelId: 1,
      chapterTitle: '前线集结',
      baseCoins: 70,
      nodeReward: null,
      nextLevelId: 2,
      doubled: false,
    });
    const first = controller.dispatch({ type: 'doubleWinReward' });
    const second = controller.dispatch({ type: 'doubleWinReward' });

    resolveAd({ status: 'success' });
    await Promise.all([first, second]);

    expect(adCalls).toBe(1);
    expect(controller.getViewState().save.coins).toBe(70);
    expect(controller.getViewState().winSummary?.doubled).toBe(true);
  });

  test('cancelled double win reward does not mark reward doubled', async () => {
    const controller = new GameController(mockPlatform({ ad: { status: 'cancelled' } }));

    forcePrivateWinSummary(controller, {
      levelId: 1,
      chapterTitle: '前线集结',
      baseCoins: 70,
      nodeReward: null,
      nextLevelId: 2,
      doubled: false,
    });
    await controller.dispatch({ type: 'doubleWinReward' });

    expect(controller.getViewState().save.coins).toBe(0);
    expect(controller.getViewState().feedback).toContain('未完整观看');
    expect(controller.getViewState().winSummary?.doubled).toBe(false);
  });
});

function mockPlatform(
  options: {
    ad?: { status: 'success' | 'failed' | 'cancelled' | 'unsupported' };
    desktop?: { status: 'success' | 'failed' | 'cancelled' | 'unsupported' };
    storage?: StorageLike;
    storedSave?: unknown;
  } = {},
): PlatformAdapter {
  const storage = options.storage ?? new MemoryStorage(
    options.storedSave ? { [SAVE_KEY]: JSON.stringify(options.storedSave) } : {},
  );

  return {
    name: 'test',
    storage,
    async login() {
      return { platform: 'test', code: 'test-code' };
    },
    async request() {
      return { status: 200, data: null };
    },
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
    triggerHaptic() {},
  };
}

function completeLevel(controller: GameController, levelId: number): void {
  (controller as unknown as { handleWin(session: GameSession): void }).handleWin(createWonSession(levelId));
}

function forcePrivateWinSummary(controller: GameController, summary: unknown): void {
  (controller as unknown as { winSummary: unknown; screen: string }).winSummary = summary;
  (controller as unknown as { screen: string }).screen = 'won';
}

function forcePrivatePlayingSession(controller: GameController, session: GameSession): void {
  (controller as unknown as { session: GameSession; screen: string }).session = session;
  (controller as unknown as { screen: string }).screen = 'playing';
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

function sessionWithBoard(board: Board): GameSession {
  return {
    levelId: 99,
    board,
    movesLeft: 3,
    targetProgress: {},
    targets: [{ type: 'collect', kind: 'shield', count: 50 }],
    selectedCell: null,
    comboCount: 0,
    status: 'playing',
    lastEvents: [],
    piecePool: ['shield', 'ammo', 'radar', 'medal', 'wrench'],
  };
}

function row(kinds: Array<'shield' | 'ammo' | 'radar' | 'medal' | 'wrench'>): Board[number] {
  return kinds.map((pieceKind, col) => ({ kind: 'normal' as const, pieceKind, id: `${pieceKind}-${col}` }));
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
