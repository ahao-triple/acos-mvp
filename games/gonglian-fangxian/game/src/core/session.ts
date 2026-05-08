import {
  applyGravity,
  clearCells,
  createBoard,
  createSpecialForMatch,
  damageAdjacentBlockers,
  findMatches,
  refillBoard,
  swapCells,
  uniquePositions,
} from './board';
import type { Board, BlockerKind, GameSession, LevelConfig, Position, PowerUpType, SessionEvent } from './types';

export function createSession(level: LevelConfig, seed = Date.now()): GameSession {
  let board = createBoard(level.piecePool, level.width, level.height, seed);

  for (const blocker of level.blockers) {
    if (board[blocker.row]?.[blocker.col]) {
      board[blocker.row][blocker.col] = {
        kind: 'blocker',
        blockerKind: blocker.blockerKind,
        durability: blocker.durability,
      };
    }
  }

  return {
    levelId: level.id,
    board,
    movesLeft: level.moves,
    targetProgress: {},
    targets: level.targets,
    selectedCell: null,
    comboCount: 0,
    status: 'playing',
    lastEvents: [],
    piecePool: level.piecePool,
  };
}

export function applyMove(session: GameSession, from: Position, to: Position, seed = Date.now()): GameSession {
  if (session.status !== 'playing') {
    return session;
  }

  const swapped = swapCells(session.board, from, to);
  const matches = findMatches(swapped);

  if (matches.length === 0) {
    return { ...session, board: session.board, selectedCell: null, lastEvents: [] };
  }

  const settled = settleBoard(swapped, session, seed, [{ type: 'swap', board: swapped, phaseDurationMs: 520 }]);
  const movesLeft = Math.max(0, session.movesLeft - 1);
  const next: GameSession = {
    ...session,
    board: settled.board,
    movesLeft,
    targetProgress: settled.targetProgress,
    selectedCell: null,
    comboCount: settled.comboCount,
    lastEvents: settled.events,
  };

  if (isLevelWon(next)) {
    return { ...next, status: 'won', lastEvents: [...next.lastEvents, { type: 'win' }] };
  }

  if (isLevelLost(next)) {
    return { ...next, status: 'lost', lastEvents: [...next.lastEvents, { type: 'lose' }] };
  }

  return { ...next, status: 'playing' };
}

export function isLevelWon(session: GameSession): boolean {
  return session.targets.every((target) => (session.targetProgress[target.kind] ?? 0) >= target.count);
}

export function isLevelLost(session: GameSession): boolean {
  return session.movesLeft <= 0 && !isLevelWon(session);
}

export function addMoves(session: GameSession, moves: number): GameSession {
  return {
    ...session,
    movesLeft: session.movesLeft + moves,
    status: 'playing',
  };
}

export function applyPowerUp(session: GameSession, type: PowerUpType, position: Position, seed = Date.now()): GameSession {
  if (session.status !== 'playing') {
    return session;
  }

  if (type === 'shuffle') {
    const board = createBoard(session.piecePool, session.board[0]?.length ?? 7, session.board.length || 7, seed);
    return {
      ...session,
      board,
      selectedCell: null,
      lastEvents: [{ type: 'shuffle', board, phaseDurationMs: 680 }],
    };
  }

  const cells = type === 'bomb' ? areaCells(session.board, position, 1) : sameKindCells(session.board, position);
  if (cells.length === 0) {
    return { ...session, selectedCell: null, lastEvents: [] };
  }

  const cleared = clearCells(session.board, cells);
  const fallen = applyGravity(cleared);
  const refilled = refillBoard(fallen, session.piecePool, seed);
  const settled = settleBoard(refilled, session, seed + 1, [
    { type: 'clear', cells, board: cleared, phaseDurationMs: 680 },
    { type: 'fall', board: fallen, phaseDurationMs: 620 },
    { type: 'refill', board: refilled, phaseDurationMs: 720 },
  ]);

  return {
    ...session,
    board: settled.board,
    targetProgress: settled.targetProgress,
    comboCount: settled.comboCount,
    selectedCell: null,
    lastEvents: settled.events,
  };
}

function settleBoard(board: Board, session: GameSession, seed: number, initialEvents: SessionEvent[] = []): {
  board: Board;
  targetProgress: Record<string, number>;
  comboCount: number;
  events: SessionEvent[];
} {
  let current = board;
  const targetProgress = { ...session.targetProgress };
  const events: SessionEvent[] = [...initialEvents];
  let comboCount = 0;

  while (comboCount < 18) {
    const matches = findMatches(current);
    if (matches.length === 0) {
      break;
    }

    comboCount += 1;

    for (const match of matches) {
      targetProgress[match.kind] = (targetProgress[match.kind] ?? 0) + match.cells.length;
      events.push({ type: 'match', kind: match.kind, count: match.cells.length, cells: match.cells });
    }

    const clearedCells = uniquePositions(matches);
    current = clearCells(current, clearedCells);
    const blockerResult = damageAdjacentBlockers(current, clearedCells);
    current = blockerResult.board;

    for (const [kind, count] of Object.entries(blockerResult.clearedBlockers) as Array<[BlockerKind, number]>) {
      targetProgress[kind] = (targetProgress[kind] ?? 0) + count;
      events.push({ type: 'match', kind, count });
    }

    for (const match of matches) {
      const special = createSpecialForMatch(match);
      const origin = match.cells[0];
      if (special && current[origin.row]?.[origin.col]?.kind === 'empty') {
        current[origin.row][origin.col] = special;
      }
    }

    events.push({ type: 'clear', cells: clearedCells, board: current, phaseDurationMs: 680 });
    current = applyGravity(current);
    events.push({ type: 'fall', board: current, phaseDurationMs: 620 });
    current = refillBoard(current, session.piecePool, seed + comboCount);
    events.push({ type: 'refill', board: current, phaseDurationMs: 720 });
  }

  return { board: current, targetProgress, comboCount, events };
}

function areaCells(board: Board, center: Position, radius: number): Position[] {
  const cells: Position[] = [];
  for (let row = center.row - radius; row <= center.row + radius; row += 1) {
    for (let col = center.col - radius; col <= center.col + radius; col += 1) {
      if (board[row]?.[col] && board[row][col].kind !== 'blocker') {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

function sameKindCells(board: Board, position: Position): Position[] {
  const cell = board[position.row]?.[position.col];
  if (!cell || (cell.kind !== 'normal' && cell.kind !== 'special')) {
    return [];
  }

  const cells: Position[] = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
      const candidate = board[row][col];
      if ((candidate.kind === 'normal' || candidate.kind === 'special') && candidate.pieceKind === cell.pieceKind) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}
