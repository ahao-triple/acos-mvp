import { describe, expect, test, vi } from 'vitest';

import { GameController, type WinSummary } from '../app/controller';
import type { Board, GameSession } from '../core/types';
import type { PlatformAdapter } from '../platform/types';
import { CanvasRenderer } from '../render/canvasRenderer';
import { BOARD_CELL_SIZE, BOARD_GAP, BOARD_START_X, BOARD_START_Y, cellAt } from '../render/gameScreen';
import { targetLabel, targetProgressText } from '../render/theme';
import { drawAdButton, drawButton } from '../render/uiPrimitives';

describe('CanvasRenderer mini game canvas compatibility', () => {
  test('renders campaign home progress text', () => {
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);

    renderer.render();

    const text = ctx.fillTexts.map((entry) => entry.text).join('\n');
    expect(text).toContain('共联防线软件');
    expect(text).toContain('前线集结');
    expect(text).toContain('1/30');
    expect(text).toContain('继续作战');
  });

  test('renders when mini game runtime has no global performance object', () => {
    const originalPerformance = globalThis.performance;
    Reflect.deleteProperty(globalThis, 'performance');
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);

    try {
      expect(() => renderer.render()).not.toThrow();
      expect(renderedText(ctx)).toContain('共联防线软件');
    } finally {
      Object.defineProperty(globalThis, 'performance', {
        configurable: true,
        value: originalPerformance,
        writable: true,
      });
    }
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
    expect(text).toContain('护盾 0/12');
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
    forcePrivateSessionNull(controller);

    renderer.render();

    const text = ctx.fillTexts.map((entry) => entry.text).join('\n');
    expect(text).toContain('防线推进');
    expect(text).toContain('获得金币 70');
    expect(text).toContain('奖励翻倍');
  });

  test('win reward button opens a rewarded ad confirmation modal', async () => {
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    forcePrivateWinSummary(controller, {
      levelId: 1,
      chapterTitle: '前线集结',
      baseCoins: 70,
      nodeReward: null,
      nextLevelId: 2,
      doubled: false,
    });
    forcePrivateSessionNull(controller);

    renderer.render();
    await handlePointer(renderer, { clientX: 375, clientY: 705 });
    renderer.render();

    const text = renderedText(ctx);
    expect(text).toContain('观看视频让本关金币奖励翻倍');
    expect(text).toContain('确认观看');
    expect(text).toContain('取消');
  });

  test('renders legacy special pieces as ordinary pieces without special symbols', async () => {
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    forcePrivateSession(controller, createPlayingSession(specialBoard()));

    renderer.render();

    const text = renderedText(ctx);
    expect(text).not.toContain('爆');
    expect(text).not.toContain('横');
    expect(text).not.toContain('竖');
    expect(ctx.rotations).not.toContain(Math.PI / 2);
  });

  test('shows coin costs on missing power-up buttons', async () => {
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    forcePrivateSession(controller, createPlayingSession(normalBoard('cost')));

    renderer.render();

    const text = renderedText(ctx);
    expect(text).toContain('120币炸开');
    expect(text).toContain('150币吸走');
    expect(text).toContain('100币重排');
  });

  test('delays win result while board presentation is still playing', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(100);
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    forcePrivateWonSession(controller, createWonAnimatedSession());

    try {
      renderer.render();

      const text = renderedText(ctx);
      expect(text).not.toContain('防线推进');
      expect(text).not.toContain('奖励翻倍');
    } finally {
      now.mockRestore();
    }
  });

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

  test('preserves multiple cascaded impacts emitted during one delayed render', async () => {
    let currentNow = 0;
    const now = vi.spyOn(performance, 'now').mockImplementation(() => currentNow);
    const { canvas } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    forcePrivateSession(controller, createTripleCascadeAnimatedSession());

    try {
      renderer.render();
      expect(consumeRendererImpact(renderer)).toMatchObject({ level: 1, source: 'match' });
      expect(consumeRendererImpact(renderer)).toBeNull();

      currentNow = 630;
      renderer.render();

      expect(consumeRendererImpact(renderer)).toMatchObject({ level: 6, source: 'cascade' });
      expect(consumeRendererImpact(renderer)).toMatchObject({ level: 7, source: 'cascade' });
      expect(consumeRendererImpact(renderer)).toBeNull();
    } finally {
      now.mockRestore();
    }
  });

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

  test('win result blocks hidden gameplay hit areas', async () => {
    const { canvas } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'beginLevel' });
    forcePrivateWinSummary(controller, {
      levelId: 1,
      chapterTitle: '前线集结',
      baseCoins: 70,
      nodeReward: null,
      nextLevelId: 2,
      doubled: false,
    });

    renderer.render();
    await handlePointer(renderer, { clientX: 625, clientY: 157 });

    expect(controller.getViewState().screen).toBe('won');
  });

  test('win result keeps coin doubling action interactive', async () => {
    const { canvas } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'beginLevel' });
    forcePrivateWinSummary(controller, {
      levelId: 1,
      chapterTitle: '前线集结',
      baseCoins: 70,
      nodeReward: null,
      nextLevelId: 2,
      doubled: false,
    });
    forcePrivateSessionNull(controller);

    renderer.render();
    await handlePointer(renderer, { clientX: 375, clientY: 705 });
    renderer.render();
    await handlePointer(renderer, { clientX: 242, clientY: 667 });

    expect(controller.getViewState().screen).toBe('won');
    expect(controller.getViewState().winSummary?.doubled).toBe(true);
  });

  test('win result blocks hidden board cell taps', async () => {
    const { canvas } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'beginLevel' });
    forcePrivateWinSummary(controller, {
      levelId: 1,
      chapterTitle: '前线集结',
      baseCoins: 70,
      nodeReward: null,
      nextLevelId: 2,
      doubled: false,
    });
    forcePrivateFeedback(controller, '奖励待领取');

    renderer.render();
    await wait(700);
    await handlePointer(renderer, { clientX: 100, clientY: 340 });

    expect(controller.getViewState().screen).toBe('won');
    expect(controller.getViewState().feedback).toBe('奖励待领取');
  });

  test('renders the campaign briefing after start', async () => {
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    await controller.dispatch({ type: 'start' });
    renderer.render();

    const text = renderedText(ctx);
    expect(text).toContain('作战简报');
    expect(text).toContain('开始作战');
  });

  test('briefing start button begins the pending level', async () => {
    const { canvas } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    await controller.dispatch({ type: 'start' });
    renderer.render();
    await handlePointer(renderer, { clientX: 375, clientY: 1049 });

    expect(controller.getViewState().screen).toBe('playing');
  });

  test('renders the supplies screen', async () => {
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    await controller.dispatch({ type: 'openSupplies' });
    renderer.render();

    const text = renderedText(ctx);
    expect(text).toContain('补给');
    expect(text).toContain('侧边栏复访任务');
    expect(text).toContain('任务指引：点击下方按钮打开侧边栏');
    expect(text).toContain('从侧边栏卡片重新进入游戏后领取奖励');
    expect(text).toContain('奖励：80金币，仅可领取一次');
    expect(text).toContain('返回');
  });

  test('menu supplies button opens the supplies screen', async () => {
    const { canvas, ctx } = createRecordingCanvas();
    const controller = new GameController(mockPlatform());
    const renderer = new CanvasRenderer(canvas, controller);
    renderer.resize(750, 1334, 1);

    renderer.render();

    const text = renderedText(ctx);
    expect(text).toContain('补给');

    await handlePointer(renderer, { clientX: 375, clientY: 661 });

    expect(controller.getViewState().screen).toBe('supplies');
  });

  test('resizes a canvas without DOM style fields', () => {
    const canvas = createMiniGameCanvas();
    const renderer = new CanvasRenderer(canvas, new GameController(mockPlatform()));

    expect(() => renderer.resize(750, 1334, 1)).not.toThrow();
    expect(canvas.width).toBe(750);
    expect(canvas.height).toBe(1334);
  });

  test('handles pointer events on a canvas without DOM bounds', async () => {
    const canvas = createMiniGameCanvas();
    const renderer = new CanvasRenderer(canvas, new GameController(mockPlatform()));
    renderer.resize(750, 1334, 1);

    await expect(handlePointer(renderer, { clientX: 100, clientY: 340 })).resolves.toBeUndefined();
    await expect(handlePointer(renderer, { touches: [{ clientX: 100, clientY: 340 }] })).resolves.toBeUndefined();
    await expect(handlePointer(renderer, { touches: [{ x: 100, y: 340 }] })).resolves.toBeUndefined();
  });

  test('maps the full 10x10 board to logical canvas cells', () => {
    expect(cellAt(BOARD_START_X + 9 * (BOARD_CELL_SIZE + BOARD_GAP) + 1, BOARD_START_Y + 9 * (BOARD_CELL_SIZE + BOARD_GAP) + 1)).toEqual({
      row: 9,
      col: 9,
    });
    expect(BOARD_START_X + 10 * BOARD_CELL_SIZE + 9 * BOARD_GAP).toBeLessThanOrEqual(716);
    expect(BOARD_START_Y + 10 * BOARD_CELL_SIZE + 9 * BOARD_GAP).toBeLessThanOrEqual(958);
  });

  test('formats level targets with player-facing Chinese labels', () => {
    expect(targetLabel('shield')).toBe('护盾');
    expect(targetLabel('energy')).toBe('能量');
    expect(targetProgressText({ type: 'collect', kind: 'shield', count: 8 }, { shield: 3 })).toBe('护盾 3/8');
    expect(targetProgressText({ type: 'collect', kind: 'energy', count: 6 }, { energy: 2 })).toBe('能量 2/6');
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
    const icon = ctx.translates.find((entry) => entry.y === 1148 + 21);
    expect(label).toMatchObject({
      y: 1183,
      align: 'left',
      baseline: 'middle',
    });
    expect(icon).toBeDefined();
    expect(label?.x).toBeGreaterThan((icon?.x ?? 0) + 38);
    expect(hitAreas).toHaveLength(1);
  });
});

