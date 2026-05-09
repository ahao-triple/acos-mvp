# Tap Gallery Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `games/tap-gallery` into a playable Canvas game with browser runtime, tests, and `mini-pack` Douyin packaging.

**Architecture:** Keep pure game rules in `game/src/core`, app state in `game/src/app`, Canvas drawing in `game/src/render`, and platform/audio bridges in `game/src/platform` and `game/src/audio`. Runtime assets are copied from `tap-gallery-dev-handoff/game-assets` into `game/public/assets` so both Vite and mini-pack can serve the same paths.

**Tech Stack:** TypeScript, Vite, Vitest, Canvas 2D, existing `mini-pack` CLI, existing handoff PNG/WAV/JSON assets.

---

### Task 1: Project Scaffold And Runtime Assets

**Files:**
- Create: `games/tap-gallery/game.config.ts`
- Create: `games/tap-gallery/game/package.json`
- Create: `games/tap-gallery/game/tsconfig.json`
- Create: `games/tap-gallery/game/vite.config.ts`
- Create: `games/tap-gallery/game/index.html`
- Create: `games/tap-gallery/game/src/vite-env.d.ts`
- Create: `games/tap-gallery/game/src/main.ts`
- Create: `games/tap-gallery/game/public/assets/**`

- [ ] **Step 1: Add minimal Vite app files**

Create a Vite project matching the local pattern from `games/gonglian-fangxian/game`: TypeScript module package, `dev`, `build`, `test`, and `test:watch` scripts.

- [ ] **Step 2: Copy handoff runtime assets**

Run:

```bash
mkdir -p games/tap-gallery/game/public/assets
rsync -a games/tap-gallery/tap-gallery-dev-handoff/game-assets/ games/tap-gallery/game/public/assets/
```

Expected: `games/tap-gallery/game/public/assets/asset-manifest.json` exists.

- [ ] **Step 3: Add mini-pack config**

Create `games/tap-gallery/game.config.ts` with title `Tap Gallery`, entry `game/src/main.ts`, publicDir `game/public`, portrait `750 x 1334`, platform `douyin`, and projectName `tap-gallery`.

- [ ] **Step 4: Verify scaffold build starts failing only on missing implementation**

Run:

```bash
pnpm --dir games/tap-gallery/game build
```

Expected: TypeScript/Vite reports missing implementation modules until later tasks add them.

### Task 2: Asset And Level Loading

**Files:**
- Create: `games/tap-gallery/game/src/assets/types.ts`
- Create: `games/tap-gallery/game/src/assets/loader.ts`
- Test: `games/tap-gallery/game/src/test/assets.test.ts`

- [ ] **Step 1: Write loader tests**

Test manifest URL resolution, loading one level config, and validating required level fields.

- [ ] **Step 2: Implement types**

Define `AssetManifest`, `LevelConfig`, `LevelCell`, `Direction`, and image/audio asset references based on the handoff JSON.

- [ ] **Step 3: Implement loader**

Expose `loadAssetManifest(baseUrl = '/assets/')`, `loadLevels(manifest)`, and `loadImageAsset(url)` helpers. Throw descriptive errors for missing manifest or malformed level config.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --dir games/tap-gallery/game test src/test/assets.test.ts
```

Expected: loader tests pass.

### Task 3: Core Board Rules

**Files:**
- Create: `games/tap-gallery/game/src/core/types.ts`
- Create: `games/tap-gallery/game/src/core/board.ts`
- Test: `games/tap-gallery/game/src/test/board.test.ts`

- [ ] **Step 1: Write rule tests**

Cover clear path by direction, blocked path, removing an arrow, win detection, and invalid coordinates.

- [ ] **Step 2: Implement board state**

Expose `createBoard(level)`, `canClearCell(board, cellId)`, `clearCell(board, cellId)`, `getClearableCells(board)`, `isBoardComplete(board)`, and `findHintCell(board)`.

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --dir games/tap-gallery/game test src/test/board.test.ts
```

Expected: core board tests pass.

### Task 4: Tools And Rewards

**Files:**
- Create: `games/tap-gallery/game/src/core/tools.ts`
- Create: `games/tap-gallery/game/src/app/rewards.ts`
- Test: `games/tap-gallery/game/src/test/tools.test.ts`
- Test: `games/tap-gallery/game/src/test/rewards.test.ts`

- [ ] **Step 1: Write tool tests**

Cover Hint returning a clearable target, Bomb removing adjacent eligible arrows, Magnet removing same-direction clearable arrows with a cap, Hammer removing a blocked arrow, and Freeze suppressing one failure pressure event.

- [ ] **Step 2: Implement tool effects**

Keep effects deterministic and side-effect free: each function receives board/session state and returns a new state plus feedback event.

- [ ] **Step 3: Implement rewards**

