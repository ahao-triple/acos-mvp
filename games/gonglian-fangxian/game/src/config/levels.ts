import type { LevelConfig, NodeReward, PieceKind } from '../core/types';

const allPieces: PieceKind[] = ['shield', 'ammo', 'radar', 'medal', 'wrench', 'energy'];

export const CHAPTERS = [
  { id: 1, title: '前线集结', startLevel: 1, endLevel: 10 },
  { id: 2, title: '阵地修复', startLevel: 11, endLevel: 20 },
  { id: 3, title: '最终防线', startLevel: 21, endLevel: 30 },
] as const;

export const LEVEL_COUNT = 30;

export function chapterForLevel(levelId: number): typeof CHAPTERS[number] {
  return CHAPTERS.find((chapter) => levelId >= chapter.startLevel && levelId <= chapter.endLevel) ?? CHAPTERS[0];
}

export const levels: LevelConfig[] = [
  level(1, 18, [{ type: 'collect', kind: 'shield', count: 8 }], [], '收集护盾，完成第一段防线部署。'),
  level(2, 18, [{ type: 'collect', kind: 'ammo', count: 10 }], [], '补足弹药储备，为后续守线做准备。'),
  level(3, 20, [{ type: 'collect', kind: 'radar', count: 12 }], [], '启动雷达阵列，扩大前线预警范围。'),
  level(4, 20, [{ type: 'collect', kind: 'medal', count: 12 }], [], '收集勋章，鼓舞防线士气。'),
  level(5, 22, [{ type: 'collect', kind: 'wrench', count: 14 }], [], '收集扳手，准备抢修防御工事。'),
  level(6, 22, [{ type: 'clearBlocker', kind: 'sandbag', count: 4 }], [
    { row: 2, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 2, col: 4, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 4, blockerKind: 'sandbag', durability: 1 },
  ], '清理沙袋阻塞，让资源线路恢复畅通。'),
  level(7, 24, [
    { type: 'collect', kind: 'shield', count: 10 },
    { type: 'collect', kind: 'ammo', count: 10 },
  ], [], '同步补充护盾和弹药，稳定第一道防线。'),
  level(8, 24, [{ type: 'clearBlocker', kind: 'brokenDefense', count: 5 }], [
    { row: 1, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 2, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 4, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 3, blockerKind: 'brokenDefense', durability: 1 },
  ], '修复纵向破损防线，打通中路支援。'),
  level(9, 26, [
    { type: 'collect', kind: 'radar', count: 12 },
    { type: 'clearBlocker', kind: 'sandbag', count: 4 },
  ], [
    { row: 2, col: 1, blockerKind: 'sandbag', durability: 1 },
    { row: 2, col: 5, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 1, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 5, blockerKind: 'sandbag', durability: 1 },
  ], '边清路障边启动雷达，完成前线集结。'),
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
  ], '完成前线集结节点，修复两翼破损区域。', { bomb: 1 }),

  level(11, 24, [{ type: 'collect', kind: 'wrench', count: 16 }], [], '进入阵地修复阶段，优先收集维修工具。'),
  level(12, 24, [
    { type: 'collect', kind: 'shield', count: 12 },
    { type: 'collect', kind: 'radar', count: 12 },
  ], [], '同步恢复护盾和雷达，让阵地恢复感知能力。'),
  level(13, 25, [{ type: 'clearBlocker', kind: 'sandbag', count: 6 }], [
    { row: 1, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 1, col: 4, blockerKind: 'sandbag', durability: 1 },
    { row: 3, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 3, col: 4, blockerKind: 'sandbag', durability: 1 },
    { row: 5, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 5, col: 4, blockerKind: 'sandbag', durability: 1 },
  ], '清理成排沙袋，恢复阵地运输线。'),
  level(14, 25, [
    { type: 'collect', kind: 'ammo', count: 14 },
    { type: 'clearBlocker', kind: 'sandbag', count: 4 },
  ], [
    { row: 2, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 2, col: 3, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 3, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 4, blockerKind: 'sandbag', durability: 1 },
  ], '边清沙袋边补足弹药，压住敌方攻势。'),
  level(15, 26, [
    { type: 'collect', kind: 'medal', count: 16 },
    { type: 'collect', kind: 'wrench', count: 12 },
  ], [], '用维修和士气稳住阵地中心。'),
  level(16, 26, [{ type: 'clearBlocker', kind: 'brokenDefense', count: 7 }], [
    { row: 0, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 1, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 2, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 4, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 6, col: 3, blockerKind: 'brokenDefense', durability: 1 },
  ], '修复贯穿阵地的破损防线。'),
  level(17, 27, [
    { type: 'collect', kind: 'radar', count: 14 },
    { type: 'clearBlocker', kind: 'brokenDefense', count: 5 },
  ], [
    { row: 1, col: 1, blockerKind: 'brokenDefense', durability: 1 },
    { row: 1, col: 5, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 1, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 5, blockerKind: 'brokenDefense', durability: 1 },
  ], '恢复雷达盲区，修补关键防线节点。'),
  level(18, 27, [
    { type: 'collect', kind: 'shield', count: 16 },
    { type: 'collect', kind: 'ammo', count: 16 },
  ], [], '补强护盾与弹药，准备阵地反击。'),
  level(19, 28, [
    { type: 'collect', kind: 'wrench', count: 16 },
    { type: 'clearBlocker', kind: 'sandbag', count: 6 },
  ], [
    { row: 1, col: 0, blockerKind: 'sandbag', durability: 1 },
    { row: 1, col: 6, blockerKind: 'sandbag', durability: 1 },
    { row: 3, col: 1, blockerKind: 'sandbag', durability: 1 },
    { row: 3, col: 5, blockerKind: 'sandbag', durability: 1 },
    { row: 5, col: 0, blockerKind: 'sandbag', durability: 1 },
    { row: 5, col: 6, blockerKind: 'sandbag', durability: 1 },
  ], '清理外围沙袋，完成阵地抢修。'),
  level(20, 30, [
    { type: 'collect', kind: 'medal', count: 18 },
    { type: 'clearBlocker', kind: 'brokenDefense', count: 8 },
  ], [
    { row: 0, col: 2, blockerKind: 'brokenDefense', durability: 1 },
    { row: 0, col: 4, blockerKind: 'brokenDefense', durability: 1 },
    { row: 2, col: 0, blockerKind: 'brokenDefense', durability: 1 },
    { row: 2, col: 6, blockerKind: 'brokenDefense', durability: 1 },
    { row: 4, col: 0, blockerKind: 'brokenDefense', durability: 1 },
    { row: 4, col: 6, blockerKind: 'brokenDefense', durability: 1 },
    { row: 6, col: 2, blockerKind: 'brokenDefense', durability: 1 },
    { row: 6, col: 4, blockerKind: 'brokenDefense', durability: 1 },
  ], '完成阵地修复节点，守住外围缺口。', { suck: 1 }),

  level(21, 26, [
    { type: 'collect', kind: 'radar', count: 16 },
    { type: 'collect', kind: 'shield', count: 16 },
  ], [], '最终防线启动，先恢复侦测和护盾。'),
  level(22, 27, [
    { type: 'collect', kind: 'ammo', count: 18 },
    { type: 'clearBlocker', kind: 'sandbag', count: 6 },
  ], [
    { row: 2, col: 1, blockerKind: 'sandbag', durability: 1 },
    { row: 2, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 2, col: 4, blockerKind: 'sandbag', durability: 1 },
    { row: 2, col: 5, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 4, blockerKind: 'sandbag', durability: 1 },
  ], '补充弹药并清出最终防线射界。'),
  level(23, 28, [
    { type: 'collect', kind: 'wrench', count: 18 },
    { type: 'clearBlocker', kind: 'brokenDefense', count: 6 },
  ], [
    { row: 1, col: 1, blockerKind: 'brokenDefense', durability: 1 },
    { row: 1, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 1, col: 5, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 1, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 5, blockerKind: 'brokenDefense', durability: 1 },
  ], '修复上下两侧破损，避免防线被分割。'),
  level(24, 28, [
    { type: 'collect', kind: 'medal', count: 18 },
    { type: 'collect', kind: 'radar', count: 16 },
  ], [], '鼓舞士气并锁定敌方主攻方向。'),
  level(25, 29, [
    { type: 'collect', kind: 'shield', count: 20 },
    { type: 'clearBlocker', kind: 'sandbag', count: 8 },
  ], [
    { row: 0, col: 1, blockerKind: 'sandbag', durability: 1 },
    { row: 0, col: 5, blockerKind: 'sandbag', durability: 1 },
    { row: 2, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 2, col: 4, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 4, col: 4, blockerKind: 'sandbag', durability: 1 },
    { row: 6, col: 1, blockerKind: 'sandbag', durability: 1 },
    { row: 6, col: 5, blockerKind: 'sandbag', durability: 1 },
  ], '护盾补强和沙袋清理必须同步完成。'),
  level(26, 29, [
    { type: 'collect', kind: 'ammo', count: 20 },
    { type: 'collect', kind: 'wrench', count: 18 },
  ], [], '弹药和维修资源同时到位，准备最后防守。'),
  level(27, 30, [
    { type: 'clearBlocker', kind: 'brokenDefense', count: 9 },
  ], [
    { row: 0, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 1, col: 2, blockerKind: 'brokenDefense', durability: 1 },
    { row: 1, col: 4, blockerKind: 'brokenDefense', durability: 1 },
    { row: 2, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 1, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 5, blockerKind: 'brokenDefense', durability: 1 },
    { row: 4, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 2, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 4, blockerKind: 'brokenDefense', durability: 1 },
  ], '集中修复最终防线的核心破口。'),
  level(28, 30, [
    { type: 'collect', kind: 'radar', count: 18 },
    { type: 'clearBlocker', kind: 'sandbag', count: 8 },
  ], [
    { row: 1, col: 0, blockerKind: 'sandbag', durability: 1 },
    { row: 1, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 1, col: 4, blockerKind: 'sandbag', durability: 1 },
    { row: 1, col: 6, blockerKind: 'sandbag', durability: 1 },
    { row: 5, col: 0, blockerKind: 'sandbag', durability: 1 },
    { row: 5, col: 2, blockerKind: 'sandbag', durability: 1 },
    { row: 5, col: 4, blockerKind: 'sandbag', durability: 1 },
    { row: 5, col: 6, blockerKind: 'sandbag', durability: 1 },
  ], '清出雷达观察线，锁住最后进攻路线。'),
  level(29, 31, [
    { type: 'collect', kind: 'shield', count: 20 },
    { type: 'collect', kind: 'medal', count: 20 },
    { type: 'clearBlocker', kind: 'brokenDefense', count: 6 },
  ], [
    { row: 1, col: 1, blockerKind: 'brokenDefense', durability: 1 },
    { row: 1, col: 5, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 2, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 4, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 1, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 5, blockerKind: 'brokenDefense', durability: 1 },
  ], '最后总攻前，补齐护盾并鼓舞防线。'),
  level(30, 32, [
    { type: 'collect', kind: 'ammo', count: 22 },
    { type: 'collect', kind: 'wrench', count: 20 },
    { type: 'clearBlocker', kind: 'brokenDefense', count: 8 },
  ], [
    { row: 0, col: 0, blockerKind: 'brokenDefense', durability: 1 },
    { row: 0, col: 6, blockerKind: 'brokenDefense', durability: 1 },
    { row: 1, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 1, blockerKind: 'brokenDefense', durability: 1 },
    { row: 3, col: 5, blockerKind: 'brokenDefense', durability: 1 },
    { row: 5, col: 3, blockerKind: 'brokenDefense', durability: 1 },
    { row: 6, col: 0, blockerKind: 'brokenDefense', durability: 1 },
    { row: 6, col: 6, blockerKind: 'brokenDefense', durability: 1 },
  ], '完成最终防线，守住最后一波攻势。', { shuffle: 1 }),
];

function level(
  id: number,
  moves: number,
  targets: LevelConfig['targets'],
  blockers: LevelConfig['blockers'],
  briefing: string,
  nodeReward?: NodeReward,
): LevelConfig {
  const chapter = chapterForLevel(id);
  return {
    id,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    briefing,
    moves,
    width: 7,
    height: 7,
    piecePool: allPieces,
    targets,
    blockers,
    rewards: {
      coins: 50 + id * 5 + chapter.id * 15,
    },
    nodeReward,
  };
}