function createMiniGameCanvas(): HTMLCanvasElement & { width: number; height: number } {
  return {
    width: 0,
    height: 0,
    getContext() {
      return {
        setTransform() {},
      };
    },
  } as unknown as HTMLCanvasElement & { width: number; height: number };
}

function handlePointer(renderer: CanvasRenderer, event: unknown): Promise<void> {
  return (renderer as unknown as { handlePointer(event: unknown): Promise<void> }).handlePointer(event);
}

function consumeRendererImpact(renderer: CanvasRenderer): unknown {
  return (renderer as unknown as { consumeImpactCue(): unknown }).consumeImpactCue();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function forcePrivateWinSummary(controller: GameController, summary: WinSummary): void {
  const writableController = controller as unknown as { screen: 'won'; winSummary: WinSummary };
  writableController.screen = 'won';
  writableController.winSummary = summary;
}

function forcePrivateSession(controller: GameController, session: GameSession): void {
  const writableController = controller as unknown as { screen: 'playing'; session: GameSession };
  writableController.screen = 'playing';
  writableController.session = session;
}

function forcePrivateSessionNull(controller: GameController): void {
  const writableController = controller as unknown as { session: null };
  writableController.session = null;
}

function forcePrivateWonSession(controller: GameController, session: GameSession): void {
  const writableController = controller as unknown as { screen: 'won'; session: GameSession; winSummary: WinSummary };
  writableController.screen = 'won';
  writableController.session = session;
  writableController.winSummary = {
    levelId: 1,
    chapterTitle: '前线集结',
    baseCoins: 70,
    nodeReward: null,
    nextLevelId: 2,
    doubled: false,
  };
}

function forcePrivateFeedback(controller: GameController, feedback: string): void {
  const writableController = controller as unknown as { feedback: string };
  writableController.feedback = feedback;
}

function createPlayingSession(board: Board): GameSession {
  return {
    levelId: 1,
    board,
    movesLeft: 12,
    targetProgress: {},
    targets: [{ type: 'collect', kind: 'shield', count: 8 }],
    selectedCell: null,
    comboCount: 0,
    status: 'playing',
    lastEvents: [],
    piecePool: ['shield', 'ammo', 'radar', 'medal', 'wrench'],
  };
}

function createWonAnimatedSession(): GameSession {
  const before = normalBoard('before');
  const after = normalBoard('after');
  return {
    ...createPlayingSession(after),
    status: 'won',
    lastEvents: [
      { type: 'clear', board: before, phaseDurationMs: 680 },
      { type: 'refill', board: after, phaseDurationMs: 720 },
      { type: 'win' },
    ],
  };
}

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

function createTripleCascadeAnimatedSession(): GameSession {
  const clearOne = normalBoard('triple-cascade-clear-1');
  const fallOne = normalBoard('triple-cascade-fall-1');
  const refillOne = normalBoard('triple-cascade-refill-1');
  const clearTwo = normalBoard('triple-cascade-clear-2');
  const fallTwo = normalBoard('triple-cascade-fall-2');
  const refillTwo = normalBoard('triple-cascade-refill-2');
  const clearThree = normalBoard('triple-cascade-clear-3');
  const final = normalBoard('triple-cascade-final');
  return {
    ...createPlayingSession(final),
    comboCount: 3,
    lastEvents: [
      { type: 'match', kind: 'shield', count: 3, cells: clearCells(3, 0) },
      { type: 'clear', cells: clearCells(3, 0), board: clearOne, phaseDurationMs: 100 },
      { type: 'fall', board: fallOne, phaseDurationMs: 100 },
      { type: 'refill', board: refillOne, phaseDurationMs: 100 },
      { type: 'match', kind: 'ammo', count: 4, cells: clearCells(4, 1) },
      { type: 'clear', cells: clearCells(4, 1), board: clearTwo, phaseDurationMs: 100 },
      { type: 'fall', board: fallTwo, phaseDurationMs: 100 },
      { type: 'refill', board: refillTwo, phaseDurationMs: 100 },
      { type: 'match', kind: 'radar', count: 4, cells: clearCells(4, 2) },
      { type: 'clear', cells: clearCells(4, 2), board: clearThree, phaseDurationMs: 100 },
      { type: 'fall', board: final, phaseDurationMs: 100 },
    ],
  };
}

function clearCells(count: number, row: number): Array<{ row: number; col: number }> {
  return Array.from({ length: count }, (_, col) => ({ row, col }));
}

function specialBoard(): Board {
  const board = normalBoard('special');
  board[0][0] = {
    kind: 'special',
    pieceKind: 'shield',
    specialKind: 'areaBomb',
    id: 'special-area-bomb',
  };
  board[0][1] = {
    kind: 'special',
    pieceKind: 'ammo',
    specialKind: 'horizontalRocket',
    id: 'special-horizontal',
  };
  board[0][2] = {
    kind: 'special',
    pieceKind: 'radar',
    specialKind: 'verticalFlare',
    id: 'special-vertical',
  };
  return board;
}

function normalBoard(prefix: string): Board {
  return Array.from({ length: 7 }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => ({
      kind: 'normal' as const,
      pieceKind: 'shield' as const,
      id: `${prefix}-${row}-${col}`,
    })),
  );
}

