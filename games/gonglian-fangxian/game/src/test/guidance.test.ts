import { describe, expect, test } from 'vitest';
import { areAdjacent, findMatches, swapCells } from '../core/board';
import type { Board, PieceKind } from '../core/types';
import { findSuggestedSwap } from '../render/guidance';

describe('invisible guidance', () => {
  test('finds an adjacent swap that creates a real match', () => {
    const board: Board = [
      row(['shield', 'ammo', 'shield']),
      row(['radar', 'shield', 'radar']),
      row(['ammo', 'shield', 'medal']),
    ];

    const suggestion = findSuggestedSwap(board);

    expect(suggestion).not.toBeNull();
    expect(areAdjacent(suggestion!.from, suggestion!.to)).toBe(true);
    expect(findMatches(swapCells(board, suggestion!.from, suggestion!.to))).not.toHaveLength(0);
  });

  test('returns no suggestion when the board has no possible three-match swap', () => {
    const board: Board = [
      row(['shield', 'ammo']),
      row(['radar', 'medal']),
    ];

    expect(findSuggestedSwap(board)).toBeNull();
  });
});

function row(kinds: PieceKind[]): Board[number] {
  return kinds.map((kind, index) => ({
    kind: 'normal',
    pieceKind: kind,
    id: `${kind}-${index}`,
  }));
}
