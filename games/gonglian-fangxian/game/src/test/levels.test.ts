import { describe, expect, test } from 'vitest';
import { CHAPTERS, LEVEL_COUNT, chapterForLevel, levels } from '../config/levels';

describe('campaign level configuration', () => {
  test('defines thirty sequential campaign levels across three chapters', () => {
    expect(LEVEL_COUNT).toBe(30);
    expect(levels).toHaveLength(30);
    expect(levels.map((level) => level.id)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
    expect(CHAPTERS).toEqual([
      { id: 1, title: '前线集结', startLevel: 1, endLevel: 10 },
      { id: 2, title: '阵地修复', startLevel: 11, endLevel: 20 },
      { id: 3, title: '最终防线', startLevel: 21, endLevel: 30 },
    ]);
  });

  test('attaches player-facing campaign metadata to every level', () => {
    for (const level of levels) {
      expect(level.chapterId).toBeGreaterThanOrEqual(1);
      expect(level.chapterId).toBeLessThanOrEqual(3);
      expect(level.chapterTitle).toBe(chapterForLevel(level.id).title);
      expect(level.briefing.length).toBeGreaterThan(6);
      expect(level.rewards.coins).toBeGreaterThan(0);
      expect(level.targets.length).toBeGreaterThan(0);
    }
  });

  test('marks each chapter finale with one node reward item', () => {
    expect(levels.find((level) => level.id === 10)?.nodeReward).toEqual({ bomb: 1 });
    expect(levels.find((level) => level.id === 20)?.nodeReward).toEqual({ suck: 1 });
    expect(levels.find((level) => level.id === 30)?.nodeReward).toEqual({ shuffle: 1 });
  });
});
