import { canClearCell, clearCells } from './board';
import type { BoardState, ToolResult } from './types';

export function applyHammer(board: BoardState, index: number): ToolResult {
  const cell = board.cellsByIndex.get(index);
  if (!cell || cell.cleared) {
    return { board, removed: [] };
  }
  return { board: clearCells(board, [index]), removed: [index] };
}

export function applyBomb(board: BoardState, index: number): ToolResult {
  const target = board.cellsByIndex.get(index);
  if (!target || target.cleared) {
    return { board, removed: [] };
  }
  const removed = board.cells
    .filter((cell) => !cell.cleared && Math.abs(cell.col - target.col) <= 1 && Math.abs(cell.row - target.row) <= 1)
    .filter((cell) => canClearCell(board, cell.index))
    .map((cell) => cell.index);
  return { board: clearCells(board, removed), removed };
}

export function applyMagnet(board: BoardState, index: number, cap = 8): ToolResult {
  const start = board.cellsByIndex.get(index);
  if (!start || start.cleared) {
    return { board, removed: [] };
  }

  const vector = start.direction === 0
    ? { dx: 0, dy: -1 }
    : start.direction === 1
      ? { dx: 1, dy: 0 }
      : start.direction === 2
        ? { dx: 0, dy: 1 }
        : { dx: -1, dy: 0 };
  const removed: number[] = [];
  let col = start.col;
  let row = start.row;

  while (removed.length < cap && col >= 0 && row >= 0 && col < board.width && row < board.height) {
    const cell = board.cellsByIndex.get(row * board.width + col);
    if (!cell || cell.cleared || cell.direction !== start.direction) {
      break;
    }
    removed.push(cell.index);
    col += vector.dx;
    row += vector.dy;
  }

  return { board: clearCells(board, removed), removed };
}

export function canBomb(board: BoardState, index: number): boolean {
  const cell = board.cellsByIndex.get(index);
  return Boolean(cell && !cell.cleared);
}

export function canHammer(board: BoardState, index: number): boolean {
  return canBomb(board, index);
}

export function canMagnet(board: BoardState, index: number): boolean {
  const cell = board.cellsByIndex.get(index);
  return Boolean(cell && !cell.cleared);
}
