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
      { index: 7, direction: 0 },
      { index: 12, direction: 1 },
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

  it('bomb removes the selected cell and adjacent active arrows', () => {
    const result = applyBomb(createBoard(level()), 7);

    expect(result.removed.sort((a, b) => a - b)).toEqual([6, 7, 12]);
  });

  it('magnet removes clearable arrows in the requested direction up to a cap', () => {
    const result = applyMagnet(createBoard(level()), 2, 3);

    expect(result.removed).toEqual([18, 22]);
  });
});
