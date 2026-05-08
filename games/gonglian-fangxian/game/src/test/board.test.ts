import { describe, expect, test } from 'vitest';
import {
  analyseMatches,
  applyGravity,
  damageAdjacentBlockers,
  areAdjacent,
  createSpecialForMatch,
  createBoard,
  findMatches,
  hasValidMoves,
  refillBoard,
  swapCells,
} from '../core/board';
import type { Board, PieceKind } from '../core/types';

describe('board rules', () => {
  test('creates a 7x7 board without initial matches', () => {
    const board = createBoard(['shield', 'ammo', 'radar', 'medal', 'wrench'], 7, 7, 123);

    expect(board).toHaveLength(7);
    expect(board[0]).toHaveLength(7);
    expect(findMatches(board)).toHaveLength(0);
    expect(hasValidMoves(board)).toBe(true);
  });

  test('detects horizontal and vertical matches of three or more', () => {
    const board: Board = [
      row(['shield', 'shield', 'shield', 'ammo', 'radar']),
      row(['ammo', 'radar', 'wrench', 'medal', 'radar']),
      row(['ammo', 'medal', 'wrench', 'medal', 'radar']),
      row(['ammo', 'shield', 'radar', 'wrench', 'radar']),
      row(['wrench', 'shield', 'radar', 'wrench', 'medal']),
    ];

    const matches = findMatches(board);

    expect(matches.some((match) => match.cells.length === 3 && match.kind === 'shield')).toBe(true);
    expect(matches.some((match) => match.cells.length === 3 && match.kind === 'ammo')).toBe(true);
    expect(matches.some((match) => match.cells.length === 4 && match.kind === 'radar')).toBe(true);
  });

  test('detects connected L-shaped matches from diss rules', () => {
    const board: Board = [
      row(['shield', 'shield', 'ammo']),
      row(['shield', 'radar', 'wrench']),
      row(['ammo', 'medal', 'radar']),
    ];

    const matches = findMatches(board);
    const analysis = analyseMatches(matches);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ kind: 'shield', direction: 'both', length: 2 });
    expect(matches[0].cells).toHaveLength(3);
    expect(analysis.shape).toBe('L-shape');
    expect(analysis.shapeBonus).toBe(1.8);
  });

  test('swaps only adjacent cells', () => {
    const board = createBoard(['shield', 'ammo', 'radar', 'medal', 'wrench'], 3, 3, 9);

    expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    expect(areAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 })).toBe(false);
    expect(() => swapCells(board, { row: 0, col: 0 }, { row: 1, col: 1 })).toThrow('Cells must be adjacent');
  });

  test('gravity drops pieces and refill fills empty cells', () => {
    const board: Board = [
      [empty(), piece('shield'), empty()],
      [piece('ammo'), empty(), piece('radar')],
      [piece('wrench'), piece('medal'), empty()],
    ];

    const dropped = applyGravity(board);

    expect(dropped[2][0].kind).toBe('normal');
    expect(dropped[2][1].kind).toBe('normal');
    expect(dropped[2][2].kind).toBe('normal');

    const refilled = refillBoard(dropped, ['shield', 'ammo', 'radar'], 77);

    expect(refilled.flat().every((cell) => cell.kind !== 'empty')).toBe(true);
  });

  test('damages blockers adjacent to cleared cells', () => {
    const board: Board = [
      [blocker('sandbag'), piece('shield'), piece('ammo')],
      [piece('shield'), piece('shield'), piece('shield')],
      [piece('radar'), piece('ammo'), blocker('brokenDefense')],
    ];

    const result = damageAdjacentBlockers(board, [
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ]);

    expect(result.clearedBlockers.sandbag).toBe(1);
    expect(result.clearedBlockers.brokenDefense).toBe(1);
    expect(result.board[0][0].kind).toBe('empty');
    expect(result.board[2][2].kind).toBe('empty');
  });

  test('does not create unfinished special pieces from long matches', () => {
    const horizontal = createSpecialForMatch({
      kind: 'shield',
      direction: 'h',
      length: 4,
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
      ],
    });
    const vertical = createSpecialForMatch({
      kind: 'ammo',
      direction: 'v',
      length: 4,
      cells: [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
        { row: 3, col: 0 },
      ],
    });
    const bomb = createSpecialForMatch({
      kind: 'radar',
      direction: 'h',
      length: 5,
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
        { row: 0, col: 4 },
      ],
    });
    const shaped = createSpecialForMatch({
      kind: 'medal',
      direction: 'both',
      length: 3,
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 1, col: 1 },
      ],
    });

    expect(horizontal).toBeNull();
    expect(vertical).toBeNull();
    expect(bomb).toBeNull();
    expect(shaped).toBeNull();
  });
});

function row(kinds: PieceKind[]): Board[number] {
  return kinds.map(piece);
}

function piece(pieceKind: PieceKind): Board[number][number] {
  return { kind: 'normal', pieceKind, id: pieceKind };
}

function empty(): Board[number][number] {
  return { kind: 'empty' };
}

function blocker(blockerKind: 'sandbag' | 'brokenDefense'): Board[number][number] {
  return { kind: 'blocker', blockerKind, durability: 1 };
}
