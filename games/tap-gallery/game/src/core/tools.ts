import { canClearCell, clearCells, getClearableCells } from './board';
import type { BoardState, Direction, ToolResult } from './types';

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
    .filter((cell) => !cell.cleared && Math.abs(cell.col - target.col) + Math.abs(cell.row - target.row) <= 1)
    .map((cell) => cell.index);
  return { board: clearCells(board, removed), removed };
}

export function applyMagnet(board: BoardState, direction: Direction, cap = 8): ToolResult {
  const removed = getClearableCells(board)
    .filter((cell) => cell.direction === direction)
    .slice(0, cap)
    .map((cell) => cell.index);
  return { board: clearCells(board, removed), removed };
}

export function canBomb(board: BoardState, index: number): boolean {
  const cell = board.cellsByIndex.get(index);
  return Boolean(cell && !cell.cleared);
}

export function canHammer(board: BoardState, index: number): boolean {
  return canBomb(board, index);
}

export function canMagnet(board: BoardState, direction: Direction): boolean {
  return board.cells.some((cell) => !cell.cleared && cell.direction === direction && canClearCell(board, cell.index));
}