function renderedText(ctx: RecordingContext): string {
  return ctx.fillTexts.map((entry) => entry.text).join('\n');
}

function createRecordingCanvas(): {
  canvas: HTMLCanvasElement & { width: number; height: number };
  ctx: RecordingContext;
} {
  const ctx = createRecordingContext();
  return {
    canvas: {
      width: 0,
      height: 0,
      getContext() {
        return ctx;
      },
    } as unknown as HTMLCanvasElement & { width: number; height: number },
    ctx,
  };
}

function createRecordingUi(): { ctx: RecordingContext & CanvasRenderingContext2D; hitAreas: Array<{ x: number; y: number; width: number; height: number; action: { type: 'start' } }> } {
  return {
    ctx: createRecordingContext() as RecordingContext & CanvasRenderingContext2D,
    hitAreas: [],
  };
}

interface RecordingGradient {
  addColorStop(offset: number, color: string): void;
}

interface RecordingContext extends Partial<CanvasRenderingContext2D> {
  fillTexts: Array<{ text: string; x: number; y: number; align: CanvasTextAlign; baseline: CanvasTextBaseline }>;
  translates: Array<{ x: number; y: number }>;
  rotations: number[];
}

function createRecordingContext(): RecordingContext {
  return {
    fillTexts: [],
    translates: [],
    rotations: [],
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    createLinearGradient(): RecordingGradient {
      return {
        addColorStop() {},
      };
    },
    setTransform() {},
    save() {},
    restore() {},
    translate(x: number, y: number) {
      this.translates.push({ x, y });
    },
    scale() {},
    rotate(angle: number) {
      this.rotations.push(angle);
    },
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
    fillText(text: string, x: number, y: number) {
      this.fillTexts.push({
        text,
        x,
        y,
        align: this.textAlign ?? 'start',
        baseline: this.textBaseline ?? 'alphabetic',
      });
    },
  };
}

function mockPlatform(): PlatformAdapter {
  return {
    name: 'test',
    storage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    async showRewardedAd() {
      return { status: 'unsupported' };
    },
    async addDesktopShortcut() {
      return { status: 'unsupported' };
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
    triggerHaptic() {},
  };
}