Grant coins and occasional tools on level completion. Keep reward values deterministic by level number.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --dir games/tap-gallery/game test src/test/tools.test.ts src/test/rewards.test.ts
```

Expected: tool and reward tests pass.

### Task 5: Save State And Platform Adapters

**Files:**
- Create: `games/tap-gallery/game/src/app/save.ts`
- Create: `games/tap-gallery/game/src/platform/types.ts`
- Create: `games/tap-gallery/game/src/platform/web.ts`
- Create: `games/tap-gallery/game/src/platform/minipack.ts`
- Create: `games/tap-gallery/game/src/platform/douyin.ts`
- Test: `games/tap-gallery/game/src/test/save.test.ts`

- [ ] **Step 1: Write save migration tests**

Cover empty storage, current schema load, corrupt JSON fallback, completion persistence, settings persistence, and inventory persistence.

- [ ] **Step 2: Implement save module**

Expose `loadSave(storage)`, `writeSave(storage, save)`, and update helpers for progress, inventory, coins, energy, sound, and music.

- [ ] **Step 3: Implement platform adapters**

Mirror the existing adapter shape from `gonglian-fangxian`, but keep Tap Gallery-specific rewarded slots and log messages.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --dir games/tap-gallery/game test src/test/save.test.ts
```

Expected: save tests pass.

### Task 6: Controller And Screens

**Files:**
- Create: `games/tap-gallery/game/src/app/controller.ts`
- Create: `games/tap-gallery/game/src/app/session.ts`
- Test: `games/tap-gallery/game/src/test/controller.test.ts`

- [ ] **Step 1: Write controller tests**

Cover first launch to level 1, valid tap progress, invalid tap feedback, win transition, retry, next level, level select locking, and rewarded extra moves fallback.

- [ ] **Step 2: Implement controller**

Expose `GameController` with `load()`, `getViewState()`, `handlePointer()`, `useTool()`, `startLevel()`, `retryLevel()`, `continueAfterWin()`, and settings actions.

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --dir games/tap-gallery/game test src/test/controller.test.ts
```

Expected: controller tests pass.

### Task 7: Canvas Renderer And Input

**Files:**
- Create: `games/tap-gallery/game/src/render/layout.ts`
- Create: `games/tap-gallery/game/src/render/theme.ts`
- Create: `games/tap-gallery/game/src/render/imageCache.ts`
- Create: `games/tap-gallery/game/src/render/canvasRenderer.ts`
- Test: `games/tap-gallery/game/src/test/layout.test.ts`

- [ ] **Step 1: Write layout tests**

Cover viewport scaling, board cell rectangles for multiple board sizes, and hit target mapping.

- [ ] **Step 2: Implement layout**

Use fixed `750 x 1334` design coordinates and scale to actual canvas size. Keep board in the `45,235,660,660` safe region.

- [ ] **Step 3: Implement renderer**

Draw background, top HUD, board/reveal image, arrows, progress, tool bar, result overlays, and loading/error states. Register pointer handlers and forward semantic actions to the controller.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --dir games/tap-gallery/game test src/test/layout.test.ts
```

Expected: layout tests pass.

### Task 8: Audio And App Bootstrap

**Files:**
- Create: `games/tap-gallery/game/src/audio/soundAssets.ts`
- Create: `games/tap-gallery/game/src/audio/soundEngine.ts`
- Modify: `games/tap-gallery/game/src/main.ts`
- Test: `games/tap-gallery/game/src/test/main.test.ts`

- [ ] **Step 1: Implement sound mapping**

Map gameplay events to `assets/assets/audio/sfx/*.wav`, degrade when audio cannot play, and unlock audio on first pointer input in web runtime.

- [ ] **Step 2: Implement `createGame`**

Mirror the existing `createGame(runtime?)` pattern: choose mini-pack, Douyin, or web adapter, create controller, renderer, audio engine, resize canvas, and drive `requestAnimationFrame`.

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --dir games/tap-gallery/game test src/test/main.test.ts
```

Expected: bootstrap tests pass.

### Task 9: Build And Package Verification

**Files:**
- Modify: root `package.json` only if needed for convenience scripts.
- Verify: `build/tap-gallery-douyin/**`

- [ ] **Step 1: Run full game tests**

Run:

```bash
pnpm --dir games/tap-gallery/game test
```

Expected: all Tap Gallery tests pass.

- [ ] **Step 2: Run game build**

Run:

```bash
pnpm --dir games/tap-gallery/game build
```

Expected: Vite build completes.

- [ ] **Step 3: Run mini-pack build**

Run:

```bash
pnpm build games/tap-gallery
```

Expected: `build/tap-gallery-douyin/game.js`, `game.json`, `project.config.json`, and `build-report.json` are generated.

- [ ] **Step 4: Run browser preview**

Run:

```bash
pnpm --dir games/tap-gallery/game dev
```

Expected: local Vite URL opens to playable level 1.

### Task 10: Final Review

**Files:**
- Review: `games/tap-gallery/**`
- Review: `docs/superpowers/specs/2026-05-09-tap-gallery-game-design.md`
- Review: `docs/superpowers/plans/2026-05-09-tap-gallery-game.md`

- [ ] **Step 1: Check git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: changes are limited to Tap Gallery, docs, and any necessary build-script/config updates.

- [ ] **Step 2: Summarize verification**

Record exact commands run and whether they passed. Mention any known gaps, especially platform APIs that remain placeholders.
