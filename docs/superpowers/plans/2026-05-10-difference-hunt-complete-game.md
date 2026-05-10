# Difference Hunt Complete Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete `games/difference-hunt` as a polished 7-level portrait mobile spot-the-difference game using only `levels/assets/findGame` resources.

**Architecture:** Keep the existing Vite + Canvas + mini-pack architecture. Treat level data and static copied images as the content layer, `GameController` as state and reward flow, and `CanvasRenderer` as the only visual/interaction surface. Avoid adding a second rendering system or expanding into non-find-difference gameplay.

**Tech Stack:** TypeScript, Vite, Vitest, Canvas 2D, mini-pack platform adapters.

---

## File Structure

- Modify: `games/difference-hunt/game/src/assets/levels.ts` - 7 structured Cocos-derived levels.
- Modify: `games/difference-hunt/game/src/assets/types.ts` - keep current level type unless a thumbnail field becomes necessary.
- Modify: `games/difference-hunt/game/src/test/levelData.test.ts` - level count, target count, resource existence, coordinate conversion.
- Create: `games/difference-hunt/game/src/test/save.test.ts` - old/corrupt save compatibility checks.
- Modify: `games/difference-hunt/game/src/app/save.ts` - only if compatibility tests expose gaps.
- Modify: `games/difference-hunt/game/src/test/controller.test.ts` - full 7-level unlock and reward flow checks.
- Modify: `games/difference-hunt/game/src/render/theme.ts` - expanded palette for polished screens.
- Modify: `games/difference-hunt/game/src/render/canvasRenderer.ts` - polished pages, modal hit blocking, ad badge drawing.
- Create: `games/difference-hunt/game/public-pack/assets/find/level-006/*` - copied level 6 images.
- Create: `games/difference-hunt/game/public-pack/assets/find/level-007/*` - copied level 7 images.
- Modify: `.gitignore` - add `.superpowers/` so brainstorming previews stay local.

## Task 1: Level Data Coverage

**Files:**
- Modify: `games/difference-hunt/game/src/test/levelData.test.ts`
- Modify: `games/difference-hunt/game/src/assets/levels.ts`
- Create: `games/difference-hunt/game/public-pack/assets/find/level-006/*.png`
- Create: `games/difference-hunt/game/public-pack/assets/find/level-007/*.png`

- [ ] **Step 1: Write the failing level data test**

Replace the first test in `levelData.test.ts` with:

```ts
test('contains all seven Cocos findGame levels with ten targets each', () => {
  expect(differenceHuntLevels).toHaveLength(7);
  expect(differenceHuntLevels.map((level) => level.levelNo)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(differenceHuntLevels.every((level) => level.targets.length === 10)).toBe(true);
});
```

Add a resource existence test:

```ts
test('points every level image to a copied public-pack resource', async () => {
  const { access } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const root = resolve(__dirname, '../../public-pack');

  for (const level of differenceHuntLevels) {
    await expect(access(resolve(root, level.background))).resolves.toBeUndefined();
    for (const target of level.targets) {
      await expect(access(resolve(root, target.image))).resolves.toBeUndefined();
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/test/levelData.test.ts`

Expected: FAIL because `differenceHuntLevels` still has 5 levels and copied resources for levels 6-7 do not exist.

- [ ] **Step 3: Copy level 6 and 7 image resources**

Run:

```bash
mkdir -p game/public-pack/assets/find/level-006 game/public-pack/assets/find/level-007
cp levels/assets/findGame/findLevel6/texture/picture06_* game/public-pack/assets/find/level-006/
cp levels/assets/findGame/findLevel7/texture/picture07_* game/public-pack/assets/find/level-007/
```

Run from `games/difference-hunt`.

- [ ] **Step 4: Generate level entries from Cocos prefabs**

Use a Node one-off script to parse `Level.prefab`: find child nodes named `pictureNN_01` through `pictureNN_10`, read each node `_trs.array[0]`, `_trs.array[1]`, and `_contentSize`, then append level 6 and 7 objects in `levels.ts` with titles:

```ts
const levelTitles = {
  6: '海边假日',
  7: '糖果小屋',
};
```

Each generated target must use:

```ts
{
  id: 'picture06_01',
  image: 'assets/find/level-006/picture06_01.png',
  cocos: { x: /* prefab x */, y: /* prefab y */ },
  size: { width: /* prefab width */, height: /* prefab height */ },
}
```

The level background must use `picture06_11.png` and `picture07_11.png`; background size and center come from the background node and current levels: `center: { x: 375, y: 667 }`.

- [ ] **Step 5: Run level data test to verify it passes**

Run: `pnpm test src/test/levelData.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add games/difference-hunt/game/src/assets/levels.ts games/difference-hunt/game/src/test/levelData.test.ts games/difference-hunt/game/public-pack/assets/find/level-006 games/difference-hunt/game/public-pack/assets/find/level-007
git commit -m "feat: add remaining difference hunt levels"
```

## Task 2: Save and Controller Rules

