import type { Board, BoardCell, PieceKind, Position, SpecialKind, BlockerKind } from '../core/types';
import { easeBackOut, easeInOutSine, easeOutCubic, sampleTween, tweenNumber, type NumberTween } from './animation';

export interface VisualBoardMetrics {
  cellSize: number;
  gap: number;
  startX: number;
  startY: number;
}

export interface VisualTile {
  id: string;
  cell: BoardCell;
  row: number;
  col: number;
  x: number;
  y: number;
  scale: number;
  alpha: number;
  removed: boolean;
}

export interface VisualBoardChanges {
  added: VisualTile[];
  moved: VisualTile[];
  removed: VisualTile[];
}

interface InternalTile {
  id: string;
  cell: BoardCell;
  row: number;
  col: number;
  removed: boolean;
  x: NumberTween;
  y: NumberTween;
  scale: NumberTween;
  alpha: NumberTween;
}

const MOVE_MS = 360;
const SPAWN_MS = 420;
const REMOVE_MS = 360;
const MIN_FALL_MS = 110;
const FALL_PX_PER_MS = 0.5;

export class VisualBoardModel {
  private readonly tiles = new Map<string, InternalTile>();
  private readonly finaleBlockedIds = new Set<string>();
  private hasSynced = false;

  constructor(private readonly metrics: VisualBoardMetrics) {}

