# Campaign Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand 共联防线 into a 30-level, 3-chapter campaign with clearer pre-level briefing, richer win/loss results, lightweight rewards, and modular Canvas rendering.

**Architecture:** Keep the existing TypeScript + Canvas game loop and core match logic. Add campaign metadata to level config, route the controller through a new briefing screen before play, add win-summary state for node rewards and one-time coin doubling, then split renderer responsibilities into theme, UI primitives, and screen modules.

**Tech Stack:** TypeScript, Vite, Vitest, jsdom, Canvas 2D, existing platform adapters.

---

## File Structure

- Modify `game/src/core/types.ts`: add campaign metadata and node reward types to `LevelConfig`.
- Modify `game/src/config/levels.ts`: expand from 10 to 30 levels, export chapter metadata and lookup helpers.
- Modify `game/src/app/save.ts`: clamp repaired saves to the new 30-level cap.
- Modify `game/src/app/rewards.ts`: add a reusable coin-doubling rewarded-ad helper.
- Modify `game/src/app/controller.ts`: add `briefing` and `supplies` screens, pending level selection, chapter progress, win summary, node rewards, and one-time double reward action.
- Create `game/src/render/theme.ts`: target labels, piece colors, chapter themes, target formatting helpers.
- Create `game/src/render/uiPrimitives.ts`: draw text, panels, normal buttons, rewarded-video buttons, and the existing 38x28 ad icon.
- Create `game/src/render/menuScreen.ts`: draw the new campaign home screen and supplies panel.
- Create `game/src/render/levelsScreen.ts`: draw chapter-grouped level selection.
- Create `game/src/render/briefingScreen.ts`: draw the pre-level briefing screen.
- Create `game/src/render/gameScreen.ts`: draw game HUD, board, cells, pieces, targets, power-up buttons, and game effects.
- Create `game/src/render/resultScreen.ts`: draw win/loss result overlays.
- Modify `game/src/render/canvasRenderer.ts`: keep lifecycle, resize, pointer handling, background, presentation state, effects, and screen dispatch; delegate UI drawing to modules.
- Modify tests under `game/src/test`: add campaign config, save cap, controller flow/reward, rewards, and renderer tests.

---

### Task 1: Campaign Metadata And 30-Level Config

**Files:**
- Modify: `game/src/core/types.ts`
- Modify: `game/src/config/levels.ts`
- Create: `game/src/test/levels.test.ts`

- [ ] **Step 1: Write failing level metadata tests**

Create `game/src/test/levels.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
pnpm vitest run src/test/levels.test.ts
```

Expected: FAIL because `CHAPTERS`, `LEVEL_COUNT`, `chapterForLevel`, `chapterId`, `chapterTitle`, `briefing`, and `nodeReward` do not exist yet.

- [ ] **Step 3: Extend core types**

In `game/src/core/types.ts`, add a reward type and metadata fields:

```ts
export type NodeReward = Partial<Record<PowerUpType, number>>;

export interface LevelConfig {
  id: number;
  chapterId: number;
  chapterTitle: string;
  briefing: string;
  moves: number;
  width: number;
  height: number;
  piecePool: PieceKind[];
  targets: TargetConfig[];
  blockers: Array<Position & { blockerKind: BlockerKind; durability: number }>;
  rewards: {
    coins: number;
  };
  nodeReward?: NodeReward;
}
```

- [ ] **Step 4: Replace the level config with chapter helpers and 30 levels**

In `game/src/config/levels.ts`, keep `allPieces`, export chapter helpers, and change the `level` helper signature:

```ts
import type { LevelConfig, NodeReward, PieceKind } from '../core/types';

const allPieces: PieceKind[] = ['shield', 'ammo', 'radar', 'medal', 'wrench'];

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
```

- [ ] **Step 5: Run level tests and then full current tests**

Run:

```bash
pnpm vitest run src/test/levels.test.ts
pnpm test
```

Expected: `levels.test.ts` passes. Full suite may now fail in save tests because save repair still clamps highest unlocked level to 10; that is addressed in Task 2.

- [ ] **Step 6: Commit**

```bash
git add game/src/core/types.ts game/src/config/levels.ts game/src/test/levels.test.ts
git commit -m "feat: add campaign level metadata"
```

---

### Task 2: Save Cap And Campaign Progress Helpers

**Files:**
- Modify: `game/src/app/save.ts`
- Create: `game/src/app/campaign.ts`
- Create: `game/src/test/campaign.test.ts`
- Modify: `game/src/test/save.test.ts`

- [ ] **Step 1: Write failing campaign helper tests**

Create `game/src/test/campaign.test.ts`:

```ts
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
```

- [ ] **Step 2: Add failing save cap assertion**

In `game/src/test/save.test.ts`, add:

```ts
  test('repairs highest unlocked level up to campaign level count', () => {
    const save = repairSaveData({
      highestUnlockedLevel: 30,
    });

    expect(save.highestUnlockedLevel).toBe(30);
  });
```

- [ ] **Step 3: Run focused tests and verify failure**

Run:

```bash
pnpm vitest run src/test/campaign.test.ts src/test/save.test.ts
```

Expected: FAIL because `app/campaign.ts` does not exist and `repairSaveData` still clamps to 10.

- [ ] **Step 4: Implement campaign helpers**

Create `game/src/app/campaign.ts`:

```ts
import { CHAPTERS, levels } from '../config/levels';
import type { GameSession, LevelConfig, NodeReward, PowerUpType, TargetConfig } from '../core/types';

export interface ChapterProgress {
  id: number;
  title: string;
  startLevel: number;
  endLevel: number;
  unlockedCount: number;
  completedCount: number;
  current: boolean;
}

const targetLabels: Record<TargetConfig['kind'], string> = {
  shield: '护盾',
  ammo: '弹药',
  radar: '雷达',
  medal: '勋章',
  wrench: '扳手',
  sandbag: '沙袋',
  brokenDefense: '破损防线',
};

const rewardLabels: Record<PowerUpType, string> = {
  bomb: '炸开',
  suck: '吸走',
  shuffle: '重排',
};

export function levelById(levelId: number): LevelConfig {
  return levels.find((level) => level.id === levelId) ?? levels[0];
}

export function chapterProgressForSave(highestUnlockedLevel: number): ChapterProgress[] {
  return CHAPTERS.map((chapter) => {
    const unlockedCount = Math.max(0, Math.min(highestUnlockedLevel, chapter.endLevel) - chapter.startLevel + 1);
    const completedCount = Math.max(0, Math.min(highestUnlockedLevel - 1, chapter.endLevel) - chapter.startLevel + 1);
    return {
      id: chapter.id,
      title: chapter.title,
      startLevel: chapter.startLevel,
      endLevel: chapter.endLevel,
      unlockedCount,
      completedCount,
      current: highestUnlockedLevel >= chapter.startLevel && highestUnlockedLevel <= chapter.endLevel,
    };
  });
}

export function targetProgressText(target: TargetConfig, progress: Record<string, number>): string {
  return `${targetLabels[target.kind]} ${progress[target.kind] ?? 0}/${target.count}`;
}

export function remainingTargetsText(session: GameSession): string {
  return session.targets.map((target) => targetProgressText(target, session.targetProgress)).join('  ');
}

export function describeNodeReward(reward: NodeReward | undefined): string {
  if (!reward) {
    return '';
  }

  return (Object.entries(reward) as Array<[PowerUpType, number]>)
    .filter(([, count]) => count > 0)
    .map(([item, count]) => `${rewardLabels[item]} x${count}`)
    .join('  ');
}
```

