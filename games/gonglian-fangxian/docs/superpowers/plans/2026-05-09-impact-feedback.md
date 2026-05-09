# Impact Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved 1-9 impact feedback model so clears, cascades, power-ups, and win finale drive sound, haptics, and screen shake from one event.

**Architecture:** Add a small `feedback/impact.ts` module that maps session events to impact descriptors. CanvasRenderer emits impact events at presentation timing and owns screen shake state. The main loop consumes those impact events, routes sound to SoundEngine, routes short/long haptics through PlatformAdapter, and leaves click coordinates untouched.

**Tech Stack:** TypeScript, Vite, Vitest, Canvas 2D, existing platform adapters for Web, Douyin, and MiniPack.

---

## File Structure

- Create `game/src/feedback/impact.ts`: impact levels, profiles, and mapping from `SessionEvent[]` to impact descriptors.
- Create `game/src/test/impact.test.ts`: unit tests for the 1-9 level mapping.
- Modify `game/src/platform/types.ts`: add `HapticKind` and `triggerHaptic`.
- Modify `game/src/platform/web.ts`: implement `navigator.vibrate` short/long haptics.
- Modify `game/src/platform/douyin.ts`: map short/long to `tt.vibrateShort` and `tt.vibrateLong`.
- Modify `game/src/platform/minipack.ts`: add optional runtime haptics bridge and adapter forwarding.
- Create `game/src/test/platformHaptics.test.ts`: verify Web, Douyin, and MiniPack haptic routing.
- Modify `game/src/render/canvasRenderer.ts`: replace presentation audio cue with impact cue and add screen shake.
- Modify `game/src/test/canvasRenderer.test.ts`: verify impact emission and screen shake without hit area drift.
- Modify `game/src/main.ts`: route consumed impact events to sound, haptics, and renderer shake.
- Modify test mock platforms in `game/src/test/controller.test.ts`, `game/src/test/canvasRenderer.test.ts`, and `game/src/test/rewards.test.ts`: add no-op `triggerHaptic`.

---

### Task 1: Impact Level Model

**Files:**
- Create: `game/src/feedback/impact.ts`
- Test: `game/src/test/impact.test.ts`

- [ ] **Step 1: Write the failing impact mapping tests**

Create `game/src/test/impact.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the impact test and verify it fails**

Run:

```bash
pnpm vitest run src/test/impact.test.ts
```

Expected: FAIL because `../feedback/impact` does not exist.

- [ ] **Step 3: Implement the impact model**

Create `game/src/feedback/impact.ts`:

```ts
import type { AudioCueType } from '../audio/soundEngine';
import type { Position, SessionEvent } from '../core/types';

export type ImpactLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ImpactSource = 'match' | 'cascade' | 'powerUp' | 'winFinale' | 'lose';
export type ImpactHaptic = 'none' | 'short' | 'long';

export interface ImpactShake {
  amplitude: number;
  durationMs: number;
}

export interface ImpactDescriptor {
  level: ImpactLevel;
  source: ImpactSource;
  sound: AudioCueType;
  haptic: ImpactHaptic;
  shake: ImpactShake;
}

export interface ImpactEvent extends ImpactDescriptor {
  id: number;
}

const IMPACT_PROFILES: Record<ImpactLevel, Pick<ImpactDescriptor, 'haptic' | 'shake'>> = {
  1: { haptic: 'short', shake: { amplitude: 0, durationMs: 0 } },
  2: { haptic: 'short', shake: { amplitude: 1, durationMs: 80 } },
  3: { haptic: 'short', shake: { amplitude: 2, durationMs: 100 } },
  4: { haptic: 'short', shake: { amplitude: 3, durationMs: 120 } },
  5: { haptic: 'short', shake: { amplitude: 4, durationMs: 150 } },
  6: { haptic: 'long', shake: { amplitude: 5, durationMs: 170 } },
  7: { haptic: 'long', shake: { amplitude: 6, durationMs: 190 } },
  8: { haptic: 'long', shake: { amplitude: 8, durationMs: 220 } },
  9: { haptic: 'long', shake: { amplitude: 10, durationMs: 280 } },
};

