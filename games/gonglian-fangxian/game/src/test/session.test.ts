import { describe, expect, test } from 'vitest';
import { levels } from '../config/levels';
import { applyMove, applyPowerUp, createSession, isLevelLost, isLevelWon } from '../core/session';
import type { Board, GameSession, TargetConfig } from '../core/types';

describe('level sessions', () => {
  test('starts level 1 with configured board size and moves', () => {
    const session = createSession(levels[0], 101);

    expect(session.levelId).toBe(1);
    expect(session.board).toHaveLength(7);
    expect(session.board[0]).toHaveLength(7);
    expect(session.movesLeft).toBe(levels[0].moves);
    expect(session.status).toBe('playing');
  });

  test('valid matching move spends one move and updates collect target progress', () => {
    const session = sessionWithBoard([
      row(['shield', 'ammo', 'shield']),
      row(['shield', 'ammo', 'radar']),
      row(['ammo', 'shield', 'wrench']),
    ]);

    const next = applyMove(session, { row: 2, col: 0 }, { row: 2, col: 1 }, 5);

    expect(next.movesLeft).toBe(2);
    expect(next.targetProgress.shield).toBe(3);
    expect(next.status).toBe('won');
    expect(next.lastEvents.some((event) => event.type === 'swap' && event.board)).toBe(true);
    expect(next.lastEvents.some((event) => event.type === 'clear' && event.board)).toBe(true);
    expect(next.lastEvents.some((event) => event.type === 'fall' && event.board)).toBe(true);
    expect(next.lastEvents.some((event) => event.type === 'refill' && event.board)).toBe(true);
  });

  test('non-matching move is reverted without spending moves', () => {
    const session = sessionWithBoard([
      row(['shield', 'ammo', 'radar']),
      row(['ammo', 'radar', 'wrench']),
      row(['wrench', 'medal', 'shield']),
    ]);

    const next = applyMove(session, { row: 0, col: 0 }, { row: 0, col: 1 }, 5);

    expect(next.movesLeft).toBe(3);
    expect(next.board).toEqual(session.board);
    expect(next.status).toBe('playing');
  });

  test('marks session lost when final move does not complete targets', () => {
    const session = {
      ...sessionWithBoard([
        row(['shield', 'ammo', 'radar']),
        row(['ammo', 'radar', 'wrench']),
        row(['wrench', 'medal', 'shield']),
      ]),
      movesLeft: 0,
    };

    expect(isLevelLost(session)).toBe(true);
    expect(isLevelWon(session)).toBe(false);
  });

  test('clears adjacent blocker targets from a matching move', () => {
    const session = sessionWithBoard([
      [blocker('sandbag'), piece('ammo'), piece('radar')],
      row(['shield', 'ammo', 'shield']),
      row(['shield', 'shield', 'wrench']),
    ], [{ type: 'clearBlocker', kind: 'sandbag', count: 1 }]);

    const next = applyMove(session, { row: 1, col: 1 }, { row: 2, col: 1 }, 10);

    expect(next.targetProgress.sandbag).toBe(1);
    expect(next.status).toBe('won');
  });

  test('bomb power-up clears a local 3x3 area without spending a move', () => {
    const session = sessionWithBoard([
      row(['shield', 'ammo', 'radar']),
      row(['ammo', 'radar', 'wrench']),
      row(['wrench', 'medal', 'shield']),
    ]);

    const next = applyPowerUp(session, 'bomb', { row: 1, col: 1 }, 77);

    expect(next.movesLeft).toBe(3);
    expect(next.lastEvents.some((event) => event.type === 'clear' && event.board)).toBe(true);
    expect(next.lastEvents.some((event) => event.type === 'refill' && event.board)).toBe(true);
  });

  test('shuffle power-up rebuilds board without spending a move', () => {
    const session = sessionWithBoard([
      row(['shield', 'ammo', 'radar']),
      row(['ammo', 'radar', 'wrench']),
      row(['wrench', 'medal', 'shield']),
    ]);

    const next = applyPowerUp(session, 'shuffle', { row: 0, col: 0 }, 77);

    expect(next.movesLeft).toBe(3);
    expect(next.board).not.toEqual(session.board);
    expect(next.lastEvents.some((event) => event.type === 'shuffle' && event.board)).toBe(true);
  });
});

function sessionWithBoard(
  board: Board,
  targets: TargetConfig[] = [{ type: 'collect', kind: 'shield', count: 3 }],
): GameSession {
  return {
    levelId: 99,
    board,
    movesLeft: 3,
    targetProgress: {},
    targets,
    selectedCell: null,
    comboCount: 0,
    status: 'playing',
    lastEvents: [],
    piecePool: ['shield', 'ammo', 'radar', 'medal', 'wrench'],
  };
}

function row(kinds: Array<'shield' | 'ammo' | 'radar' | 'medal' | 'wrench'>): Board[number] {
  return kinds.map((pieceKind) => ({ kind: 'normal' as const, pieceKind, id: pieceKind }));
}

function piece(pieceKind: 'shield' | 'ammo' | 'radar' | 'medal' | 'wrench'): Board[number][number] {
  return { kind: 'normal', pieceKind, id: pieceKind };
}

function blocker(blockerKind: 'sandbag' | 'brokenDefense'): Board[number][number] {
  return { kind: 'blocker', blockerKind, durability: 1 };
}
