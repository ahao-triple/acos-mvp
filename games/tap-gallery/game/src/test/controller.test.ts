import { describe, expect, it } from 'vitest';

import { GameController } from '../app/controller';
import { defaultSave } from '../app/save';
import type { LevelConfig } from '../assets/types';
import { createWebPlatformAdapter } from '../platform/web';

function levels(): LevelConfig[] {
  const base = {
    subject: 'test',
    maskImage: 'mask.png',
    revealImage: 'reveal.png',
    thumbnail: 'thumb.png',
    board: {
      width: 3,
      height: 3,
      allowPan: false,
      allowZoom: false,
      initialZoom: 1,
    },
    mechanics: [],
    idleHintDelayMs: 5000,
    guidance: {
      introCue: 'none',
      weakHintEnabled: true,
      revealFocus: true,
    },
    artStatus: 'test',
  };
  return [
    {
      ...base,
      id: 'level-1',
      levelNo: 1,
      title: 'One',
      moves: 2,
      cellsTarget: 1,
      cells: [{ index: 1, direction: 0 }],
    },
    {
      ...base,
      id: 'level-2',
      levelNo: 2,
      title: 'Two',
      moves: 2,
      cellsTarget: 1,
      cells: [{ index: 7, direction: 2 }],
    },
  ];
}

