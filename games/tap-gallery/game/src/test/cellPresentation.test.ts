import { describe, expect, it } from 'vitest';

import { clearCell, createBoard, revealCellDirection } from '../core/board';
import type { LevelConfig } from '../assets/types';
import { cellPresentation, formatTimerRemaining } from '../render/cellPresentation';

function level(cells: LevelConfig['cells']): LevelConfig {
  return {
    id: 'presentation-level',
    levelNo: 1,
    title: 'Presentation',
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
    mechanics: ['timer'],
    idleHintDelayMs: 5000,
    guidance: {
      introCue: 'none',
      weakHintEnabled: true,
      revealFocus: true,
    },
    cells,
    artStatus: 'test',
  };
}

describe('cell presentation', () => {
  it('masks unrevealed secret arrows until revealed', () => {
    const board = createBoard(level([{ index: 1, direction: 0, kind: 'secret' }]));
    const hidden = board.cellsByIndex.get(1)!;

    expect(cellPresentation(board, hidden)).toMatchObject({ arrowVisible: false, label: '?', locked: false });

    const revealedBoard = revealCellDirection(board, 1);
    const revealed = revealedBoard.cellsByIndex.get(1)!;
    expect(cellPresentation(revealedBoard, revealed)).toMatchObject({ arrowVisible: true, label: null });
  });

  it('marks locked cells until their threshold is met', () => {
    const board = createBoard(level([
      { index: 0, direction: 0 },
      { index: 3, direction: 3 },
      { index: 15, direction: 2, kind: 'locked', unlockGroup: 2 },
    ]));
    const locked = board.cellsByIndex.get(15)!;

    expect(cellPresentation(board, locked)).toMatchObject({ locked: true, label: 'LOCK' });

    const unlockedBoard = clearCell(clearCell(board, 0), 3);
    const unlocked = unlockedBoard.cellsByIndex.get(15)!;
    expect(cellPresentation(unlockedBoard, unlocked)).toMatchObject({ locked: false, arrowVisible: true });
  });

  it('adds readable badges for special scoring and timer cells', () => {
    const board = createBoard(level([
      { index: 1, direction: 0, kind: 'golden' },
      { index: 2, direction: 0, kind: 'timer' },
    ]));

    expect(cellPresentation(board, board.cellsByIndex.get(1)!)).toMatchObject({ badge: '+', tone: 'gold' });
    expect(cellPresentation(board, board.cellsByIndex.get(2)!)).toMatchObject({ badge: 'T', tone: 'timer' });
  });

  it('formats timer milliseconds for the HUD', () => {
    expect(formatTimerRemaining(null)).toBe(null);
    expect(formatTimerRemaining(30_000)).toBe('0:30');
    expect(formatTimerRemaining(1_000)).toBe('0:01');
    expect(formatTimerRemaining(0)).toBe('0:00');
  });
});
