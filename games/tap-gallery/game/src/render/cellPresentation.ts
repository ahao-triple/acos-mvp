import { canClearCell } from '../core/board';
import type { BoardCell, BoardState } from '../core/types';

export type CellTone = 'normal' | 'gold' | 'timer' | 'bomb' | 'locked';

export interface CellPresentation {
  arrowVisible: boolean;
  label: string | null;
  badge: string | null;
  locked: boolean;
  tone: CellTone;
}

export function cellPresentation(board: BoardState, cell: BoardCell): CellPresentation {
  const locked = cell.kind === 'locked' && !canClearCell(board, cell.index);
  const secretHidden = cell.kind === 'secret' && !cell.revealed;
  const badge = badgeFor(cell);
  return {
    arrowVisible: !secretHidden,
    label: secretHidden ? '?' : locked ? 'LOCK' : null,
    badge,
    locked,
    tone: toneFor(cell, locked),
  };
}

export function formatTimerRemaining(remainingMs: number | null): string | null {
  if (remainingMs === null) {
    return null;
  }
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function badgeFor(cell: BoardCell): string | null {
  if (cell.kind === 'golden') {
    return '+';
  }
  if (cell.kind === 'timer') {
    return 'T';
  }
  if (cell.kind === 'bomb') {
    return 'B';
  }
  return null;
}

function toneFor(cell: BoardCell, locked: boolean): CellTone {
  if (locked) {
    return 'locked';
  }
  if (cell.kind === 'golden') {
    return 'gold';
  }
  if (cell.kind === 'timer') {
    return 'timer';
  }
  if (cell.kind === 'bomb') {
    return 'bomb';
  }
  return 'normal';
}
