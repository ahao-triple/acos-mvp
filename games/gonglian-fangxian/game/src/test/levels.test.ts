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

  test('every blocker stays within board bounds with positive durability', () => {
    for (const level of levels) {
      for (const blocker of level.blockers) {
        expect(blocker.row, `level ${level.id} blocker row`).toBeGreaterThanOrEqual(0);
        expect(blocker.row, `level ${level.id} blocker row < height`).toBeLessThan(level.height);
        expect(blocker.col, `level ${level.id} blocker col`).toBeGreaterThanOrEqual(0);
        expect(blocker.col, `level ${level.id} blocker col < width`).toBeLessThan(level.width);
        expect(blocker.durability, `level ${level.id} blocker durability`).toBeGreaterThan(0);
      }
    }
  });

  test('every level has positive moves, non-empty piecePool, and positive target counts', () => {
    for (const level of levels) {
      expect(level.moves, `level ${level.id} moves`).toBeGreaterThan(0);
      expect(level.piecePool.length, `level ${level.id} piecePool`).toBeGreaterThan(0);
      for (const target of level.targets) {
        expect(target.count, `level ${level.id} target.count`).toBeGreaterThan(0);
        expect(['collect', 'clearBlocker']).toContain(target.type);
      }
    }
  });

  test('CHAPTERS cover 1..LEVEL_COUNT with no gaps or overlaps', () => {
    const sorted = [...CHAPTERS].sort((a, b) => a.startLevel - b.startLevel);
    expect(sorted[0].startLevel).toBe(1);
    expect(sorted[sorted.length - 1].endLevel).toBe(LEVEL_COUNT);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].startLevel, `chapter ${sorted[i].id} contiguous`).toBe(sorted[i - 1].endLevel + 1);
    }
  });
});
