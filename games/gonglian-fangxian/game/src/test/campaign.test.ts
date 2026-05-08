import { describe, expect, test } from 'vitest';
import { chapterProgressForSave, describeNodeReward, levelById, remainingTargetsText } from '../app/campaign';
import { levels } from '../config/levels';
import type { GameSession } from '../core/types';

describe('campaign helpers', () => {
  test('finds a configured level by id with fallback to level one', () => {
    expect(levelById(12).id).toBe(12);
    expect(levelById(999).id).toBe(1);
  });

  test('computes per-chapter progress from highest unlocked level', () => {
    expect(chapterProgressForSave(12)).toEqual([
      { id: 1, title: '前线集结', startLevel: 1, endLevel: 10, unlockedCount: 10, completedCount: 10, current: false },
      { id: 2, title: '阵地修复', startLevel: 11, endLevel: 20, unlockedCount: 2, completedCount: 1, current: true },
      { id: 3, title: '最终防线', startLevel: 21, endLevel: 30, unlockedCount: 0, completedCount: 0, current: false },
    ]);
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

    expect(remainingTargetsText(session)).toBe('护盾 6/10  沙袋 2/4');
  });
});
