import { describe, expect, test } from 'vitest';
import { VisualBoardModel } from '../render/visualBoard';
import type { Board } from '../core/types';

describe('visual board model', () => {
  test('spawns new tiles from above their target cells', () => {
    const model = new VisualBoardModel({ cellSize: 80, gap: 8, startX: 10, startY: 20 });

    model.sync(board([['a', 'b']]), 100);
    const tile = model.tilesAt(100).find((candidate) => candidate.id === 'a');

    expect(tile?.y).toBeLessThan(20);
    expect(tile?.alpha).toBeLessThan(1);
    expect(model.isBusy(100)).toBe(true);
    expect(model.isBusy(800)).toBe(false);
  });

  test('stacks refill tiles above the board instead of spawning lower tiles inside the grid', () => {
    const model = new VisualBoardModel({ cellSize: 80, gap: 8, startX: 10, startY: 20 });

    model.sync(board([['a'], ['b'], ['c']]), 0);
    model.tilesAt(700);
    model.sync(emptyBoard(3, 1), 800);
    model.tilesAt(1400);

    const changes = model.sync(board([['n0'], ['n1'], ['n2']]), 1500);
    const added = changes.added.sort((a, b) => a.row - b.row);

    expect(added.map((tile) => tile.id)).toEqual(['n0', 'n1', 'n2']);
    expect(added.every((tile) => tile.y < 20)).toBe(true);
    expect(added[0].y).toBeLessThan(added[1].y);
    expect(added[1].y).toBeLessThan(added[2].y);
  });

  test('settles a short refill drop without lingering mid-cell', () => {
    const model = new VisualBoardModel({ cellSize: 80, gap: 8, startX: 10, startY: 20 });

    model.sync(board([['a']]), 0);
    model.tilesAt(700);
    model.sync(emptyBoard(1, 1), 800);
    model.tilesAt(1400);
    model.sync(board([['n0']]), 1500);

    expect(model.tilesAt(1800).find((candidate) => candidate.id === 'n0')?.y).toBe(20);
  });

  test('moves existing tile ids to new board positions', () => {
    const model = new VisualBoardModel({ cellSize: 80, gap: 8, startX: 10, startY: 20 });

    model.sync(board([['a', 'b']]), 0);
    model.tilesAt(500);
    model.sync(board([['b', 'a']]), 500);

    const moving = model.tilesAt(760).find((candidate) => candidate.id === 'a');
    expect(moving?.x).toBeGreaterThan(10);
    expect(moving?.x).toBeLessThan(98);
    expect(model.tilesAt(1100).find((candidate) => candidate.id === 'a')?.x).toBe(98);
  });

  test('settles short downward falls faster than full swap movement timing', () => {
    const model = new VisualBoardModel({ cellSize: 80, gap: 8, startX: 10, startY: 20 });

    model.sync(board([['a'], ['b']]), 0);
    model.tilesAt(700);
    model.sync(board([['x'], ['a']]), 800);

    const falling = model.tilesAt(1100).find((candidate) => candidate.id === 'a');

    expect(falling?.row).toBe(1);
    expect(falling?.y).toBe(108);
  });

  test('fades removed tile ids and prunes them after animation', () => {
    const model = new VisualBoardModel({ cellSize: 80, gap: 8, startX: 10, startY: 20 });

    model.sync(board([['a', 'b']]), 0);
    model.tilesAt(500);
    const changes = model.sync(board([['a', 'c']]), 500);

    expect(changes.removed.map((tile) => tile.id)).toContain('b');
    expect(model.tilesAt(760).find((candidate) => candidate.id === 'b')?.alpha).toBeLessThan(1);
    expect(model.tilesAt(1100).some((candidate) => candidate.id === 'b')).toBe(false);
  });

  test('creates special tiles with an in-place pop animation', () => {
    const model = new VisualBoardModel({ cellSize: 80, gap: 8, startX: 10, startY: 20 });

    model.sync(specialBoard(), 100);
    const tile = model.tilesAt(100).find((candidate) => candidate.id === 'special-bomb');

    expect(tile?.y).toBe(20);
    expect(tile?.scale).toBeLessThan(1);
    expect(tile?.alpha).toBeLessThan(1);
  });

  test('can blast every visible tile for a win finale', () => {
    const model = new VisualBoardModel({ cellSize: 80, gap: 8, startX: 10, startY: 20 });

    model.sync(board([['a', 'b']]), 0);
    model.tilesAt(700);
    const blasted = model.blastAll(700);

    expect(blasted.map((tile) => tile.id)).toEqual(['a', 'b']);
    expect(model.tilesAt(900).every((tile) => tile.removed)).toBe(true);
    expect(model.isBusy(900)).toBe(true);
    expect(model.tilesAt(1300)).toHaveLength(0);
  });
});

function board(ids: string[][]): Board {
  return ids.map((row) =>
    row.map((id) => ({
      kind: 'normal' as const,
      pieceKind: 'shield' as const,
      id,
    })),
  );
}

function emptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ kind: 'empty' as const })));
}

function specialBoard(): Board {
  return [[{
    kind: 'special' as const,
    pieceKind: 'shield' as const,
    specialKind: 'areaBomb' as const,
    id: 'special-bomb',
  }]];
}
