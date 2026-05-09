import { describe, expect, it } from 'vitest';

import { createBoard } from '../core/board';
import { applyBomb, applyHammer, applyMagnet } from '../core/tools';
import type { LevelConfig } from '../assets/types';

function level(): LevelConfig {
  return {
    id: 'tool-level',
    levelNo: 3,
    title: 'Tools',
    subject: 'tools',
    maskImage: 'mask.png',
    revealImage: 'reveal.png',
    thumbnail: 'thumb.png',
    board: {
      width: 5,
      height: 5,
      allowPan: false,
      allowZoom: false,
      initialZoom: 1,
    },
    moves: 10,
    cellsTarget: 5,
    mechanics: [],
    idleHintDelayMs: 5000,
    guidance: {
      introCue: 'none',
      weakHintEnabled: true,
      revealFocus: true,
    },
    cells: [
      { index: 6, direction: 0 },
      { index: 7, direction: 3 },
      { index: 12, direction: 0 },
      { index: 18, direction: 2 },
      { index: 22, direction: 2 },
    ],
    artStatus: 'test',
  };
}

describe('tool effects', () => {
  it('hammer removes one selected arrow even when blocked', () => {
    const result = applyHammer(createBoard(level()), 7);

    expect(result.removed).toEqual([7]);
    expect(result.board.cellsByIndex.get(7)?.cleared).toBe(true);
  });

  it('bomb removes only currently clearable arrows within radius one', () => {
    const result = applyBomb(createBoard(level()), 7);

    expect(result.removed).toEqual([6]);
  });

  it('magnet removes a contiguous line from the selected arrow direction', () => {
    const result = applyMagnet(createBoard({
      ...level(),
      board: {
        width: 5,
        height: 5,
        allowPan: false,
        allowZoom: false,
        initialZoom: 1,
      },
      cells: [
        { index: 5, direction: 1 },
        { index: 6, direction: 1 },
        { index: 7, direction: 1 },
        { index: 9, direction: 1 },
        { index: 15, direction: 2 },
      ],
    }), 5, 8);

    expect(result.removed).toEqual([5, 6, 7]);
  });
});
