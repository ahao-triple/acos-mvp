/**
 * PieceSprite 的 kind 缓存比较 / 归类纯函数单测。
 * 这是 PieceSprite.sync 每帧热路径，逻辑错误会导致 piece 闪烁、错画、或漏 redraw。
 */
import { describe, expect, test } from 'vitest';
import type { BoardCell } from '../core/types';
import { type CachedKind, classifyCell, sameKind } from '../pixi/pieces/pieceKind';

const normal = (pieceKind: 'shield' | 'ammo' | 'radar'): BoardCell => ({ kind: 'normal', pieceKind, id: `n-${pieceKind}` });
const special = (pieceKind: 'shield' | 'ammo'): BoardCell =>
  ({ kind: 'special', pieceKind, specialKind: 'horizontalRocket', id: `s-${pieceKind}` });
const blocker = (blockerKind: 'sandbag' | 'brokenDefense'): BoardCell =>
  ({ kind: 'blocker', blockerKind, durability: 1 });
const empty: BoardCell = { kind: 'empty' };

describe('sameKind', () => {
  test('null cached → false always', () => {
    expect(sameKind(null, normal('shield'))).toBe(false);
    expect(sameKind(null, blocker('sandbag'))).toBe(false);
    expect(sameKind(null, empty)).toBe(false);
  });

  test('normal vs normal: matches only when pieceKind equal', () => {
    const cached: CachedKind = { type: 'normal', pieceKind: 'shield' };
    expect(sameKind(cached, normal('shield'))).toBe(true);
    expect(sameKind(cached, normal('ammo'))).toBe(false);
  });

  test('special vs special: matches only when pieceKind equal', () => {
    const cached: CachedKind = { type: 'special', pieceKind: 'shield' };
    expect(sameKind(cached, special('shield'))).toBe(true);
    expect(sameKind(cached, special('ammo'))).toBe(false);
  });

  test('normal ⇄ special: never matches (升级触发 redraw)', () => {
    const cachedNormal: CachedKind = { type: 'normal', pieceKind: 'shield' };
    const cachedSpecial: CachedKind = { type: 'special', pieceKind: 'shield' };
    expect(sameKind(cachedNormal, special('shield'))).toBe(false);
    expect(sameKind(cachedSpecial, normal('shield'))).toBe(false);
  });

  test('blocker vs blocker: matches only when blockerKind equal', () => {
    const cached: CachedKind = { type: 'blocker', blockerKind: 'sandbag' };
    expect(sameKind(cached, blocker('sandbag'))).toBe(true);
    expect(sameKind(cached, blocker('brokenDefense'))).toBe(false);
  });

  test('normal vs blocker: never matches', () => {
    const cachedNormal: CachedKind = { type: 'normal', pieceKind: 'shield' };
    const cachedBlocker: CachedKind = { type: 'blocker', blockerKind: 'sandbag' };
    expect(sameKind(cachedNormal, blocker('sandbag'))).toBe(false);
    expect(sameKind(cachedBlocker, normal('shield'))).toBe(false);
  });

  test('any cached vs empty cell: never matches (触发 sprite 清空)', () => {
    const cachedNormal: CachedKind = { type: 'normal', pieceKind: 'shield' };
    const cachedSpecial: CachedKind = { type: 'special', pieceKind: 'shield' };
    const cachedBlocker: CachedKind = { type: 'blocker', blockerKind: 'sandbag' };
    expect(sameKind(cachedNormal, empty)).toBe(false);
    expect(sameKind(cachedSpecial, empty)).toBe(false);
    expect(sameKind(cachedBlocker, empty)).toBe(false);
  });
});

describe('classifyCell', () => {
  test('normal → CachedKind(normal)', () => {
    expect(classifyCell(normal('shield'))).toEqual({ type: 'normal', pieceKind: 'shield' });
  });

  test('special → CachedKind(special)', () => {
    expect(classifyCell(special('ammo'))).toEqual({ type: 'special', pieceKind: 'ammo' });
  });

  test('blocker → CachedKind(blocker), durability 不进 CachedKind（不参与几何）', () => {
    expect(classifyCell(blocker('sandbag'))).toEqual({ type: 'blocker', blockerKind: 'sandbag' });
  });

  test('empty → null（调用方应清空 sprite）', () => {
    expect(classifyCell(empty)).toBeNull();
  });
});

describe('sameKind + classifyCell 互逆性', () => {
  test('classifyCell(cell) 产出的 CachedKind 与同一 cell sameKind 必为 true', () => {
    const cells: BoardCell[] = [
      normal('shield'), normal('ammo'), normal('radar'),
      special('shield'), special('ammo'),
      blocker('sandbag'), blocker('brokenDefense'),
    ];
    for (const cell of cells) {
      const cached = classifyCell(cell);
      expect(cached, `classify ${cell.kind}`).not.toBeNull();
      expect(sameKind(cached, cell), `roundtrip ${cell.kind}`).toBe(true);
    }
  });
});
