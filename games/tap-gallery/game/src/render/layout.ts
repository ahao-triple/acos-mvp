export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1334;
export const BOARD_BOX = { x: 45, y: 235, size: 660 };

export interface BoardDimensions {
  width: number;
  height: number;
}

export interface BoardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  cellSize: number;
  gap: number;
}

export interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function viewportScale(width: number, height: number): number {
  return Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
}

export function boardLayout(board: BoardDimensions): BoardLayout {
  const gap = board.width > 14 || board.height > 14 ? 2 : 4;
  const maxAxis = Math.max(board.width, board.height);
  const cellSize = Math.floor((BOARD_BOX.size - gap * (maxAxis - 1)) / maxAxis);
  const width = board.width * cellSize + (board.width - 1) * gap;
  const height = board.height * cellSize + (board.height - 1) * gap;
  return {
    x: BOARD_BOX.x + (BOARD_BOX.size - width) / 2,
    y: BOARD_BOX.y + (BOARD_BOX.size - height) / 2,
    width,
    height,
    cellSize,
    gap,
  };
}

export function cellRect(layout: BoardLayout, index: number, boardWidth: number): { x: number; y: number; width: number; height: number } {
  const col = index % boardWidth;
  const row = Math.floor(index / boardWidth);
  return {
    x: layout.x + col * (layout.cellSize + layout.gap),
    y: layout.y + row * (layout.cellSize + layout.gap),
    width: layout.cellSize,
    height: layout.cellSize,
  };
}

export function designToCanvas(point: { x: number; y: number }, transform: CanvasTransform): { x: number; y: number } {
  return {
    x: (point.x + transform.offsetX) * transform.scale,
    y: (point.y + transform.offsetY) * transform.scale,
  };
}