  sync(board: Board, nowMs: number): VisualBoardChanges {
    const added: VisualTile[] = [];
    const moved: VisualTile[] = [];
    const removed: VisualTile[] = [];
    const seen = new Set<string>();
    const occupiedBefore = this.occupiedPositions();
    const stackedSpawnRowsByCol = this.collectStackedSpawnRows(board, occupiedBefore);

    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const cell = board[row][col];
        const id = visualId(cell, { row, col });
        if (!id) {
          continue;
        }

        seen.add(id);
        if (this.finaleBlockedIds.has(id)) {
          continue;
        }

        const target = this.cellCenter(row, col);
        const existing = this.tiles.get(id);

        if (!existing || existing.removed) {
          const specialSpawn = cell.kind === 'special';
          const spawn = specialSpawn ? { y: target.y, durationMs: SPAWN_MS } : this.spawnStart(row, col, target.y, stackedSpawnRowsByCol);
          const tile: InternalTile = {
            id,
            cell,
            row,
            col,
            removed: false,
            x: tweenNumber(target.x, target.x, nowMs, spawn.durationMs, easeOutCubic),
            y: tweenNumber(spawn.y, target.y, nowMs, spawn.durationMs, easeBackOut),
            scale: tweenNumber(specialSpawn ? 0.32 : 0.72, 1, nowMs, spawn.durationMs, easeBackOut),
            alpha: tweenNumber(0, 1, nowMs, spawn.durationMs, easeOutCubic),
          };
          this.tiles.set(id, tile);
          added.push(this.sample(tile, nowMs));
          continue;
        }

        const current = this.sample(existing, nowMs);
        existing.cell = cell;
        existing.removed = false;
        if (existing.row !== row || existing.col !== col) {
          const moveDurationMs = this.moveDuration(existing, row, col, current, target);
          existing.x = tweenNumber(current.x, target.x, nowMs, moveDurationMs, easeInOutSine);
          existing.y = tweenNumber(current.y, target.y, nowMs, moveDurationMs, easeInOutSine);
          existing.scale = tweenNumber(current.scale, 1, nowMs, moveDurationMs, easeOutCubic);
          existing.alpha = tweenNumber(current.alpha, 1, nowMs, moveDurationMs, easeOutCubic);
          moved.push(this.sample(existing, nowMs));
        }
        existing.row = row;
        existing.col = col;
      }
    }

    for (const tile of this.tiles.values()) {
      if (seen.has(tile.id) || tile.removed) {
        continue;
      }

      const current = this.sample(tile, nowMs);
      tile.removed = true;
      tile.x = tweenNumber(current.x, current.x, nowMs, REMOVE_MS, easeOutCubic);
      tile.y = tweenNumber(current.y, current.y - this.metrics.cellSize * 0.1, nowMs, REMOVE_MS, easeOutCubic);
      tile.scale = tweenNumber(current.scale, 0.08, nowMs, REMOVE_MS, easeInOutSine);
      tile.alpha = tweenNumber(current.alpha, 0, nowMs, REMOVE_MS, easeOutCubic);
      removed.push(this.sample(tile, nowMs));
    }

    this.hasSynced = true;
    return { added, moved, removed };
  }

  tilesAt(nowMs: number): VisualTile[] {
    const result: VisualTile[] = [];

    for (const [id, tile] of this.tiles) {
      const sampled = this.sample(tile, nowMs);
      if (tile.removed && sampled.alpha <= 0.001) {
        this.tiles.delete(id);
        continue;
      }
      result.push(sampled);
    }

    return result;
  }

  blastAll(nowMs: number): VisualTile[] {
    const blasted: VisualTile[] = [];

    for (const tile of this.tiles.values()) {
      if (tile.removed) {
        continue;
      }

      const current = this.sample(tile, nowMs);
      tile.removed = true;
      this.finaleBlockedIds.add(tile.id);
      tile.x = tweenNumber(current.x, current.x, nowMs, REMOVE_MS, easeOutCubic);
      tile.y = tweenNumber(current.y, current.y, nowMs, REMOVE_MS, easeOutCubic);
      tile.scale = tweenNumber(current.scale, 0.02, nowMs, REMOVE_MS, easeInOutSine);
      tile.alpha = tweenNumber(current.alpha, 0, nowMs, REMOVE_MS, easeOutCubic);
      blasted.push({ ...current, removed: true });
    }

    return blasted;
  }

  clearFinaleBlocks(): void {
    this.finaleBlockedIds.clear();
  }

  isBusy(nowMs: number): boolean {
    return this.tilesAt(nowMs).some((tile) => tile.removed || tile.alpha < 0.999 || Math.abs(tile.scale - 1) > 0.001 || !this.isAtTarget(tile));
  }

  cellCenter(row: number, col: number): { x: number; y: number } {
    return {
      x: this.metrics.startX + col * (this.metrics.cellSize + this.metrics.gap),
      y: this.metrics.startY + row * (this.metrics.cellSize + this.metrics.gap),
    };
  }

  private sample(tile: InternalTile, nowMs: number): VisualTile {
    return {
      id: tile.id,
      cell: tile.cell,
      row: tile.row,
      col: tile.col,
      x: sampleTween(tile.x, nowMs).value,
      y: sampleTween(tile.y, nowMs).value,
      scale: sampleTween(tile.scale, nowMs).value,
      alpha: sampleTween(tile.alpha, nowMs).value,
      removed: tile.removed,
    };
  }

  private isAtTarget(tile: VisualTile): boolean {
    const target = this.cellCenter(tile.row, tile.col);
    return Math.abs(tile.x - target.x) < 0.01 && Math.abs(tile.y - target.y) < 0.01;
  }

  private occupiedPositions(): Set<string> {
    const occupied = new Set<string>();
    for (const tile of this.tiles.values()) {
      if (!tile.removed) {
        occupied.add(positionKey(tile.row, tile.col));
      }
    }
    return occupied;
  }

  private collectStackedSpawnRows(board: Board, occupiedBefore: Set<string>): Map<number, number[]> {
    const rowsByCol = new Map<number, number[]>();
    if (!this.hasSynced) {
      return rowsByCol;
    }

    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board[row].length; col += 1) {
        const cell = board[row][col];
        const id = visualId(cell, { row, col });
        if (
          !id ||
          this.tiles.has(id) ||
          this.finaleBlockedIds.has(id) ||
          cell.kind === 'special' ||
          occupiedBefore.has(positionKey(row, col))
        ) {
          continue;
        }

        rowsByCol.set(col, [...(rowsByCol.get(col) ?? []), row]);
      }
    }

    for (const rows of rowsByCol.values()) {
      rows.sort((a, b) => a - b);
    }

    return rowsByCol;
  }

  private moveDuration(existing: InternalTile, row: number, col: number, current: VisualTile, target: { x: number; y: number }): number {
    if (existing.col === col && row > existing.row && target.y > current.y) {
      return fallDurationForDistance(target.y - current.y, MOVE_MS);
    }

    return MOVE_MS;
  }

  private spawnStart(row: number, col: number, targetY: number, stackedSpawnRowsByCol: Map<number, number[]>): { y: number; durationMs: number } {
    const rows = stackedSpawnRowsByCol.get(col);
    const stackIndex = rows?.indexOf(row) ?? -1;
    if (!rows || stackIndex < 0) {
      return { y: targetY - this.metrics.cellSize * 1.55, durationMs: SPAWN_MS };
    }

    const y = this.metrics.startY - (rows.length - stackIndex) * (this.metrics.cellSize + this.metrics.gap);
    return { y, durationMs: fallDurationForDistance(targetY - y, SPAWN_MS) };
  }
}

function positionKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function fallDurationForDistance(distancePx: number, maxDurationMs: number): number {
  return Math.min(maxDurationMs, Math.max(MIN_FALL_MS, Math.round(Math.max(0, distancePx) / FALL_PX_PER_MS)));
}

export function visualId(cell: BoardCell, position: Position): string | null {
  if (cell.kind === 'empty') {
    return null;
  }

  if (cell.kind === 'normal' || cell.kind === 'special') {
    return cell.id;
  }

  return `blocker:${position.row}:${position.col}:${cell.blockerKind}`;
}

export function tileKind(tile: VisualTile): PieceKind | SpecialKind | BlockerKind | 'empty' {
  if (tile.cell.kind === 'normal') return tile.cell.pieceKind;
  if (tile.cell.kind === 'special') return tile.cell.specialKind;
  if (tile.cell.kind === 'blocker') return tile.cell.blockerKind;
  return 'empty';
}
