import { describe, expect, test } from 'vitest';
import { impactForClearStep, impactForWinFinale } from '../feedback/impact';
import type { Position, SessionEvent } from '../core/types';

describe('impact feedback levels', () => {
  test('maps normal first clears from level one through level five', () => {
    expect(impactForClearStep(firstClear(line(3)), 1)).toMatchObject({
      level: 1,
      source: 'match',
      sound: 'match',
      haptic: 'short',
      shake: { amplitude: 0, durationMs: 0 },
    });
    expect(impactForClearStep(firstClear(line(4)), 1)).toMatchObject({
      level: 2,
      source: 'match',
      sound: 'match',
      haptic: 'short',
      shake: { amplitude: 1, durationMs: 80 },
    });
    expect(impactForClearStep(firstClear(line(6)), 1)).toMatchObject({
      level: 3,
      source: 'match',
      sound: 'combo',
      haptic: 'short',
      shake: { amplitude: 2, durationMs: 100 },
    });
    expect(impactForClearStep(firstClear(lShape()), 1)).toMatchObject({
      level: 4,
      source: 'match',
      sound: 'combo',
      haptic: 'short',
      shake: { amplitude: 3, durationMs: 120 },
    });
    expect(impactForClearStep(firstClear(line(8)), 1)).toMatchObject({
      level: 5,
      source: 'match',
      sound: 'combo',
      haptic: 'short',
      shake: { amplitude: 4, durationMs: 150 },
    });
  });

  test('maps cascaded clears by clear phase', () => {
    const events: SessionEvent[] = [
      { type: 'match', cells: line(3), count: 3, kind: 'shield' },
      { type: 'clear', cells: line(3) },
      { type: 'fall' },
      { type: 'refill' },
      { type: 'match', cells: line(4, 1), count: 4, kind: 'ammo' },
      { type: 'clear', cells: line(4, 1) },
      { type: 'fall' },
      { type: 'refill' },
      { type: 'match', cells: line(4, 2), count: 4, kind: 'radar' },
      { type: 'clear', cells: line(4, 2) },
      { type: 'fall' },
      { type: 'refill' },
      { type: 'match', cells: line(4, 3), count: 4, kind: 'medal' },
      { type: 'clear', cells: line(4, 3) },
    ];

    expect(impactForClearStep(events, 5)).toMatchObject({
      level: 6,
      source: 'cascade',
      sound: 'combo',
      haptic: 'long',
      shake: { amplitude: 5, durationMs: 170 },
    });
    expect(impactForClearStep(events, 9)).toMatchObject({
      level: 7,
      source: 'cascade',
      sound: 'combo',
      haptic: 'long',
      shake: { amplitude: 6, durationMs: 190 },
    });
    expect(impactForClearStep(events, 13)).toMatchObject({
      level: 8,
      source: 'cascade',
      sound: 'combo',
      haptic: 'long',
      shake: { amplitude: 8, durationMs: 220 },
    });
  });

  test('maps power-up clears by cleared cell count', () => {
    expect(impactForClearStep([{ type: 'clear', cells: line(3) }], 0)).toMatchObject({
      level: 5,
      source: 'powerUp',
      sound: 'combo',
      haptic: 'short',
    });
    expect(impactForClearStep([{ type: 'clear', cells: line(6) }], 0)).toMatchObject({
      level: 7,
      source: 'powerUp',
      sound: 'combo',
      haptic: 'long',
    });
    expect(impactForClearStep([{ type: 'clear', cells: line(9) }], 0)).toMatchObject({
      level: 8,
      source: 'powerUp',
      sound: 'combo',
      haptic: 'long',
    });
  });

  test('maps win finale to level nine', () => {
    expect(impactForWinFinale()).toMatchObject({
      level: 9,
      source: 'winFinale',
      sound: 'win',
      haptic: 'long',
      shake: { amplitude: 10, durationMs: 280 },
    });
  });
});

function firstClear(cells: Position[]): SessionEvent[] {
  return [
    { type: 'match', cells, count: cells.length, kind: 'shield' },
    { type: 'clear', cells },
  ];
}

function line(count: number, row = 0): Position[] {
  return Array.from({ length: count }, (_, col) => ({ row, col }));
}

function lShape(): Position[] {
  return [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 1, col: 0 },
  ];
}
