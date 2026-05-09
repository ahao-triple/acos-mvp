import type { Direction, LevelCellConfig, LevelConfig } from '../assets/types';

export interface BoardCell extends LevelCellConfig {
  row: number;
  col: number;
  cleared: boolean;
}

export interface BoardState {
  level: LevelConfig;
  width: number;
  height: number;
  cells: BoardCell[];
  cellsByIndex: Map<number, BoardCell>;
}

export interface ToolResult {
  board: BoardState;
  removed: number[];
}

export interface DirectionVector {
  dx: number;
  dy: number;
}

export type { Direction };
