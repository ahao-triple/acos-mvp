import { describe, expect, test } from 'vitest';
import { chapterProgressForSave, describeNodeReward, levelById, remainingTargetsText } from '../app/campaign';
import { levels } from '../config/levels';
import type { GameSession } from '../core/types';

describe('campaign helpers', () => {
  test('finds a configured level by id with fallback to level one', () => {
    expect(levelById(12).id).toBe(12);
    expect(levelById(999).id).toBe(1);
  });

  test('includes the sixth energy piece in every level pool', () => {
    expect(levels).toHaveLength(30);
    expect(levels.every((level) => level.piecePool.includes('energy'))).toBe(true);
  });

  test('configures large boards with longer collect pacing', () => {
    const opening = levelById(1);

    expect(opening.width).toBe(10);
    expect(opening.height).toBe(10);
    expect(opening.moves).toBeGreaterThan(18);
    expect(opening.targets[0]).toMatchObject({ type: 'collect', kind: 'shield', count: 12 });
  });

  test('computes per-chapter progress from highest unlocked level', () => {
    expect(chapterProgressForSave(12)).toEqual([
      { id: 1, title: '初出茅庐', startLevel: 1, endLevel: 10, unlockedCount: 10, completedCount: 10, current: false },
      { id: 2, title: '玩梗高手', startLevel: 11, endLevel: 20, unlockedCount: 2, completedCount: 1, current: true },
      { id: 3, title: '梗王登场', startLevel: 21, endLevel: 30, unlockedCount: 0, completedCount: 0, current: false },
    ]);
  });

  test('uses persisted completed level count for final chapter completion', () => {
    expect(chapterProgressForSave(30, 30)[2]).toMatchObject({
      id: 3,
      completedCount: 10,
      current: true,
    });
  });

  test('formats node rewards and remaining targets in Chinese', () => {
    expect(describeNodeReward({ bomb: 1 })).toBe('炸开 x1');
    const session: GameSession = {
      levelId: 1,
      board: [],
      movesLeft: 0,
      targetProgress: { shield: 6, sandbag: 2 },
      targets: [
        { type: 'collect', kind: 'shield', count: 10 },
        { type: 'clearBlocker', kind: 'sandbag', count: 4 },
      ],
      selectedCell: null,
      comboCount: 0,
      status: 'lost',
      lastEvents: [],
      piecePool: levels[0].piecePool,
    };

    expect(remainingTargetsText(session)).toBe('笑梗 6/10  障碍 2/4');
  });
});