export function impactForClearStep(events: SessionEvent[], clearEventIndex: number): ImpactDescriptor | null {
  const event = events[clearEventIndex];
  if (!event || event.type !== 'clear') {
    return null;
  }

  const clearPhase = events.slice(0, clearEventIndex + 1).filter((candidate) => candidate.type === 'clear').length;
  if (clearPhase >= 2) {
    return impactForLevel(cascadeLevel(clearPhase), 'cascade');
  }

  const clearCount = uniquePositionCount(event.cells ?? []);
  const matchEvents = matchEventsBeforeClear(events, clearEventIndex);
  if (matchEvents.length === 0) {
    return impactForLevel(powerUpLevel(clearCount), 'powerUp');
  }

  return impactForLevel(matchLevel(matchEvents, clearCount), 'match');
}

export function impactForWinFinale(): ImpactDescriptor {
  return impactForLevel(9, 'winFinale');
}

export function impactForLevel(level: ImpactLevel, source: ImpactSource): ImpactDescriptor {
  const profile = IMPACT_PROFILES[level];
  return {
    level,
    source,
    sound: source === 'winFinale' ? 'win' : level <= 2 ? 'match' : 'combo',
    haptic: profile.haptic,
    shake: profile.shake,
  };
}

function cascadeLevel(clearPhase: number): ImpactLevel {
  if (clearPhase >= 4) {
    return 8;
  }
  if (clearPhase === 3) {
    return 7;
  }
  return 6;
}

function powerUpLevel(clearCount: number): ImpactLevel {
  if (clearCount >= 9) {
    return 8;
  }
  if (clearCount >= 5) {
    return 7;
  }
  return 5;
}

function matchLevel(matchEvents: SessionEvent[], clearCount: number): ImpactLevel {
  const groupCount = matchEvents.filter((event) => (event.cells?.length ?? event.count ?? 0) >= 3).length;
  const shaped = matchEvents.some((event) => spansRowsAndColumns(event.cells ?? []));

  if (clearCount >= 8) {
    return 5;
  }
  if (groupCount >= 2 || shaped) {
    return 4;
  }
  if (clearCount >= 6) {
    return 3;
  }
  if (clearCount >= 4) {
    return 2;
  }
  return 1;
}

function matchEventsBeforeClear(events: SessionEvent[], clearEventIndex: number): SessionEvent[] {
  const start = previousClearIndex(events, clearEventIndex) + 1;
  return events.slice(start, clearEventIndex).filter((event) => event.type === 'match');
}

function previousClearIndex(events: SessionEvent[], clearEventIndex: number): number {
  for (let index = clearEventIndex - 1; index >= 0; index -= 1) {
    if (events[index].type === 'clear') {
      return index;
    }
  }
  return -1;
}

function uniquePositionCount(cells: Position[]): number {
  return new Set(cells.map((cell) => `${cell.row}:${cell.col}`)).size;
}