- [ ] **Step 5: Update save repair cap**

In `game/src/app/save.ts`, import `LEVEL_COUNT` and use it:

```ts
import { LEVEL_COUNT } from '../config/levels';
```

Change the repaired field:

```ts
highestUnlockedLevel: readNumber(input.highestUnlockedLevel, defaults.highestUnlockedLevel, 1, LEVEL_COUNT),
```

- [ ] **Step 6: Run focused and full tests**

Run:

```bash
pnpm vitest run src/test/campaign.test.ts src/test/save.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add game/src/app/campaign.ts game/src/app/save.ts game/src/test/campaign.test.ts game/src/test/save.test.ts
git commit -m "feat: add campaign progress helpers"
```

---

### Task 3: Briefing Flow And Controller Campaign State

**Files:**
- Modify: `game/src/app/controller.ts`
- Modify: `game/src/test/controller.test.ts`

- [ ] **Step 1: Write failing controller flow tests**

Append these tests to `game/src/test/controller.test.ts`:

```ts
  test('start opens a briefing for the highest unlocked level before play', async () => {
    const controller = new GameController(mockPlatform({
      storedSave: {
        version: 1,
        highestUnlockedLevel: 12,
        coins: 0,
        items: { extraMoves: 0, bomb: 0, suck: 0, shuffle: 0 },
        desktopRewardClaimed: false,
        favoriteRewardClaimed: false,
        sidebarRewardClaimed: false,
        soundEnabled: true,
        musicEnabled: true,
      },
    }));

    await controller.dispatch({ type: 'start' });

    expect(controller.getViewState().screen).toBe('briefing');
    expect(controller.getViewState().pendingLevel?.id).toBe(12);
    expect(controller.getViewState().pendingLevel?.chapterTitle).toBe('阵地修复');

    await controller.dispatch({ type: 'beginLevel' });

    expect(controller.getViewState().screen).toBe('playing');
    expect(controller.getViewState().session?.levelId).toBe(12);
  });

  test('locked level selection stays on levels screen with feedback', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'openLevels' });
    await controller.dispatch({ type: 'selectLevel', levelId: 5 });

    expect(controller.getViewState().screen).toBe('levels');
    expect(controller.getViewState().feedback).toContain('尚未解锁');
    expect(controller.getViewState().pendingLevel).toBeNull();
  });

  test('view state exposes chapter progress for rendering', () => {
    const controller = new GameController(mockPlatform());

    expect(controller.getViewState().chapterProgress.map((chapter) => chapter.title)).toEqual([
      '前线集结',
      '阵地修复',
      '最终防线',
    ]);
  });
```

Update the local `mockPlatform` helper in this test file so it can accept `storedSave`:

```ts
function mockPlatform(
  options: {
    ad?: { status: 'success' | 'failed' | 'cancelled' | 'unsupported' };
    desktop?: { status: 'success' | 'failed' | 'cancelled' | 'unsupported' };
    storedSave?: unknown;
  } = {},
): PlatformAdapter {
  let saved = options.storedSave ? JSON.stringify(options.storedSave) : null;
  return {
    name: 'test',
    storage: {
      getItem() {
        return saved;
      },
      setItem(_key, value) {
        saved = value;
      },
      removeItem() {
        saved = null;
      },
    },
    async showRewardedAd() {
      return options.ad ?? { status: 'unsupported' };
    },
    async addDesktopShortcut() {
      return options.desktop ?? { status: 'unsupported' };
    },
    async showFavoriteGuide() {
      return { status: 'unsupported' };
    },
    async didEnterFromSidebar() {
      return false;
    },
    async requestSidebarEntry() {
      return { status: 'unsupported' };
    },
    getLaunchContext() {
      return { isSidebarEntry: false };
    },
  };
}
```

- [ ] **Step 2: Run controller tests and verify failure**

Run:

```bash
pnpm vitest run src/test/controller.test.ts
```

Expected: FAIL because `briefing`, `beginLevel`, `pendingLevel`, and `chapterProgress` are not implemented.

- [ ] **Step 3: Add controller view state and action types**

In `game/src/app/controller.ts`, import helpers:

```ts
import { chapterProgressForSave, levelById, type ChapterProgress } from './campaign';
import type { LevelConfig, NodeReward } from '../core/types';
```

Extend `Screen` and `AppAction`:

```ts
export type Screen = 'menu' | 'levels' | 'briefing' | 'playing' | 'paused' | 'won' | 'lost' | 'settings' | 'supplies';

export type AppAction =
  | { type: 'start' }
  | { type: 'openLevels' }
  | { type: 'openSettings' }
  | { type: 'openSupplies' }
  | { type: 'closeModal' }
  | { type: 'selectLevel'; levelId: number }
  | { type: 'beginLevel' }
  | { type: 'tapCell'; position: Position }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'home' }
  | { type: 'retry' }
  | { type: 'nextLevel' }
  | { type: 'extraMovesAd' }
  | { type: 'doubleWinReward' }
  | { type: 'claimAdItemReward'; item: InventoryItem }
  | { type: 'usePowerUp'; item: PowerUpType }
  | { type: 'desktopReward' }
  | { type: 'favoriteReward' }
  | { type: 'sidebarReward' }
  | { type: 'toggleSound' }
  | { type: 'toggleMusic' };
```

Add summary interfaces:

```ts
export interface WinSummary {
  levelId: number;
  chapterTitle: string;
  baseCoins: number;
  nodeReward: NodeReward | null;
  nextLevelId: number | null;
  doubled: boolean;
}
```

Extend `AppViewState`:

```ts
pendingLevel: LevelConfig | null;
winSummary: WinSummary | null;
chapterProgress: ChapterProgress[];
```

- [ ] **Step 4: Add controller fields and view state values**

Add fields:

```ts
private pendingLevelId: number | null = null;
private winSummary: WinSummary | null = null;
```

Return in `getViewState()`:

```ts
pendingLevel: this.pendingLevelId ? levelById(this.pendingLevelId) : null,
winSummary: this.winSummary,
chapterProgress: chapterProgressForSave(this.save.highestUnlockedLevel),
```