**Files:**
- Create: `games/difference-hunt/game/src/test/save.test.ts`
- Modify: `games/difference-hunt/game/src/app/save.ts`
- Modify: `games/difference-hunt/game/src/test/controller.test.ts`

- [ ] **Step 1: Write failing compatibility tests**

Create `save.test.ts`:

```ts
import { describe, expect, test } from 'vitest';

import { completeLevel, loadSave, type StorageLike } from '../app/save';

describe('difference hunt save compatibility', () => {
  test('loads old saves with missing optional fields', () => {
    const storage = memoryStorage(JSON.stringify({
      highestUnlockedLevel: 5,
      completedLevels: [1, 2, 3, 4],
      currentLevel: 5,
    }));

    const save = loadSave(storage);

    expect(save.highestUnlockedLevel).toBe(5);
    expect(save.currentLevel).toBe(5);
    expect(save.hints).toBe(0);
    expect(save.coins).toBe(0);
    expect(save.settings.soundEnabled).toBe(true);
    expect(save.lastDailyRewardDay).toBe('');
  });

  test('falls back to defaults when stored data is corrupt', () => {
    const save = loadSave(memoryStorage('{bad json'));

    expect(save.highestUnlockedLevel).toBe(1);
    expect(save.currentLevel).toBe(1);
    expect(save.completedLevels).toEqual([]);
  });

  test('completing the sixth level unlocks the seventh level', () => {
    const next = completeLevel({
      highestUnlockedLevel: 6,
      completedLevels: [1, 2, 3, 4, 5],
      currentLevel: 6,
      hints: 0,
      coins: 0,
      settings: { soundEnabled: true },
      lastDailyRewardDay: '',
    }, 6, 7);

    expect(next.highestUnlockedLevel).toBe(7);
    expect(next.currentLevel).toBe(7);
    expect(next.completedLevels).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

function memoryStorage(value: string | null): StorageLike {
  return {
    getItem() {
      return value;
    },
    setItem() {},
    removeItem() {},
  };
}
```

- [ ] **Step 2: Run save tests to verify behavior**

Run: `pnpm test src/test/save.test.ts`

Expected: PASS if current compatibility is already adequate. If it fails, update `normalizeSave()` to default missing fields exactly as asserted.

- [ ] **Step 3: Add full 7-level controller test**

Add to `controller.test.ts`:

```ts
test('sequential wins unlock every configured level without opening all levels by default', () => {
  const controller = new GameController({ levels: differenceHuntLevels, save: defaultTestSave() });

  for (let levelNo = 1; levelNo <= 6; levelNo += 1) {
    controller.startLevel(levelNo);
    for (const target of differenceHuntLevels[levelNo - 1].targets) {
      controller.tap({ x: 375 + target.cocos.x, y: 667 - target.cocos.y });
    }
    expect(controller.getViewState().save.highestUnlockedLevel).toBe(levelNo + 1);
  }

  expect(controller.getViewState().levels).toHaveLength(7);
  expect(controller.startLevel(7).screen).toBe('playing');
});
```

- [ ] **Step 4: Run controller tests**

Run: `pnpm test src/test/controller.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/difference-hunt/game/src/test/save.test.ts games/difference-hunt/game/src/test/controller.test.ts games/difference-hunt/game/src/app/save.ts
git commit -m "test: cover difference hunt save and unlock flow"
```

## Task 3: Video Ad Badge and Modal Hit Blocking

**Files:**
- Modify: `games/difference-hunt/game/src/render/canvasRenderer.ts`

- [ ] **Step 1: Add a renderer-level behavior test target through code review**

There is no canvas DOM test harness in this project. Before production changes, identify exact behavior to verify manually:

```txt
Every rewarded ad entry is drawn with the same 38:28 badge:
- 看广告提示
- 加 30 秒
- 看广告奖励翻倍
- 看广告解锁

When win or failed overlay is visible, only overlay buttons react. Tapping covered game image areas must not call controller.tap().
```

- [ ] **Step 2: Implement badge drawing**

In `canvasRenderer.ts`, add `AdButtonType` and `adButton()`:

```ts
type AdButtonType = Extract<HitTargetType, 'adHint' | 'adTime' | 'doubleReward'>;

private adButton(x: number, y: number, width: number, height: number, label: string, type: AdButtonType): void {
  this.roundRect(x, y, width, height, Math.min(22, height / 2), theme.gold, theme.panelStroke);
  const iconWidth = 38;
  const iconHeight = 28;
  const iconX = x + Math.max(18, width * 0.08);
  const iconY = y + (height - iconHeight) / 2;
  this.drawAdBadge(iconX, iconY, iconWidth, iconHeight);
  this.text(label, iconX + iconWidth + 14, y + height / 2 + 1, height >= 60 ? 24 : 19, 850, '#ffffff', 'left');
  this.hits.push({ type, rect: { x, y, width, height } });
}
```

Add `drawAdBadge()` as a small 38:28 drawn material: rounded red video-card body, gold corner, white camera window, no English letters.