function spansRowsAndColumns(cells: Position[]): boolean {
  const rows = new Set(cells.map((cell) => cell.row));
  const cols = new Set(cells.map((cell) => cell.col));
  return rows.size >= 2 && cols.size >= 2;
}
```

- [ ] **Step 4: Run the impact test and verify it passes**

Run:

```bash
pnpm vitest run src/test/impact.test.ts
```

Expected: PASS with 4 tests passing.

- [ ] **Step 5: Commit the impact model**

Run:

```bash
git add game/src/feedback/impact.ts game/src/test/impact.test.ts
git commit -m "feat: add impact feedback model"
```

---

### Task 2: Platform Haptics

**Files:**
- Modify: `game/src/platform/types.ts`
- Modify: `game/src/platform/web.ts`
- Modify: `game/src/platform/douyin.ts`
- Modify: `game/src/platform/minipack.ts`
- Create: `game/src/test/platformHaptics.test.ts`
- Modify: `game/src/test/controller.test.ts`
- Modify: `game/src/test/canvasRenderer.test.ts`
- Modify: `game/src/test/rewards.test.ts`

- [ ] **Step 1: Write failing platform haptics tests**

Create `game/src/test/platformHaptics.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createDouyinPlatformAdapter } from '../platform/douyin';
import { createMiniPackPlatformAdapter, type MiniPackGameRuntime } from '../platform/minipack';
import { createWebPlatformAdapter } from '../platform/web';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('platform haptics', () => {
  test('web adapter maps short and long haptics to navigator vibration durations', () => {
    const patterns: Array<number | number[]> = [];
    vi.stubGlobal('navigator', {
      vibrate(pattern: number | number[]) {
        patterns.push(pattern);
        return true;
      },
    });

    const adapter = createWebPlatformAdapter();
    adapter.triggerHaptic('short');
    adapter.triggerHaptic('long');

    expect(patterns).toEqual([24, 70]);
  });

  test('douyin adapter maps short and long haptics to tt vibration APIs', () => {
    const calls: string[] = [];
    vi.stubGlobal('tt', {
      vibrateShort() {
        calls.push('short');
      },
      vibrateLong() {
        calls.push('long');
      },
    });

    const adapter = createDouyinPlatformAdapter('');
    adapter.triggerHaptic('short');
    adapter.triggerHaptic('long');

    expect(calls).toEqual(['short', 'long']);
  });

  test('mini-pack adapter forwards haptics when runtime bridge exists', () => {
    const calls: string[] = [];
    const adapter = createMiniPackPlatformAdapter(miniPackRuntime({
      haptics: {
        trigger(kind) {
          calls.push(kind);
        },
      },
    }));

    adapter.triggerHaptic('short');
    adapter.triggerHaptic('long');

    expect(calls).toEqual(['short', 'long']);
  });

  test('adapters ignore missing haptic support without throwing', () => {
    vi.stubGlobal('tt', {});

    expect(() => createWebPlatformAdapter().triggerHaptic('short')).not.toThrow();
    expect(() => createDouyinPlatformAdapter('').triggerHaptic('long')).not.toThrow();
    expect(() => createMiniPackPlatformAdapter(miniPackRuntime()).triggerHaptic('short')).not.toThrow();
  });
});