- [ ] **Step 5: Implement briefing actions**

In `dispatch`, change action behavior:

```ts
case 'start':
  this.openBriefing(this.save.highestUnlockedLevel);
  break;
case 'openSupplies':
  this.screen = 'supplies';
  break;
case 'closeModal':
  this.screen = this.session?.status === 'playing' ? 'playing' : 'menu';
  break;
case 'selectLevel':
  this.openBriefing(action.levelId);
  break;
case 'beginLevel':
  this.beginPendingLevel();
  break;
case 'retry':
  this.openBriefing(this.session?.levelId ?? this.pendingLevelId ?? this.save.highestUnlockedLevel);
  break;
case 'nextLevel':
  this.openBriefing(Math.min(levels.length, (this.session?.levelId ?? this.winSummary?.levelId ?? 1) + 1));
  break;
```

Add methods:

```ts
private openBriefing(levelId: number): void {
  const level = levelById(levelId);
  if (level.id > this.save.highestUnlockedLevel) {
    this.feedback = '该关卡尚未解锁。';
    this.screen = 'levels';
    return;
  }

  this.pendingLevelId = level.id;
  this.session = null;
  this.activePowerUp = null;
  this.winSummary = null;
  this.screen = 'briefing';
}

private beginPendingLevel(): void {
  this.startLevel(this.pendingLevelId ?? this.save.highestUnlockedLevel);
}
```

Update `startLevel`:

```ts
private startLevel(levelId: number): void {
  const level = levelById(levelId);
  this.seed += 1;
  this.pendingLevelId = level.id;
  this.winSummary = null;
  this.session = createSession(level, this.seed);
  this.screen = 'playing';
}
```

- [ ] **Step 6: Run focused and full tests**

Run:

```bash
pnpm vitest run src/test/controller.test.ts
pnpm test
```

Expected: all tests pass except tests intentionally added in later tasks do not exist yet.

- [ ] **Step 7: Commit**

```bash
git add game/src/app/controller.ts game/src/test/controller.test.ts
git commit -m "feat: add campaign briefing flow"
```

---

### Task 4: Node Rewards And Win Coin Doubling

**Files:**
- Modify: `game/src/app/rewards.ts`
- Modify: `game/src/app/controller.ts`
- Modify: `game/src/test/rewards.test.ts`
- Modify: `game/src/test/controller.test.ts`

- [ ] **Step 1: Write failing reward helper tests**

Add to `game/src/test/rewards.test.ts`:

```ts
import { claimDoubleCoinsReward } from '../app/rewards';

  test('completed rewarded video doubles win coins', async () => {
    const save = createDefaultSave();
    save.coins = 100;

    const outcome = await claimDoubleCoinsReward(save, 80, platform({ ad: { status: 'success' } }));

    expect(outcome.granted).toBe(true);
    expect(outcome.save.coins).toBe(180);
    expect(outcome.feedback).toContain('奖励已翻倍');
  });

  test('cancelled double reward video does not add coins', async () => {
    const save = createDefaultSave();
    save.coins = 100;

    const outcome = await claimDoubleCoinsReward(save, 80, platform({ ad: { status: 'cancelled' } }));

    expect(outcome.granted).toBe(false);
    expect(outcome.save.coins).toBe(100);
    expect(outcome.feedback).toContain('未完整观看');
  });

  test('failed double reward video grants fallback coins', async () => {
    const save = createDefaultSave();
    save.coins = 100;

    const outcome = await claimDoubleCoinsReward(save, 80, platform({ ad: { status: 'failed' } }));

    expect(outcome.granted).toBe(true);
    expect(outcome.save.coins).toBe(180);
    expect(outcome.feedback).toContain('已直接发放');
  });
```

- [ ] **Step 2: Write failing controller reward tests**

Add to `game/src/test/controller.test.ts`:

```ts
  test('chapter finale grants node reward when won', async () => {
    const controller = new GameController(mockPlatform());
    const winningSession = {
      levelId: 10,
      board: [],
      movesLeft: 1,
      targetProgress: { medal: 14, brokenDefense: 6 },
      targets: [
        { type: 'collect' as const, kind: 'medal' as const, count: 14 },
        { type: 'clearBlocker' as const, kind: 'brokenDefense' as const, count: 6 },
      ],
      selectedCell: null,
      comboCount: 0,
      status: 'won' as const,
      lastEvents: [{ type: 'win' as const }],
      piecePool: ['shield' as const, 'ammo' as const, 'radar' as const, 'medal' as const, 'wrench' as const],
    };

    await controller.dispatch({ type: 'start' });
    forcePrivateSession(controller, winningSession);
    forcePrivateHandleWin(controller, winningSession);

    expect(controller.getViewState().screen).toBe('won');
    expect(controller.getViewState().save.items.bomb).toBe(1);
    expect(controller.getViewState().winSummary).toMatchObject({
      levelId: 10,
      baseCoins: expect.any(Number),
      nodeReward: { bomb: 1 },
      nextLevelId: 11,
      doubled: false,
    });
  });

  test('double win reward can only be claimed once', async () => {
    const controller = new GameController(mockPlatform({ ad: { status: 'success' } }));
    const summary = {
      levelId: 1,
      chapterTitle: '前线集结',
      baseCoins: 70,
      nodeReward: null,
      nextLevelId: 2,
      doubled: false,
    };

    forcePrivateWinSummary(controller, summary);
    await controller.dispatch({ type: 'doubleWinReward' });
    const afterFirst = controller.getViewState().save.coins;
    await controller.dispatch({ type: 'doubleWinReward' });

    expect(afterFirst).toBe(70);
    expect(controller.getViewState().save.coins).toBe(afterFirst);
    expect(controller.getViewState().feedback).toContain('已领取');
  });
```

Add test-only helpers at the bottom of `controller.test.ts`:

```ts
function forcePrivateSession(controller: GameController, session: unknown): void {
  (controller as unknown as { session: unknown }).session = session;
}

function forcePrivateHandleWin(controller: GameController, session: unknown): void {
  (controller as unknown as { handleWin(session: unknown): void }).handleWin(session);
}

function forcePrivateWinSummary(controller: GameController, summary: unknown): void {
  (controller as unknown as { winSummary: unknown; screen: string }).winSummary = summary;
  (controller as unknown as { screen: string }).screen = 'won';
}
```

- [ ] **Step 3: Run focused tests and verify failure**

Run:

```bash
pnpm vitest run src/test/rewards.test.ts src/test/controller.test.ts
```

Expected: FAIL because `claimDoubleCoinsReward`, node reward handling, and `doubleWinReward` are not implemented.

- [ ] **Step 4: Add coin-doubling reward helper**

In `game/src/app/rewards.ts`, export:

```ts
export async function claimDoubleCoinsReward(save: SaveData, coins: number, platform: PlatformAdapter): Promise<SaveRewardOutcome> {
  const result = await platform.showRewardedAd('reward');
  debugLog('rewarded_ad_result', {
    reason: 'double_win_coins',
    coins,
    status: result.status,
    fallbackGrant: shouldGrantAdFallback(result),
    message: result.message ?? null,
  });

  if (result.status !== 'success' && !shouldGrantAdFallback(result)) {
    return {
      granted: false,
      feedback: adFeedback(result),
      save,
    };
  }

  return {
    granted: true,
    feedback: result.status === 'success' ? '奖励已翻倍。' : adFallbackRewardFeedback(result, '翻倍金币'),
    save: {
      ...save,
      coins: save.coins + coins,
    },
  };
}
```

- [ ] **Step 5: Apply node rewards in controller win handling**

In `game/src/app/controller.ts`, import `claimDoubleCoinsReward` and add helper:

```ts
import { claimAdItemReward, claimDesktopReward, claimDoubleCoinsReward, claimFavoriteReward, claimSidebarReward, requestExtraMoves, type InventoryItem } from './rewards';
```

Add:

```ts
private addNodeReward(save: SaveData, reward: NodeReward | undefined): SaveData {
  if (!reward) {
    return save;
  }

  return {
    ...save,
    items: {
      ...save.items,
      bomb: save.items.bomb + (reward.bomb ?? 0),
      suck: save.items.suck + (reward.suck ?? 0),
      shuffle: save.items.shuffle + (reward.shuffle ?? 0),
    },
  };
}
```

Update `handleWin`:

```ts
private handleWin(session: GameSession): void {
  const level = levelById(session.levelId);
  const baseCoins = level.rewards.coins;
  const nextHighest = Math.min(levels.length, Math.max(this.save.highestUnlockedLevel, session.levelId + 1));
  const nextLevelId = session.levelId < levels.length ? session.levelId + 1 : null;
  const rewardSave = this.addNodeReward(
    {
      ...this.save,
      highestUnlockedLevel: nextHighest,
      coins: this.save.coins + baseCoins,
    },
    level.nodeReward,
  );

  this.updateSave(rewardSave);
  this.winSummary = {
    levelId: session.levelId,
    chapterTitle: level.chapterTitle,
    baseCoins,
    nodeReward: level.nodeReward ?? null,
    nextLevelId,
    doubled: false,
  };
  this.screen = 'won';
}
```

- [ ] **Step 6: Implement double reward action**

In `dispatch`:

```ts
case 'doubleWinReward':
  await this.doubleWinReward();
  break;
```

Add:

```ts
private async doubleWinReward(): Promise<void> {
  if (!this.winSummary || this.screen !== 'won') {
    this.feedback = '通关后才能领取翻倍奖励。';
    this.emitAudio('invalid');
    return;
  }

  if (this.winSummary.doubled) {
    this.feedback = '翻倍奖励已领取。';
    this.emitAudio('invalid');
    return;
  }

  const outcome = await claimDoubleCoinsReward(this.save, this.winSummary.baseCoins, this.platform);
  this.updateSave(outcome.save);
  this.feedback = outcome.feedback;
  this.emitAudio(outcome.granted ? 'reward' : 'invalid');
  if (outcome.granted) {
    this.winSummary = { ...this.winSummary, doubled: true };
  }
}
```

- [ ] **Step 7: Run focused and full tests**

Run:

```bash
pnpm vitest run src/test/rewards.test.ts src/test/controller.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add game/src/app/rewards.ts game/src/app/controller.ts game/src/test/rewards.test.ts game/src/test/controller.test.ts
git commit -m "feat: add campaign win rewards"
```

---

### Task 5: Theme And UI Primitive Extraction

**Files:**
- Create: `game/src/render/theme.ts`
- Create: `game/src/render/uiPrimitives.ts`
- Modify: `game/src/render/canvasRenderer.ts`
- Modify: `game/src/test/canvasRenderer.test.ts`

- [ ] **Step 1: Write failing theme and primitive tests**

Update `game/src/test/canvasRenderer.test.ts` imports:

```ts
import { targetLabel, targetProgressText } from '../render/theme';
import { drawAdButton, drawButton } from '../render/uiPrimitives';
```

Replace private button tests with exported primitive tests:

```ts
  test('formats level targets with player-facing Chinese labels', () => {
    expect(targetLabel('shield')).toBe('护盾');
    expect(targetProgressText({ type: 'collect', kind: 'shield', count: 8 }, { shield: 3 })).toBe('护盾 3/8');
    expect(targetProgressText({ type: 'clearBlocker', kind: 'sandbag', count: 4 }, { sandbag: 1 })).toBe('沙袋 1/4');
  });

  test('centers regular button text vertically through UI primitives', () => {
    const { ctx, hitAreas } = createRecordingUi();

    drawButton({ ctx, hitAreas, pressedButton: null }, 10, 20, 120, 50, '继续', { type: 'start' });

    expect(ctx.fillTexts.find((entry) => entry.text === '继续')).toMatchObject({
      x: 70,
      y: 45,
      align: 'center',
      baseline: 'middle',
    });
    expect(hitAreas).toHaveLength(1);
  });

  test('lays out rewarded-video button icon and label without overlap through UI primitives', () => {
    const { ctx, hitAreas } = createRecordingUi();

    drawAdButton({ ctx, hitAreas, pressedButton: null }, 60, 1148, 190, 70, '看广告炸开', { type: 'start' });

    const label = ctx.fillTexts.find((entry) => entry.text === '看广告炸开');
    const icon = ctx.translates.find((entry) => entry.x === 60 + 190 * 0.12);
    expect(label).toMatchObject({
      y: 1183,
      align: 'left',
      baseline: 'middle',
    });
    expect(icon).toBeDefined();
    expect(label?.x).toBeGreaterThan((icon?.x ?? 0) + 38);
    expect(hitAreas).toHaveLength(1);
  });
```

Add helper:

```ts
function createRecordingUi(): { ctx: RecordingContext; hitAreas: Array<{ x: number; y: number; width: number; height: number; action: { type: 'start' } }> } {
  return {
    ctx: createRecordingContext(),
    hitAreas: [],
  };
}
```

- [ ] **Step 2: Run renderer tests and verify failure**

Run:

```bash
pnpm vitest run src/test/canvasRenderer.test.ts
```

Expected: FAIL because `render/theme.ts` and `render/uiPrimitives.ts` do not exist.

- [ ] **Step 3: Create theme module**

Create `game/src/render/theme.ts`:

```ts
import type { BlockerKind, PieceKind, TargetConfig } from '../core/types';

export const pieceColors: Record<PieceKind, string> = {
  shield: '#2f80ed',
  ammo: '#27ae60',
  radar: '#9b51e0',
  medal: '#f2c94c',
  wrench: '#eb5757',
};

export const targetLabels: Record<PieceKind | BlockerKind, string> = {
  shield: '护盾',
  ammo: '弹药',
  radar: '雷达',
  medal: '勋章',
  wrench: '扳手',
  sandbag: '沙袋',
  brokenDefense: '破损防线',
};

export interface ChapterTheme {
  top: string;
  middle: string;
  bottom: string;
  accent: string;
}

export const chapterThemes: Record<number, ChapterTheme> = {
  1: { top: '#123526', middle: '#2d4d4e', bottom: '#16243a', accent: '#d1fae5' },
  2: { top: '#263947', middle: '#42566a', bottom: '#1d2a3d', accent: '#bfdbfe' },
  3: { top: '#3a2434', middle: '#57405c', bottom: '#221827', accent: '#fde68a' },
};

export function targetLabel(kind: PieceKind | BlockerKind): string {
  return targetLabels[kind];
}

export function targetProgressText(target: TargetConfig, progress: Record<string, number>): string {
  return `${targetLabel(target.kind)} ${progress[target.kind] ?? 0}/${target.count}`;
}

export function chapterTheme(chapterId: number | undefined): ChapterTheme {
  return chapterThemes[chapterId ?? 1] ?? chapterThemes[1];
}
```

- [ ] **Step 4: Create UI primitives module**

Create `game/src/render/uiPrimitives.ts` by moving existing button/text/panel/ad icon helpers from `CanvasRenderer` into exported functions:

```ts
import type { AppAction } from '../app/controller';

export interface HitArea {
  x: number;
  y: number;
  width: number;
  height: number;
  action: AppAction;
}

export interface PressedButton {
  key: string;
  untilMs: number;
}

export interface UiRenderContext {
  ctx: CanvasRenderingContext2D;
  hitAreas: HitArea[];
  pressedButton: PressedButton | null;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign): void {
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export function drawSmallText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  drawText(ctx, text, x, y, 26, '#f8fafc', 'center');
}

export function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  ctx.fillStyle = 'rgba(15,23,42,0.72)';
  roundRect(ctx, x, y, width, height, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.56)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawButton(ui: UiRenderContext, x: number, y: number, width: number, height: number, label: string, action: AppAction): void {
  drawButtonBase(ui, x, y, width, height, action, () => {
    drawText(ui.ctx, label, x + width / 2, y + height / 2, 26, '#111827', 'center');
  });
}

export function drawAdButton(ui: UiRenderContext, x: number, y: number, width: number, height: number, label: string, action: AppAction): void {
  drawButtonBase(ui, x, y, width, height, action, () => {
    const iconHeight = nearestMultipleOfFour(height * 0.4);
    const iconWidth = iconHeight * (38 / 28);
    const iconX = x + width * 0.12;
    const iconY = y + (height - iconHeight) / 2;
    drawAdVideoIcon(ui.ctx, iconX, iconY, iconWidth, iconHeight, '#111827');
    drawText(ui.ctx, label, iconX + iconWidth + 14, y + height / 2, 22, '#111827', 'left');
  });
}

export function drawButtonBase(ui: UiRenderContext, x: number, y: number, width: number, height: number, action: AppAction, drawContent: () => void): void {
  const key = actionKey(action);
  const pressed = ui.pressedButton?.key === key && ui.pressedButton.untilMs > performance.now();

  ui.ctx.save();
  if (pressed) {
    ui.ctx.translate(x + width / 2, y + height / 2);
    ui.ctx.scale(0.96, 0.96);
    ui.ctx.translate(-(x + width / 2), -(y + height / 2));
  }
  ui.ctx.fillStyle = '#f8fafc';
  roundRect(ui.ctx, x, y, width, height, 8);
  ui.ctx.fill();
  ui.ctx.strokeStyle = '#111827';
  ui.ctx.lineWidth = 3;
  ui.ctx.stroke();
  drawContent();
  ui.ctx.restore();

  ui.hitAreas.push({ x, y, width, height, action });
}

export function actionKey(action: AppAction): string {
  return JSON.stringify(action);
}

export function drawAdVideoIcon(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string): void {
  const py = (value: number) => 28 - value;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / 38, height / 28);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, py(22.790697));
  ctx.bezierCurveTo(0, py(25.667715), 2.306872, py(28), 5.152542, py(28));
  ctx.lineTo(25.118643, py(28));
  ctx.bezierCurveTo(27.964314, py(28), 30.271185, py(25.667715), 30.271185, py(22.790697));
  ctx.lineTo(30.271185, py(21.971283));
  ctx.bezierCurveTo(30.271185, py(21.510889), 30.735935, py(21.195894), 31.163574, py(21.366449));
  ctx.lineTo(34.478329, py(22.688473));
  ctx.bezierCurveTo(36.168919, py(23.362732), 38, py(22.102938), 38, py(20.265535));
  ctx.lineTo(38, py(7.788822));
  ctx.bezierCurveTo(38, py(5.936855), 36.142109, py(4.676512), 34.447056, py(5.378595));
  ctx.lineTo(31.17153, py(6.73531));
  ctx.bezierCurveTo(30.742785, py(6.912895), 30.271185, py(6.597778), 30.271185, py(6.133711));
  ctx.lineTo(30.271185, py(5.209301));
  ctx.bezierCurveTo(30.271185, py(2.332283), 27.964314, py(0), 25.118643, py(0));
  ctx.lineTo(5.152542, py(0));
  ctx.bezierCurveTo(2.306871, py(0), 0, py(2.332283), 0, py(5.209301));
  ctx.lineTo(0, py(22.790697));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(20.621685, py(11.820709));
  ctx.bezierCurveTo(22.204817, py(12.847475), 22.204819, py(15.164505), 20.621687, py(16.191273));
  ctx.lineTo(14.970669, py(19.856339));
  ctx.bezierCurveTo(13.237776, py(20.980234), 10.948714, py(19.736496), 10.948714, py(17.671053));
  ctx.lineTo(10.948714, py(10.340927));
  ctx.bezierCurveTo(10.948714, py(8.275482), 13.237773, py(7.031748), 14.970665, py(8.155643));
  ctx.lineTo(20.621685, py(11.820709));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function nearestMultipleOfFour(value: number): number {
  return Math.max(4, Math.round(value / 4) * 4);
}
```

- [ ] **Step 5: Update CanvasRenderer imports and remove duplicated helpers**

In `canvasRenderer.ts`, import:

```ts
import { actionKey, drawAdButton, drawButton, drawPanel, drawSmallText, drawText, roundRect, type HitArea, type PressedButton } from './uiPrimitives';
import { pieceColors, targetProgressText } from './theme';
```

