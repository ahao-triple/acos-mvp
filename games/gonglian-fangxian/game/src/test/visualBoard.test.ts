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

  test('fades removed tile ids and prunes them after animation', () => {
    const model = new VisualBoardModel({ cellSize: 80, gap: 8, startX: 10, startY: 20 });

    model.sync(board([['a', 'b']]), 0);
    model.tilesAt(500);
    const changes = model.sync(board([['a', 'c']]), 500);

    expect(changes.removed.map((tile) => tile.id)).toContain('b');
    expect(model.tilesAt(760).find((candidate) => candidate.id === 'b')?.alpha).toBeLessThan(1);
    expect(model.tilesAt(1100).some((candidate) => candidate.id === 'b')).toBe(false);
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