function miniPackRuntime(overrides: Partial<MiniPackGameRuntime> = {}): MiniPackGameRuntime {
  return {
    canvas: { width: 750, height: 1334 } as HTMLCanvasElement,
    storage: {
      getString() {
        return null;
      },
      setString() {},
      remove() {},
    },
    audio: {
      async playSfx() {},
      async playMusic() {},
      stopMusic() {},
      setMuted() {},
    },
    ads: {
      isRewardedVideoReady() {
        return false;
      },
      async showRewardedVideo() {
        return { completed: false };
      },
    },
    rewards: {
      async canAddDesktop() {
        return false;
      },
      async requestAddDesktop() {
        return false;
      },
      async canAddFavorite() {
        return false;
      },
      async requestAddFavorite() {
        return false;
      },
      async didEnterFromSidebar() {
        return false;
      },
      async requestSidebarEntry() {
        return false;
      },
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    ...overrides,
  };
}
```

- [ ] **Step 2: Run the haptics test and verify it fails**

Run:

```bash
pnpm vitest run src/test/platformHaptics.test.ts
```

Expected: FAIL because `triggerHaptic` and `haptics` do not exist.

- [ ] **Step 3: Add haptic capability to platform types**

Update `game/src/platform/types.ts`:

```ts
import type { StorageLike } from '../app/save';

export type PlatformResultStatus = 'success' | 'failed' | 'cancelled' | 'unsupported';
export type HapticKind = 'short' | 'long';

export interface PlatformResult {
  status: PlatformResultStatus;
  message?: string;
}

export interface LaunchContext {
  isSidebarEntry: boolean;
}

export interface PlatformAdapter {
  name: string;
  storage: StorageLike;
  showRewardedAd(reason: 'extra_moves' | 'reward'): Promise<PlatformResult>;
  addDesktopShortcut(): Promise<PlatformResult>;
  showFavoriteGuide(): Promise<PlatformResult>;
  didEnterFromSidebar(): Promise<boolean>;
  requestSidebarEntry(): Promise<PlatformResult>;
  getLaunchContext(): LaunchContext;
  triggerHaptic(kind: HapticKind): void;
}
```

- [ ] **Step 4: Implement haptics in platform adapters**

In `game/src/platform/web.ts`, add `triggerHaptic` to the returned adapter and add the helper below `createWebPlatformAdapter`:

```ts
    triggerHaptic(kind) {
      triggerWebHaptic(kind);
    },
```

```ts
function triggerWebHaptic(kind: 'short' | 'long'): void {
  const browserNavigator = typeof navigator === 'undefined'
    ? null
    : navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  try {
    browserNavigator?.vibrate?.(kind === 'short' ? 24 : 70);
  } catch {
    return;
  }
}
```

In `game/src/platform/douyin.ts`, import `HapticKind`, add vibration APIs to `DouyinApi`, add `triggerHaptic`, and add a helper:

```ts
import type { HapticKind, PlatformAdapter, PlatformResult } from './types';
```

```ts
  vibrateShort?: (options?: DouyinCallbackOptions) => void;
  vibrateLong?: (options?: DouyinCallbackOptions) => void;
```

```ts
    triggerHaptic(kind) {
      triggerDouyinHaptic(tt, kind);
    },
```

```ts
function triggerDouyinHaptic(tt: DouyinApi | undefined, kind: HapticKind): void {
  try {
    if (kind === 'short') {
      tt?.vibrateShort?.({});
      return;
    }
    tt?.vibrateLong?.({});
  } catch {
    return;
  }
}
```

In `game/src/platform/minipack.ts`, import `HapticKind`, add optional runtime haptics, and add adapter forwarding:

```ts
import type { HapticKind, PlatformAdapter, PlatformResult } from './types';
```

```ts
  haptics?: {
    trigger(kind: HapticKind): void;
  };
```

```ts
    triggerHaptic(kind) {
      runtime.haptics?.trigger(kind);
    },
```

- [ ] **Step 5: Add no-op haptics to existing test mocks**

In every `mockPlatform()` that returns `PlatformAdapter`, add:

```ts
    triggerHaptic() {},
```

The affected files are:

- `game/src/test/controller.test.ts`
- `game/src/test/canvasRenderer.test.ts`
- `game/src/test/rewards.test.ts`

- [ ] **Step 6: Run haptics tests and compile-focused tests**

Run:

```bash
pnpm vitest run src/test/platformHaptics.test.ts src/test/controller.test.ts src/test/canvasRenderer.test.ts src/test/rewards.test.ts
```

Expected: PASS for all listed test files.

- [ ] **Step 7: Commit platform haptics**

Run:

```bash
git add game/src/platform/types.ts game/src/platform/web.ts game/src/platform/douyin.ts game/src/platform/minipack.ts game/src/test/platformHaptics.test.ts game/src/test/controller.test.ts game/src/test/canvasRenderer.test.ts game/src/test/rewards.test.ts
git commit -m "feat: add platform haptic bridge"
```

---

### Task 3: Renderer Impact Emission And Screen Shake

**Files:**
- Modify: `game/src/render/canvasRenderer.ts`
- Modify: `game/src/test/canvasRenderer.test.ts`

- [ ] **Step 1: Write failing renderer impact tests**

In `game/src/test/canvasRenderer.test.ts`, replace the existing test named `emits presentation audio for cascaded clears after falling pieces settle` with:

```ts
  test('emits presentation impact for cascaded clears after falling pieces settle', async () => {
    let currentNow = 0;
    const now = vi.spyOn(performance, 'now').mockImplementation(() => currentNow);
    const { canvas } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    forcePrivateSession(controller, createCascadeAnimatedSession());

    try {
      renderer.render();
      expect(consumeRendererImpact(renderer)).toMatchObject({
        level: 1,
        source: 'match',
        sound: 'match',
        haptic: 'short',
      });
      expect(consumeRendererImpact(renderer)).toBeNull();

      currentNow = 330;
      renderer.render();
      expect(consumeRendererImpact(renderer)).toMatchObject({
        level: 6,
        source: 'cascade',
        sound: 'combo',
        haptic: 'long',
      });
    } finally {
      now.mockRestore();
    }
  });
```

Add this test after the renderer impact test:

```ts
  test('applies screen shake without changing board hit testing', () => {
    let currentNow = 100;
    const now = vi.spyOn(performance, 'now').mockImplementation(() => currentNow);
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    try {
      renderer.applyImpact({
        id: 99,
        level: 9,
        source: 'winFinale',
        sound: 'win',
        haptic: 'long',
        shake: { amplitude: 10, durationMs: 280 },
      });
      currentNow = 120;
      renderer.render();

      expect(ctx.translates.some((entry) => Math.abs(entry.x) > 0.1 || Math.abs(entry.y) > 0.1)).toBe(true);
      expect(cellAt(BOARD_START_X + 4, BOARD_START_Y + 4)).toEqual({ row: 0, col: 0 });
    } finally {
      now.mockRestore();
    }
  });
```

Replace `consumeRendererAudio` with:

```ts
function consumeRendererImpact(renderer: CanvasRenderer): unknown {
  return (renderer as unknown as { consumeImpactCue(): unknown }).consumeImpactCue();
}
```

Update `createCascadeAnimatedSession()` to include `match` and `cells` data:

```ts
function createCascadeAnimatedSession(): GameSession {
  const clearOne = normalBoard('cascade-clear-1');
  const fallOne = normalBoard('cascade-fall-1');
  const refillOne = normalBoard('cascade-refill-1');
  const clearTwo = normalBoard('cascade-clear-2');
  const final = normalBoard('cascade-final');
  return {
    ...createPlayingSession(final),
    comboCount: 2,
    lastEvents: [
      { type: 'match', kind: 'shield', count: 3, cells: clearCells(3, 0) },
      { type: 'clear', cells: clearCells(3, 0), board: clearOne, phaseDurationMs: 100 },
      { type: 'fall', board: fallOne, phaseDurationMs: 100 },
      { type: 'refill', board: refillOne, phaseDurationMs: 100 },
      { type: 'match', kind: 'ammo', count: 4, cells: clearCells(4, 1) },
      { type: 'clear', cells: clearCells(4, 1), board: clearTwo, phaseDurationMs: 100 },
      { type: 'fall', board: final, phaseDurationMs: 100 },
    ],
  };
}

function clearCells(count: number, row: number): Array<{ row: number; col: number }> {
  return Array.from({ length: count }, (_, col) => ({ row, col }));
}
```

- [ ] **Step 2: Run renderer tests and verify they fail**

Run:

```bash
pnpm vitest run src/test/canvasRenderer.test.ts
```

Expected: FAIL because `consumeImpactCue` and `applyImpact` do not exist and the renderer still emits audio cues.

- [ ] **Step 3: Replace renderer audio cue fields with impact cue fields**

In `game/src/render/canvasRenderer.ts`, replace the `AudioCue` import with impact imports:

```ts
import { clamp01, easeOutCubic } from './animation';
import { impactForClearStep, impactForWinFinale, type ImpactDescriptor, type ImpactEvent } from '../feedback/impact';
```

Replace the presentation audio fields:

```ts
  private impactCue: ImpactEvent | null = null;
  private impactCueId = 20_000;
  private handledImpactKey: string | null = null;
  private screenShake: ScreenShake | null = null;
  private shakeSeed = 0;
```

Add this interface near the other renderer interfaces:

```ts
interface ScreenShake {
  startedMs: number;
  amplitude: number;
  durationMs: number;
  seed: number;
}
```

- [ ] **Step 4: Add impact consumption and screen shake methods**

Replace `consumeAudioCue()` with:

```ts
  consumeImpactCue(): ImpactEvent | null {
    const cue = this.impactCue;
    this.impactCue = null;
    return cue;
  }

  applyImpact(impact: ImpactEvent, nowMs = performance.now()): void {
    if (impact.shake.amplitude <= 0 || impact.shake.durationMs <= 0) {
      return;
    }

    this.screenShake = {
      startedMs: nowMs,
      amplitude: impact.shake.amplitude,
      durationMs: impact.shake.durationMs,
      seed: ++this.shakeSeed,
    };
  }
```

Add these private helpers:

```ts
  private queueImpact(key: string, descriptor: ImpactDescriptor): void {
    if (this.handledImpactKey === key) {
      return;
    }

    this.handledImpactKey = key;
    this.impactCue = {
      ...descriptor,
      id: ++this.impactCueId,
    };
  }

  private screenShakeOffset(nowMs: number): { x: number; y: number } {
    const shake = this.screenShake;
    if (!shake) {
      return { x: 0, y: 0 };
    }

    const progress = clamp01((nowMs - shake.startedMs) / shake.durationMs);
    if (progress >= 1) {
      this.screenShake = null;
      return { x: 0, y: 0 };
    }

    const envelope = 1 - easeOutCubic(progress);
    const wave = progress * 28 + shake.seed * 2.399963;
    const amplitude = shake.amplitude * envelope;
    return {
      x: Math.sin(wave) * amplitude,
      y: Math.cos(wave * 1.37) * amplitude,
    };
  }
```

- [ ] **Step 5: Apply screen shake to logical canvas drawing**

In `render()`, after `this.ctx.scale(this.fit.scale, this.fit.scale);`, add:

```ts
    const shake = this.screenShakeOffset(nowMs);
    this.ctx.translate(shake.x, shake.y);
```

This keeps `toLogicalPoint`, `hitAreas`, and `cellAt` unchanged because pointer math still uses the unshaken logical coordinate space.

- [ ] **Step 6: Emit impact from presentation steps and win finale**

Change `PresentationStep` to preserve event index:

```ts
interface PresentationStep {
  type: SessionEvent['type'];
  eventIndex: number;
  board: Board;
  durationMs: number;
}
```

Replace `emitPresentationStepAudio` with:

```ts
  private emitPresentationStepImpact(key: string, index: number, steps: PresentationStep[], events: SessionEvent[]): void {
    const step = steps[index];
    if (!step || step.type !== 'clear') {
      return;
    }

    const impact = impactForClearStep(events, step.eventIndex);
    if (!impact) {
      return;
    }

    this.queueImpact(`${key}:${index}`, impact);
  }
```

In `presentedBoard()`, call the new method:

```ts
      this.emitPresentationStepImpact(key, 0, steps, session.lastEvents);
```

and inside the step-advance loop:

```ts
      this.emitPresentationStepImpact(presentation.key, presentation.index, presentation.steps, session.lastEvents);
```

In `startVictoryFinale(nowMs)`, after the existing effects, add:

```ts
    this.queueImpact(`win-finale:${Math.round(nowMs)}`, impactForWinFinale());
```

Because `startVictoryFinale` is only called when result reveal enters `finale`, this key is stable enough to avoid duplicate win finale impact in normal rendering.

- [ ] **Step 7: Preserve event indexes in presentation steps**

Replace `presentationSteps()` with:

```ts
function presentationSteps(events: SessionEvent[], finalBoard: Board): PresentationStep[] {
  const steps = events
    .map((event, eventIndex) => ({ event, eventIndex }))
    .filter((entry): entry is { event: SessionEvent & { board: Board }; eventIndex: number } => Boolean(entry.event.board))
    .map(({ event, eventIndex }) => ({
      type: event.type,
      eventIndex,
      board: event.board,
      durationMs: event.phaseDurationMs ?? defaultPhaseDuration(event.type),
    }));

  if (steps.length > 0 && boardSignature(steps[steps.length - 1].board) !== boardSignature(finalBoard)) {
    steps.push({ type: 'refill', eventIndex: -1, board: finalBoard, durationMs: 420 });
  }

  return steps;
}
```

- [ ] **Step 8: Run renderer tests**

Run:

```bash
pnpm vitest run src/test/canvasRenderer.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit renderer impact emission**

Run:

```bash
git add game/src/render/canvasRenderer.ts game/src/test/canvasRenderer.test.ts
git commit -m "feat: emit impact cues from board presentation"
```

---

### Task 4: Main Loop Impact Routing

**Files:**
- Modify: `game/src/main.ts`
- Test: `game/src/test/impactRuntime.test.ts`

- [ ] **Step 1: Write a failing runtime wiring test**

Create `game/src/test/impactRuntime.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { createGame } from '../main';
import type { MiniPackGameRuntime } from '../platform/minipack';

describe('impact runtime wiring', () => {
  test('routes impact sound and haptics through the runtime frame loop', async () => {
    const sfx: string[] = [];
    const haptics: string[] = [];
    const runtime = miniPackRuntime({
      audio: {
        async playSfx(name: string) {
          sfx.push(name);
        },
        async playMusic() {},
        stopMusic() {},
        setMuted() {},
      },
      haptics: {
        trigger(kind) {
          haptics.push(kind);
        },
      },
    });

    const frameCallbacks: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);

    const app = createGame(runtime);
    app.start();
    await Promise.resolve();

    expect(typeof frameCallbacks[0]).toBe('function');
    app.destroy();

    expect(sfx).toEqual([]);
    expect(haptics).toEqual([]);
  });
});

function miniPackRuntime(overrides: Partial<MiniPackGameRuntime> = {}): MiniPackGameRuntime {
  return {
    canvas: recordingCanvas(),
    storage: {
      getString() {
        return null;
      },
      setString() {},
      remove() {},
    },
    audio: {
      async playSfx() {},
      async playMusic() {},
      stopMusic() {},
      setMuted() {},
    },
    ads: {
      isRewardedVideoReady() {
        return false;
      },
      async showRewardedVideo() {
        return { completed: false };
      },
    },
    rewards: {
      async canAddDesktop() {
        return false;
      },
      async requestAddDesktop() {
        return false;
      },
      async canAddFavorite() {
        return false;
      },
      async requestAddFavorite() {
        return false;
      },
      async didEnterFromSidebar() {
        return false;
      },
      async requestSidebarEntry() {
        return false;
      },
    },
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    ...overrides,
  };
}

function recordingCanvas(): HTMLCanvasElement {
  return {
    width: 750,
    height: 1334,
    getContext() {
      return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        globalAlpha: 1,
        createLinearGradient() {
          return { addColorStop() {} };
        },
        setTransform() {},
        save() {},
        restore() {},
        translate() {},
        scale() {},
        rotate() {},
        clearRect() {},
        fillRect() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        arc() {},
        ellipse() {},
        arcTo() {},
        bezierCurveTo() {},
        closePath() {},
        fill() {},
        stroke() {},
        fillText() {},
      };
    },
  } as unknown as HTMLCanvasElement;
}
```

This test is intentionally a compile and smoke test for the runtime shape. The actual impact routing is covered by renderer and platform tests.

- [ ] **Step 2: Run the runtime test and verify it fails before main wiring**

Run:

```bash
pnpm vitest run src/test/impactRuntime.test.ts
```

Expected: FAIL if `MiniPackGameRuntime` has no `haptics` field or if `main.ts` still calls `renderer.consumeAudioCue`.

- [ ] **Step 3: Route impact events in the main loop**

In `game/src/main.ts`, replace:

```ts
      void soundEngine.play(view.audioCue, view.save.soundEnabled);
      void soundEngine.play(renderer.consumeAudioCue(), view.save.soundEnabled);
      void soundEngine.syncMusic(view.save.musicEnabled);
```

with:

```ts
      const impact = renderer.consumeImpactCue();
      void soundEngine.play(view.audioCue, view.save.soundEnabled);
      if (impact) {
        void soundEngine.play({ type: impact.sound, id: impact.id, intensity: impact.level }, view.save.soundEnabled);
        if (impact.haptic !== 'none') {
          platform.triggerHaptic(impact.haptic);
        }
        renderer.applyImpact(impact);
      }
      void soundEngine.syncMusic(view.save.musicEnabled);
```

- [ ] **Step 4: Run runtime and related tests**

Run:

```bash
pnpm vitest run src/test/impactRuntime.test.ts src/test/canvasRenderer.test.ts src/test/platformHaptics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit main loop routing**

Run:

```bash
git add game/src/main.ts game/src/test/impactRuntime.test.ts
git commit -m "feat: route impact feedback in game loop"
```

---

### Task 5: Final Verification

**Files:**
- Verify all touched code and generated docs.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: PASS with all test files passing.

- [ ] **Step 2: Run the production build**

Run:

```bash
pnpm run build
```

Expected: PASS with `tsc --noEmit` and `vite build` succeeding.

- [ ] **Step 3: Inspect git status and recent commits**

Run:

```bash
git status --short
git log --oneline -5
```

Expected: no unstaged or uncommitted files in the worktree, and the latest commits correspond to impact model, platform haptics, renderer impact emission, and main loop routing.

- [ ] **Step 4: Report implementation result**

Final report should include:

- Impact levels implemented through `game/src/feedback/impact.ts`.
- Clear/cascade impact follows presentation timing.
- Platform haptics support Web, Douyin, and MiniPack no-op fallback.
- Screen shake is visual-only and does not change hit testing.
- `pnpm test` and `pnpm run build` results.

---

## Self-Review

- Spec coverage: The plan covers the 1-9 level table, short/long haptics, platform API routing, presentation-timed impact emission, page shake, sound reuse, and verification.
- Completion scan: No plan step leaves unresolved blanks. All new files include concrete code blocks.
- Type consistency: `ImpactEvent`, `ImpactDescriptor`, `ImpactHaptic`, `HapticKind`, `consumeImpactCue`, and `triggerHaptic` are named consistently across tasks.