Replace `this.drawButton(...)` with `drawButton(this.ui(), ...)`, `this.drawAdButton(...)` with `drawAdButton(this.ui(), ...)`, `this.drawText(...)` with `drawText(this.ctx, ...)`, and `this.drawPanel(...)` with `drawPanel(this.ctx, ...)`.

Add a private helper:

```ts
private ui() {
  return {
    ctx: this.ctx,
    hitAreas: this.hitAreas,
    pressedButton: this.pressedButton,
  };
}
```

Change `pressedButton` type:

```ts
private pressedButton: PressedButton | null = null;
```

Update `drawTargets`:

```ts
private drawTargets(session: AppViewState['session']): void {
  if (!session) return;
  const text = session.targets.map((target) => targetProgressText(target, session.targetProgress)).join('  ');
  drawText(this.ctx, text, 375, 198, 24, '#d1fae5', 'center');
}
```

Remove local `targetLabels`, `pieceColors`, `actionKey`, `drawAdVideoIcon`, `drawButton`, `drawAdButton`, `drawButtonBase`, `drawPanel`, `drawText`, `drawSmallText`, `nearestMultipleOfFour`, and `roundRect` definitions after their usages are migrated.

- [ ] **Step 6: Run renderer tests and full tests**

Run:

```bash
pnpm vitest run src/test/canvasRenderer.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add game/src/render/theme.ts game/src/render/uiPrimitives.ts game/src/render/canvasRenderer.ts game/src/test/canvasRenderer.test.ts
git commit -m "refactor: extract canvas UI primitives"
```

---

### Task 6: Modular Campaign Screens And Final Rendering

**Files:**
- Create: `game/src/render/menuScreen.ts`
- Create: `game/src/render/levelsScreen.ts`
- Create: `game/src/render/briefingScreen.ts`
- Create: `game/src/render/gameScreen.ts`
- Create: `game/src/render/resultScreen.ts`
- Modify: `game/src/render/canvasRenderer.ts`
- Modify: `game/src/test/canvasRenderer.test.ts`

- [ ] **Step 1: Write failing render smoke tests for new screens**

Add to `game/src/test/canvasRenderer.test.ts`:

```ts
  test('renders campaign home progress text', () => {
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);

    renderer.render();

    const text = ctx.fillTexts.map((entry) => entry.text).join('\n');
    expect(text).toContain('前线集结');
    expect(text).toContain('1/30');
    expect(text).toContain('继续作战');
  });

  test('renders briefing screen with objective and start action', async () => {
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);

    await controller.dispatch({ type: 'start' });
    renderer.render();

    const text = ctx.fillTexts.map((entry) => entry.text).join('\n');
    expect(text).toContain('作战简报');
    expect(text).toContain('开始作战');
    expect(text).toContain('护盾 0/8');
  });

  test('renders win result with coin doubling action', async () => {
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);

    forcePrivateWinSummary(controller, {
      levelId: 1,
      chapterTitle: '前线集结',
      baseCoins: 70,
      nodeReward: null,
      nextLevelId: 2,
      doubled: false,
    });

    renderer.render();

    const text = ctx.fillTexts.map((entry) => entry.text).join('\n');
    expect(text).toContain('防线推进');
    expect(text).toContain('获得金币 70');
    expect(text).toContain('看广告奖励翻倍');
  });
```

- [ ] **Step 2: Run renderer tests and verify failure**

Run:

```bash
pnpm vitest run src/test/canvasRenderer.test.ts
```

Expected: FAIL because campaign screen modules and updated labels are not implemented.

- [ ] **Step 3: Create menu screen module**

Create `game/src/render/menuScreen.ts`:

```ts
import type { AppViewState } from '../app/controller';
import { drawButton, drawPanel, drawSmallText, drawText, type UiRenderContext } from './uiPrimitives';

export function drawMenuScreen(ui: UiRenderContext, view: AppViewState): void {
  const current = view.chapterProgress.find((chapter) => chapter.current) ?? view.chapterProgress[0];
  drawText(ui.ctx, '共联防线', 375, 118, 68, '#ffffff', 'center');
  drawText(ui.ctx, '调度资源，修复防线，守住前线', 375, 176, 28, '#d1fae5', 'center');
  drawPanel(ui.ctx, 70, 245, 610, 620);
  drawText(ui.ctx, current.title, 375, 320, 38, '#ffffff', 'center');
  drawText(ui.ctx, `当前进度 ${view.highestLevel}/30`, 375, 372, 30, '#fef3c7', 'center');
  drawButton(ui, 150, 430, 450, 82, '继续作战', { type: 'start' });
  drawButton(ui, 150, 535, 450, 72, '关卡选择', { type: 'openLevels' });
  drawButton(ui, 150, 625, 450, 72, '补给', { type: 'openSupplies' });
  drawButton(ui, 150, 715, 450, 72, '设置', { type: 'openSettings' });
  drawSmallText(ui.ctx, `金币 ${view.save.coins}`, 375, 820);
}

export function drawSuppliesScreen(ui: UiRenderContext, view: AppViewState): void {
  drawText(ui.ctx, '补给', 375, 126, 64, '#ffffff', 'center');
  drawText(ui.ctx, `金币 ${view.save.coins}`, 375, 184, 28, '#d1fae5', 'center');
  drawPanel(ui.ctx, 80, 260, 590, 620);
  drawButton(ui, 150, 330, 450, 78, '添加到桌面领奖', { type: 'desktopReward' });
  drawButton(ui, 150, 436, 450, 78, '添加到常用领奖', { type: 'favoriteReward' });
  drawButton(ui, 150, 542, 450, 78, '侧边栏入口奖励', { type: 'sidebarReward' });
  drawButton(ui, 150, 720, 450, 78, '返回', { type: 'closeModal' });
}
```

- [ ] **Step 4: Create levels screen module**

Create `game/src/render/levelsScreen.ts`:

```ts
import type { AppViewState } from '../app/controller';
import { drawButton, drawPanel, drawText, type UiRenderContext } from './uiPrimitives';

export function drawLevelsScreen(ui: UiRenderContext, view: AppViewState): void {
  drawText(ui.ctx, '关卡选择', 375, 86, 54, '#ffffff', 'center');
  drawText(ui.ctx, '完成当前关卡后解锁下一关', 375, 132, 24, '#d1fae5', 'center');
  drawPanel(ui.ctx, 38, 170, 674, 1010);

  for (const [chapterIndex, chapter] of view.chapterProgress.entries()) {
    const y = 220 + chapterIndex * 300;
    drawText(ui.ctx, `${chapter.title} ${chapter.completedCount}/10`, 80, y, 28, '#ffffff', 'left');
    for (let offset = 0; offset < 10; offset += 1) {
      const levelId = chapter.startLevel + offset;
      const col = offset % 5;
      const row = Math.floor(offset / 5);
      const x = 80 + col * 120;
      const buttonY = y + 42 + row * 82;
      const unlocked = levelId <= view.highestLevel;
      const label = unlocked ? `第${levelId}关` : '未解锁';
      drawButton(ui, x, buttonY, 104, 58, label, unlocked ? { type: 'selectLevel', levelId } : { type: 'openLevels' });
    }
  }

  drawButton(ui, 190, 1210, 370, 70, '返回', { type: 'closeModal' });
}
```