describe('game controller', () => {
  it('starts on level 1 and wins after clearing the board', () => {
    const controller = new GameController({
      levels: levels(),
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
    });

    expect(controller.getViewState().screen).toBe('playing');
    expect(controller.tapCell(1).type).toBe('win');
    expect(controller.getViewState().screen).toBe('win');
    expect(controller.getViewState().save.completedLevels).toEqual([1]);
  });

  it('keeps blocked taps as invalid feedback', () => {
    const [first] = levels();
    const controller = new GameController({
      levels: [
        {
          ...first,
          moves: 3,
          cellsTarget: 2,
          cells: [
            { index: 4, direction: 0 },
            { index: 1, direction: 0 },
          ],
        },
      ],
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
    });

    expect(controller.tapCell(4).type).toBe('invalid');
    expect(controller.getViewState().movesLeft).toBe(2);
  });

  it('continues to the next unlocked level after a win', () => {
    let now = 0;
    const controller = new GameController({
      levels: levels(),
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
      now: () => now,
    });

    controller.tapCell(1);
    now = 800;
    controller.tick();
    controller.continueAfterWin();

    expect(controller.getViewState().level.levelNo).toBe(2);
    expect(controller.getViewState().screen).toBe('playing');
  });

  it('does not apply a tool when inventory is empty', () => {
    const save = {
      ...defaultSave(),
      tools: {
        ...defaultSave().tools,
        hammer: 0,
      },
    };
    const controller = new GameController({
      levels: levels(),
      save,
      platform: createWebPlatformAdapter(),
    });

    controller.selectTool('hammer');

    expect(controller.tapCell(1).type).toBe('invalid');
    expect(controller.getViewState().board.cellsByIndex.get(1)?.cleared).toBe(false);
    expect(controller.getViewState().save.tools.hammer).toBe(0);
  });

  it('freeze starts a five second timer freeze and invalid taps still cost moves', () => {
    let now = 10_000;
    const [first] = levels();
    const controller = new GameController({
      levels: [
        {
          ...first,
          moves: 3,
          cellsTarget: 2,
          cells: [
            { index: 4, direction: 0 },
            { index: 1, direction: 0 },
          ],
        },
      ],
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
      now: () => now,
    });

    controller.selectTool('freeze');
    expect(controller.tapCell(4).type).toBe('tool');
    expect(controller.getViewState().timer.freezeRemainingMs).toBe(5000);

    now += 1000;
    expect(controller.tapCell(4).type).toBe('invalid');
    expect(controller.getViewState().movesLeft).toBe(2);
  });

  it('shows first tap guidance until the guided cell is cleared', () => {
    const [first] = levels();
    const controller = new GameController({
      levels: [
        {
          ...first,
          guidance: {
            ...first.guidance,
            introCue: 'tap',
            firstTapIndex: 1,
          },
        },
      ],
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
    });

    expect(controller.getViewState().guidance).toEqual({ type: 'firstTap', index: 1, label: '点击' });
    controller.tapCell(1);
    expect(controller.getViewState().guidance).toBeNull();
  });

  it('activates weak hint after the configured idle delay', () => {
    let now = 0;
    const [first] = levels();
    const controller = new GameController({
      levels: [
        {
          ...first,
          idleHintDelayMs: 5000,
          cellsTarget: 2,
          cells: [
            { index: 1, direction: 0 },
            { index: 7, direction: 2 },
          ],
        },
      ],
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
      now: () => now,
    });

    expect(controller.getViewState().weakHint.active).toBe(false);
    now = 5000;
    controller.tick();

    expect(controller.getViewState().weakHint).toEqual({ active: true, index: 1 });
  });

  it('keeps Continue hidden until the reveal has had time to land', () => {
    let now = 1000;
    const controller = new GameController({
      levels: levels(),
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
      now: () => now,
    });

    controller.tapCell(1);
    expect(controller.getViewState().reveal.canContinue).toBe(false);

    now = 1800;
    controller.tick();
    expect(controller.getViewState().reveal.canContinue).toBe(true);
  });

  it('attaches lightweight animation metadata to clear and invalid feedback', () => {
    const [first] = levels();
    const controller = new GameController({
      levels: [
        {
          ...first,
          moves: 3,
          cellsTarget: 2,
          cells: [
            { index: 4, direction: 0 },
            { index: 1, direction: 0 },
          ],
        },
      ],
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
    });

    expect(controller.tapCell(4).animation?.kind).toBe('shake');
    expect(controller.tapCell(1).animation?.kind).toBe('fly');
  });

  it('consumes energy when starting a normal unlocked level', () => {
    const save = {
      ...defaultSave(),
      highestUnlockedLevel: 2,
      energy: 5,
    };
    const controller = new GameController({
      levels: levels(),
      save,
      platform: createWebPlatformAdapter(),
    });

    expect(controller.startLevel(2).type).toBe('none');
    expect(controller.getViewState().save.energy).toBe(4);
  });

  it('blocks locked levels from the level list', () => {
    const controller = new GameController({
      levels: levels(),
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
    });

    controller.openLevelSelect();
    expect(controller.getViewState().screen).toBe('levels');
    expect(controller.getViewState().levelSelect[1]).toMatchObject({ levelNo: 2, unlocked: false });
    expect(controller.startLevel(2).type).toBe('invalid');
    expect(controller.getViewState().level.levelNo).toBe(1);
  });

  it('allows one rewarded extra-move continue per attempt', async () => {
    const platform = createWebPlatformAdapter();
    platform.showRewardedAd = async () => ({ status: 'success' });
    const [first] = levels();
    const controller = new GameController({
      levels: [
        {
          ...first,
          moves: 1,
          cellsTarget: 2,
          cells: [
            { index: 4, direction: 0 },
            { index: 1, direction: 2 },
          ],
        },
      ],
      save: defaultSave(),
      platform,
    });

    controller.tapCell(4);
    expect(controller.getViewState().screen).toBe('failed');
    expect((await controller.requestExtraMoves()).type).toBe('tool');
    expect(controller.getViewState().movesLeft).toBe(8);
    expect((await controller.requestExtraMoves()).type).toBe('invalid');
  });

  it('adds bonus moves when a golden cell is cleared', () => {
    const [first] = levels();
    const controller = new GameController({
      levels: [
        {
          ...first,
          moves: 3,
          cellsTarget: 2,
          cells: [
            { index: 1, direction: 0, kind: 'golden' },
            { index: 7, direction: 2 },
          ],
        },
      ],
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
    });

    controller.tapCell(1);

    expect(controller.getViewState().movesLeft).toBe(5);
  });

  it('fails timer levels when time expires and freeze pauses the countdown', () => {
    let now = 0;
    const [first] = levels();
    const controller = new GameController({
      levels: [
        {
          ...first,
          mechanics: ['timer'],
          moves: 10,
          cellsTarget: 1,
          cells: [{ index: 1, direction: 0, kind: 'timer' }],
        },
      ],
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
      now: () => now,
    });

    expect(controller.getViewState().timer.remainingMs).toBe(30_000);
    controller.selectTool('freeze');
    controller.tapCell(1);
    now = 31_000;
    controller.tick();
    expect(controller.getViewState().screen).toBe('playing');
    now = 36_000;
    controller.tick();
    expect(controller.getViewState().screen).toBe('failed');
  });
});