- [ ] **Step 3: Replace rewarded ad buttons**

Replace:

```ts
this.button(..., '看广告提示', ..., 'adHint')
this.button(..., '+30 秒', ..., 'adTime')
this.button(..., '看广告奖励翻倍', ..., 'doubleReward')
this.button(..., '看广告加 30 秒', ..., 'adTime')
```

with `this.adButton(...)` and labels:

```ts
'看广告提示'
'加 30 秒'
'奖励翻倍'
'加 30 秒'
```

For locked levels in `drawLevelSelect()`, draw a badge next to `广告解锁` inside the card.

- [ ] **Step 4: Add modal hit blocking**

At the start of `handleDesignPoint()`, when `screen` is `win` or `failed`, ignore non-overlay hits. Use a helper:

```ts
private isOverlayHit(type: HitTargetType): boolean {
  return type === 'continue' || type === 'doubleReward' || type === 'adTime' || type === 'retry' || type === 'level' || type === 'home';
}
```

If no overlay hit exists on those screens, return without calling `controller.tap(point)`.

- [ ] **Step 5: Run TypeScript build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add games/difference-hunt/game/src/render/canvasRenderer.ts
git commit -m "feat: polish rewarded ad controls"
```

## Task 4: Page Visual Polish

**Files:**
- Modify: `games/difference-hunt/game/src/render/theme.ts`
- Modify: `games/difference-hunt/game/src/render/canvasRenderer.ts`

- [ ] **Step 1: Define visual acceptance before editing**

Use this checklist while editing:

```txt
首页 first viewport: game title, current preview, progress, start, levels, daily reward, settings.
游戏页: image frame remains the primary visual area, header text fits, bottom tray does not overlap image.
选关页: 7 level cards fit vertically, states are clear, locked cards show ad badge.
设置页: sound and progress are readable.
Win/failed overlays: semi-transparent mask covers screen and buttons are clear.
All visible text is simplified Chinese.
```

- [ ] **Step 2: Expand theme**

Update `theme.ts` to include colors for `sky`, `cream`, `rose`, `shadow`, `line`, and `locked`, while avoiding a single-hue palette:

```ts
export const theme = {
  backgroundTop: '#dff7f3',
  backgroundBottom: '#fff7ed',
  panel: 'rgba(255, 255, 255, 0.92)',
  panelStroke: 'rgba(31, 41, 55, 0.14)',
  ink: '#1f2937',
  muted: '#64748b',
  accent: '#e11d48',
  accentSoft: 'rgba(225, 29, 72, 0.14)',
  gold: '#f59e0b',
  green: '#16a34a',
  sky: '#0ea5e9',
  cream: '#fff7ed',
  rose: '#ffe4e6',
  shadow: 'rgba(15, 23, 42, 0.18)',
  line: 'rgba(15, 23, 42, 0.08)',
  locked: 'rgba(255, 255, 255, 0.64)',
};
```

- [ ] **Step 3: Polish page draw methods**

Edit `drawHome()`, `drawHeader()`, `drawTray()`, `drawLevelSelect()`, `drawSettings()`, `drawWinOverlay()`, and `drawFailedOverlay()` to use the expanded theme, stronger hierarchy, and consistent button widths. Keep current hit target types unchanged.

- [ ] **Step 4: Run tests and build**

Run:

```bash
pnpm test
pnpm build
```

Expected: PASS for both.

- [ ] **Step 5: Commit**

```bash
git add games/difference-hunt/game/src/render/theme.ts games/difference-hunt/game/src/render/canvasRenderer.ts
git commit -m "style: polish difference hunt screens"
```

## Task 5: Browser Visual Verification and Local Ignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ignore brainstorming previews**

Add to `.gitignore`:

```gitignore
.superpowers/
```

- [ ] **Step 2: Start browser preview**

Run from `games/difference-hunt/game`:

```bash
pnpm dev
```

Open `http://127.0.0.1:5175` in the browser plugin.

- [ ] **Step 3: Verify screens**

Manual route through:

```txt
首页 -> 选择关卡 -> 第 1 关 -> 设置 -> 首页 -> 开始游戏
Find all 10 targets on level 1 or force current save to exercise win overlay.
Wait or adjust timer path to exercise failed overlay if practical.
```

Check text overlap, button overlap, nonblank images, and ad badges.

- [ ] **Step 4: Final verification**

Run from `games/difference-hunt/game`:

```bash
pnpm test
pnpm build
```

Expected: PASS for both commands.

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore brainstorming previews"
```

## Self-Review

Spec coverage:

- 7 findGame levels: Task 1.
- Pages and polished UI: Tasks 3 and 4.
- Rewarded ads with explicit badge: Task 3.
- Sequential unlock and storage compatibility: Task 2.
- Browser and build verification: Task 5.

Placeholder scan: checked for incomplete instruction markers; none remain.

Type consistency: existing `DifferenceLevel`, `DifferenceTarget`, `HitTargetType`, and controller methods are reused; the only new helper type is local to `canvasRenderer.ts`.
