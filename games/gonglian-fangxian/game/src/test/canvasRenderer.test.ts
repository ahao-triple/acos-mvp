import { describe, expect, test } from 'vitest';

import { GameController, type WinSummary } from '../app/controller';
import type { PlatformAdapter } from '../platform/types';
import { CanvasRenderer } from '../render/canvasRenderer';
import { targetLabel, targetProgressText } from '../render/theme';
import { drawAdButton, drawButton } from '../render/uiPrimitives';

describe('CanvasRenderer mini game canvas compatibility', () => {
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

    renderer.render();
    await handlePointer(renderer, { clientX: 375, clientY: 705 });

    expect(controller.getViewState().screen).toBe('won');
    expect(controller.getViewState().winSummary?.doubled).toBe(true);
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

function forcePrivateWinSummary(controller: GameController, summary: WinSummary): void {
  const writableController = controller as unknown as { screen: 'won'; winSummary: WinSummary };
  writableController.screen = 'won';
  writableController.winSummary = summary;
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
}

function createRecordingContext(): RecordingContext {
  return {
    fillTexts: [],
    translates: [],
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
  };
}