- [ ] **Step 5: Create briefing screen module**

Create `game/src/render/briefingScreen.ts`:

```ts
import type { AppViewState } from '../app/controller';
import { targetProgressText } from './theme';
import { drawButton, drawPanel, drawText, type UiRenderContext } from './uiPrimitives';

export function drawBriefingScreen(ui: UiRenderContext, view: AppViewState): void {
  const level = view.pendingLevel;
  drawText(ui.ctx, '作战简报', 375, 120, 62, '#ffffff', 'center');
  if (!level) {
    drawText(ui.ctx, '暂无可进入关卡', 375, 360, 32, '#ffffff', 'center');
    drawButton(ui, 190, 720, 370, 78, '返回首页', { type: 'home' });
    return;
  }

  drawText(ui.ctx, `${level.chapterTitle}  第 ${level.id} 关`, 375, 186, 30, '#d1fae5', 'center');
  drawPanel(ui.ctx, 70, 260, 610, 700);
  drawText(ui.ctx, level.briefing, 375, 330, 26, '#ffffff', 'center');
  drawText(ui.ctx, `步数 ${level.moves}`, 180, 420, 28, '#fef3c7', 'left');
  drawText(ui.ctx, `奖励金币 ${level.rewards.coins}`, 180, 470, 28, '#fef3c7', 'left');
  drawText(ui.ctx, '目标', 180, 550, 30, '#ffffff', 'left');
  level.targets.forEach((target, index) => {
    drawText(ui.ctx, targetProgressText(target, {}), 190, 610 + index * 46, 26, '#d1fae5', 'left');
  });
  drawButton(ui, 150, 1010, 450, 78, '开始作战', { type: 'beginLevel' });
  drawButton(ui, 190, 1110, 370, 70, '返回首页', { type: 'home' });
}
```

- [ ] **Step 6: Create game screen module by moving game drawing**

Create `game/src/render/gameScreen.ts` and move existing game-specific functions from `CanvasRenderer` into exported functions that receive the dependencies they need:

```ts
import type { AppAction, AppViewState } from '../app/controller';
import type { Board, BoardCell, Position } from '../core/types';
import type { EffectsModel } from './effects';
import { pieceColors, targetProgressText } from './theme';
import { drawAdButton, drawButton, drawPanel, drawText, roundRect, type UiRenderContext } from './uiPrimitives';
import type { VisualBoardModel, VisualTile } from './visualBoard';

export const BOARD_CELL_SIZE = 86;
export const BOARD_GAP = 8;
export const BOARD_START_X = 57;
export const BOARD_START_Y = 300;

export interface GameScreenRenderContext {
  ui: UiRenderContext;
  nowMs: number;
  visualBoard: VisualBoardModel;
  effects: EffectsModel;
  presentedBoard(session: NonNullable<AppViewState['session']>, nowMs: number): Board;
  handleVisualCue(view: AppViewState, nowMs: number): void;
  drawEffects(nowMs: number): void;
}

export function drawGameScreen(context: GameScreenRenderContext, view: AppViewState): void {
  const session = view.session;
  if (!session) {
    return;
  }

  drawPanel(context.ui.ctx, 36, 36, 678, 196);
  const level = view.pendingLevel;
  drawText(context.ui.ctx, `${level?.chapterTitle ?? '防线'}  第 ${session.levelId} 关`, 70, 88, 28, '#ffffff', 'left');
  drawText(context.ui.ctx, `步数 ${session.movesLeft}`, 70, 142, 30, '#fef3c7', 'left');
  drawText(context.ui.ctx, `金币 ${view.save.coins}`, 430, 88, 28, '#ffffff', 'left');
  drawButton(context.ui, 570, 130, 110, 54, '暂停', { type: 'pause' });
  drawTargets(context.ui, session);
  context.handleVisualCue(view, context.nowMs);
  drawBoard(context, session);
  context.drawEffects(context.nowMs);
  drawPowerUpButton(context.ui, 60, 1148, 190, 70, '炸开', view.save.items.bomb, view.activePowerUp === 'bomb', { type: 'usePowerUp', item: 'bomb' });
  drawPowerUpButton(context.ui, 280, 1148, 190, 70, '吸走', view.save.items.suck, view.activePowerUp === 'suck', { type: 'usePowerUp', item: 'suck' });
  drawPowerUpButton(context.ui, 500, 1148, 190, 70, '重排', view.save.items.shuffle, false, { type: 'usePowerUp', item: 'shuffle' });
}

function drawTargets(ui: UiRenderContext, session: NonNullable<AppViewState['session']>): void {
  const text = session.targets.map((target) => targetProgressText(target, session.targetProgress)).join('  ');
  drawText(ui.ctx, text, 375, 202, 24, '#d1fae5', 'center');
}

function drawPowerUpButton(ui: UiRenderContext, x: number, y: number, width: number, height: number, name: string, count: number, active: boolean, action: AppAction): void {
  if (count > 0) {
    drawButton(ui, x, y, width, height, `${active ? '>' : ''}${name} ${count}`, action);
    return;
  }

  drawAdButton(ui, x, y, width, height, `${active ? '>' : ''}看广告${name}`, action);
}
```

Move the existing `drawBoard`, `drawCellSlot`, `drawVisualTile`, `drawPieceIcon`, `drawGlowBox`, `withAlpha`, `drawStar`, `averageTiles`, and `colorForCell` functions into this module. Preserve their current bodies except replace `this.ctx` with `ui.ctx` or passed `ctx`. Export `cellAt(x, y)` from this module so `CanvasRenderer.handlePointer` can use the same board constants.

- [ ] **Step 7: Create result screen module**

Create `game/src/render/resultScreen.ts`:

```ts
import { describeNodeReward, remainingTargetsText } from '../app/campaign';
import type { AppAction, AppViewState } from '../app/controller';
import { drawAdButton, drawButton, drawPanel, drawText, type UiRenderContext } from './uiPrimitives';

export function drawPausedResult(ui: UiRenderContext): void {
  drawModal(ui, '暂停', [
    ['继续', { type: 'resume' }],
    ['重玩', { type: 'retry' }],
    ['返回首页', { type: 'home' }],
  ]);
}

export function drawWinResult(ui: UiRenderContext, view: AppViewState): void {
  const summary = view.winSummary;
  drawOverlay(ui);
  drawPanel(ui.ctx, 80, 300, 590, 620);
  drawText(ui.ctx, '防线推进', 375, 380, 52, '#ffffff', 'center');
  if (summary) {
    drawText(ui.ctx, `${summary.chapterTitle}  第 ${summary.levelId} 关完成`, 375, 450, 26, '#d1fae5', 'center');
    drawText(ui.ctx, `获得金币 ${summary.baseCoins}`, 375, 510, 28, '#fef3c7', 'center');
    const reward = describeNodeReward(summary.nodeReward ?? undefined);
    if (reward) {
      drawText(ui.ctx, `节点奖励 ${reward}`, 375, 560, 26, '#fef3c7', 'center');
    }
    if (summary.nextLevelId) {
      drawText(ui.ctx, `已解锁第 ${summary.nextLevelId} 关`, 375, 610, 26, '#d1fae5', 'center');
    }
  }
  if (!summary?.doubled) {
    drawAdButton(ui, 155, 670, 440, 70, '看广告奖励翻倍', { type: 'doubleWinReward' });
  } else {
    drawText(ui.ctx, '翻倍奖励已领取', 375, 705, 26, '#d1fae5', 'center');
  }
  drawButton(ui, 175, 770, 400, 68, '下一关', { type: 'nextLevel' });
  drawButton(ui, 175, 850, 400, 68, '返回首页', { type: 'home' });
}

export function drawLostResult(ui: UiRenderContext, view: AppViewState): void {
  drawOverlay(ui);
  drawPanel(ui.ctx, 80, 300, 590, 620);
  drawText(ui.ctx, '防线告急', 375, 380, 52, '#ffffff', 'center');
  if (view.session) {
    drawText(ui.ctx, '未完成目标', 375, 455, 28, '#fef3c7', 'center');
    drawText(ui.ctx, remainingTargetsText(view.session), 375, 510, 24, '#d1fae5', 'center');
  }
  drawAdButton(ui, 155, 610, 440, 70, '看广告加 5 步', { type: 'extraMovesAd' });
  drawButton(ui, 175, 705, 400, 68, '重玩', { type: 'retry' });
  drawButton(ui, 175, 785, 400, 68, '返回首页', { type: 'home' });
}

function drawModal(ui: UiRenderContext, title: string, buttons: Array<[string, AppAction]>): void {
  drawOverlay(ui);
  drawPanel(ui.ctx, 105, 350, 540, 470);
  drawText(ui.ctx, title, 375, 430, 56, '#ffffff', 'center');
  buttons.forEach(([label, action], index) => {
    drawButton(ui, 175, 500 + index * 100, 400, 74, label, action);
  });
}

function drawOverlay(ui: UiRenderContext): void {
  ui.ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ui.ctx.fillRect(0, 0, 750, 1334);
}
```

- [ ] **Step 8: Update CanvasRenderer screen dispatch**

In `game/src/render/canvasRenderer.ts`, import new modules and delegate screen drawing:

```ts
import { drawBriefingScreen } from './briefingScreen';
import { cellAt, drawGameScreen } from './gameScreen';
import { drawLevelsScreen } from './levelsScreen';
import { drawMenuScreen, drawSuppliesScreen } from './menuScreen';
import { drawLostResult, drawPausedResult, drawWinResult } from './resultScreen';
```

In `render()` replace old screen branches:

```ts
if (view.screen === 'menu') {
  drawMenuScreen(this.ui(), view);
} else if (view.screen === 'levels') {
  drawLevelsScreen(this.ui(), view);
} else if (view.screen === 'briefing') {
  drawBriefingScreen(this.ui(), view);
} else if (view.screen === 'supplies') {
  drawSuppliesScreen(this.ui(), view);
} else if (view.screen === 'settings') {
  this.drawSettings(view);
} else if (view.screen === 'playing' || view.screen === 'paused' || view.screen === 'won' || view.screen === 'lost') {
  drawGameScreen({
    ui: this.ui(),
    nowMs,
    visualBoard: this.visualBoard,
    effects: this.effects,
    presentedBoard: (session, time) => this.presentedBoard(session, time),
    handleVisualCue: (state, time) => this.handleVisualCue(state, time),
    drawEffects: (time) => this.drawEffects(time),
  }, view);
  if (view.screen === 'paused') drawPausedResult(this.ui());
  if (view.screen === 'won') drawWinResult(this.ui(), view);
  if (view.screen === 'lost') drawLostResult(this.ui(), view);
}
```

In pointer handling, use exported board hit-test:

```ts
const cell = cellAt(point.x, point.y);
```

Remove old menu, levels, briefing, game, modal, target, button, and power-up drawing methods that moved to modules.

- [ ] **Step 9: Run renderer tests, full tests, and build**

Run:

```bash
pnpm vitest run src/test/canvasRenderer.test.ts
pnpm test
pnpm build
```

Expected: all commands pass.

- [ ] **Step 10: Commit**

```bash
git add game/src/render/menuScreen.ts game/src/render/levelsScreen.ts game/src/render/briefingScreen.ts game/src/render/gameScreen.ts game/src/render/resultScreen.ts game/src/render/canvasRenderer.ts game/src/test/canvasRenderer.test.ts
git commit -m "feat: add campaign screen rendering"
```

---

### Task 7: Final Browser Smoke Test And Cleanup

**Files:**
- Modify only if verification reveals a defect.

- [ ] **Step 1: Run final automated verification**

Run:

```bash
pnpm test
pnpm build
git status --short
```

Expected:

- `pnpm test` passes all test files.
- `pnpm build` completes `tsc --noEmit && vite build`.
- `git status --short` shows no unstaged work after the previous task commit, unless this task found and fixed a defect.

- [ ] **Step 2: Start local dev server for manual smoke test**

Run:

```bash
pnpm dev
```

Expected: Vite serves the game on `http://127.0.0.1:5173/` or another printed port if 5173 is occupied.

- [ ] **Step 3: Manual smoke test in browser**

Open the served URL and verify:

- Home screen shows current chapter and `1/30`.
- Clicking “继续作战” opens 作战简报.
- Clicking “开始作战” enters the board.
- Opening 关卡选择 shows 3 chapters with 10 level buttons each.
- Locked levels show locked copy and do not start.
- Losing still shows “看广告加 5 步”.
- A forced or natural win shows “防线推进” and “看广告奖励翻倍”.
- Text remains inside panels and buttons at mobile portrait size.

- [ ] **Step 4: Fix any smoke-test defects with focused tests first**

If a defect is found, write or update the smallest relevant Vitest test first, run it to confirm failure, implement the fix, then run:

```bash
pnpm test
pnpm build
```

Expected: new test catches the defect before the fix and all tests pass after the fix.

- [ ] **Step 5: Commit smoke-test fixes if any**

If files changed:

```bash
git add <changed-files>
git commit -m "fix: polish campaign expansion"
```

If no files changed, do not create an empty commit.
