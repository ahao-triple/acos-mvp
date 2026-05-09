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
            { index: 1, direction: 2 },
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
    const controller = new GameController({
      levels: levels(),
      save: defaultSave(),
      platform: createWebPlatformAdapter(),
    });

    controller.tapCell(1);
    controller.continueAfterWin();

    expect(controller.getViewState().level.levelNo).toBe(2);
    expect(controller.getViewState().screen).toBe('playing');
  });
});
