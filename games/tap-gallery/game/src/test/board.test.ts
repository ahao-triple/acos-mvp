import { describe, expect, it } from 'vitest';

import { canClearCell, clearCell, createBoard, findHintCell, getClearableCells, isBoardComplete, revealCellDirection } from '../core/board';
import type { LevelConfig } from '../assets/types';

function level(cells: LevelConfig['cells']): LevelConfig {
  return {
    id: 'test-level',
    levelNo: 1,
    title: 'Test',
    subject: 'test',
    maskImage: 'mask.png',
    revealImage: 'reveal.png',
    thumbnail: 'thumb.png',
    board: {
      width: 4,
      height: 4,
      allowPan: false,
      allowZoom: false,
      initialZoom: 1,
    },
    moves: 10,
    cellsTarget: cells.length,
    mechanics: [],
    idleHintDelayMs: 5000,
    guidance: {
      introCue: 'none',
      weakHintEnabled: true,
      revealFocus: true,
      firstTapIndex: cells[0]?.index,
    },
    cells,
    artStatus: 'test',
  };
}

describe('board rules', () => {
  it('allows an arrow when its path to the edge is clear', () => {
    const board = createBoard(level([{ index: 1, direction: 0 }]));

    expect(canClearCell(board, 1)).toBe(true);
  });

  it('blocks an arrow when another active cell sits in its path', () => {
    const board = createBoard(level([
      { index: 5, direction: 0 },
      { index: 1, direction: 0 },
    ]));

    expect(canClearCell(board, 5)).toBe(false);
  });

  it('clears a cell immutably and then exposes blocked arrows', () => {
    const board = createBoard(level([
      { index: 5, direction: 0 },
      { index: 1, direction: 0 },
    ]));
    const next = clearCell(board, 1);

    expect(canClearCell(board, 5)).toBe(false);
    expect(canClearCell(next, 5)).toBe(true);
    expect(next.cellsByIndex.get(1)?.cleared).toBe(true);
  });

  it('reports completion after all active cells are cleared', () => {
    const board = createBoard(level([{ index: 1, direction: 0 }]));

    expect(isBoardComplete(board)).toBe(false);
    expect(isBoardComplete(clearCell(board, 1))).toBe(true);
  });

  it('returns clearable cells and a stable hint', () => {
    const board = createBoard(level([
      { index: 5, direction: 0 },
      { index: 1, direction: 0 },
      { index: 15, direction: 2 },
    ]));

    expect(getClearableCells(board).map((cell) => cell.index)).toEqual([1, 15]);
    expect(findHintCell(board)?.index).toBe(1);
  });

  it('keeps locked cells unavailable until their group threshold is cleared', () => {
    const board = createBoard(level([
      { index: 0, direction: 0 },
      { index: 3, direction: 3 },
      { index: 15, direction: 2, kind: 'locked', unlockGroup: 2 },
    ]));

    expect(canClearCell(board, 15)).toBe(false);
    expect(canClearCell(clearCell(board, 0), 15)).toBe(false);
    expect(canClearCell(clearCell(clearCell(board, 0), 3), 15)).toBe(true);
  });

  it('hides secret arrows until their direction is revealed', () => {
    const board = createBoard(level([{ index: 1, direction: 0, kind: 'secret' }]));

    expect(board.cellsByIndex.get(1)?.revealed).toBe(false);
    expect(revealCellDirection(board, 1).cellsByIndex.get(1)?.revealed).toBe(true);
  });
});
