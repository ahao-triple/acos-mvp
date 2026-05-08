import { findMatches, swapCells } from '../core/board';
import type { Board, Position } from '../core/types';

export interface SuggestedSwap {
  from: Position;
  to: Position;
}

const ADJACENT_STEPS = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
] as const;

export function findSuggestedSwap(board: Board): SuggestedSwap | null {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
      const from = { row, col };
      for (const step of ADJACENT_STEPS) {
        const to = { row: row + step.row, col: col + step.col };
        if (!isSwappable(board[from.row]?.[from.col]) || !isSwappable(board[to.row]?.[to.col])) {
          continue;
        }

        if (findMatches(swapCells(board, from, to)).length > 0) {
          return { from, to };
        }
      }
    }
  }

  return null;
}

function isSwappable(cell: Board[number][number] | undefined): boolean {
  return cell?.kind === 'normal' || cell?.kind === 'special';
}
