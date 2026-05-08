import type { LevelConfig, PieceKind } from '../core/types';

const allPieces: PieceKind[] = ['shield', 'ammo', 'radar', 'medal', 'wrench'];

export const levels: LevelConfig[] = [
  level(1, 18, [{ type: 'collect', kind: 'shield', count: 8 }]),
  level(2, 18, [{ type: 'collect', kind: 'ammo', count: 10 }]),
  level(3, 20, [{ type: 'collect', kind: 'radar', count: 12 }]),
  level(4, 20, [{ type: 'collect', kind: 'medal', count: 12 }]),
  level(5, 22, [{ type: 'collect', kind: 'wrench', count: 14 }]),
  level(6, 22, [{ type: 'clearBlocker', kind: 'sandbag', count: 4 }], [
    { row: 2, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 2, col: 4, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 4, blockerKind: 'sandbag', durability: 1 },
  ]),
  level(7, 24, [
    { type: 'collect', kind: 'shield', count: 10 },
    { type: 'collect', kind: 'ammo', count: 10 },
  ]),
  level(8, 24, [{ type: 'clearBlocker', kind: 'brokenDefense', count: 5 }], [
    { row: 1, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 2, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 4, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 3, blockerKind: 'brokenDefense', durability: 1 },
  ]),
  level(9, 26, [
    { type: 'collect', kind: 'radar', count: 12 },
    { type: 'clearBlocker', kind: 'sandbag', count: 4 },
  ], [
    { row: 2, col: 1, blockerKind: 'sandbag', durability: 1 },
    { row: 2, col: 5, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 1, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 5, blockerKind: 'sandbag', durability: 1 },
  ]),
  level(10, 28, [
    { type: 'collect', kind: 'medal', count: 14 },
    { type: 'clearBlocker', kind: 'brokenDefense', count: 6 },
  ], [
    { row: 1, col: 1, blockerKind: 'brokenDefense', durability: 1 },
    { row: 1, col: 5, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 1, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 5, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 1, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 5, blockerKind: 'brokenDefense', durability: 1 },
  ]),
];

function level(
  id: number,
  moves: number,
  targets: LevelConfig['targets'],
  blockers: LevelConfig['blockers'] = [],
): LevelConfig {
  return {
    id,
    moves,
    width: 7,
    height: 7,
    piecePool: allPieces,
    targets,
    blockers,
    rewards: {
      coins: 50 + id * 10,
    },
  };
}
