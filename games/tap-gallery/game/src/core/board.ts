import type { BoardCell, BoardState, Direction, DirectionVector } from './types';
import type { LevelConfig } from '../assets/types';

export const DIRECTION_VECTORS: Record<Direction, DirectionVector> = {
  0: { dx: 0, dy: -1 },
  1: { dx: 1, dy: 0 },
  2: { dx: 0, dy: 1 },
  3: { dx: -1, dy: 0 },
};

export function createBoard(level: LevelConfig): BoardState {
  const cells = level.cells.map((cell) => {
    const row = Math.floor(cell.index / level.board.width);
    const col = cell.index % level.board.width;
    return {
      ...cell,
      row,
      col,
      cleared: false,
    };
  });
  return makeBoard(level, cells);
}

export function canClearCell(board: BoardState, index: number): boolean {
  const cell = board.cellsByIndex.get(index);
  if (!cell || cell.cleared) {
    return false;
  }

  const vector = DIRECTION_VECTORS[cell.direction];
  let col = cell.col + vector.dx;
  let row = cell.row + vector.dy;
  while (isInside(board, col, row)) {
    const blocking = board.cellsByIndex.get(row * board.width + col);
    if (blocking && !blocking.cleared) {
      return false;
    }
    col += vector.dx;
    row += vector.dy;
  }
  return true;
}

export function clearCell(board: BoardState, index: number): BoardState {
  if (!board.cellsByIndex.has(index)) {
    return board;
  }
  return clearCells(board, [index]);
}

export function clearCells(board: BoardState, indexes: number[]): BoardState {
  const remove = new Set(indexes);
  const cells = board.cells.map((cell) => (remove.has(cell.index) ? { ...cell, cleared: true } : cell));
  return makeBoard(board.level, cells);
}

export function getClearableCells(board: BoardState): BoardCell[] {
  return board.cells.filter((cell) => canClearCell(board, cell.index));
}

export function findHintCell(board: BoardState): BoardCell | null {
  return getClearableCells(board)[0] ?? null;
}

export function isBoardComplete(board: BoardState): boolean {
  return board.cells.every((cell) => cell.cleared);
}

export function activeCellCount(board: BoardState): number {
  return board.cells.filter((cell) => !cell.cleared).length;
}

function makeBoard(level: LevelConfig, cells: BoardCell[]): BoardState {
  return {
    level,
    width: level.board.width,
    height: level.board.height,
    cells,
    cellsByIndex: new Map(cells.map((cell) => [cell.index, cell])),
  };
}

function isInside(board: BoardState, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < board.width && row < board.height;
}
