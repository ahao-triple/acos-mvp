import { describe, expect, test } from 'vitest';

import { GameController } from '../app/controller';
import type { PlatformAdapter } from '../platform/types';
import { CanvasRenderer } from '../render/canvasRenderer';

describe('CanvasRenderer mini game canvas compatibility', () => {
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

  test('centers regular button text vertically', () => {
    const { canvas, ctx } = createRecordingCanvas();
    const renderer = new CanvasRenderer(canvas, new GameController(mockPlatform()));

    drawPrivateButton(renderer, 10, 20, 120, 50, '继续');

    expect(ctx.fillTexts.find((entry) => entry.text === '继续')).toMatchObject({
      x: 70,
      y: 45,
      align: 'center',
      baseline: 'middle',
    });
  });

  test('lays out rewarded-video button icon and label without overlap', () => {
    const { canvas, ctx } = createRecordingCanvas();
    const renderer = new CanvasRenderer(canvas, new GameController(mockPlatform()));

    drawPrivateAdButton(renderer, 60, 1148, 190, 70, '看广告炸开');

    const label = ctx.fillTexts.find((entry) => entry.text === '看广告炸开');
    const icon = ctx.translates.find((entry) => entry.x === 60 + 190 * 0.12);
    expect(label).toMatchObject({
      y: 1183,
      align: 'left',
      baseline: 'middle',
    });
    expect(icon).toBeDefined();
    expect(label?.x).toBeGreaterThan((icon?.x ?? 0) + 38);
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

function drawPrivateButton(renderer: CanvasRenderer, x: number, y: number, width: number, height: number, label: string): void {
  (renderer as unknown as { drawButton(x: number, y: number, width: number, height: number, label: string, action: { type: 'start' }): void }).drawButton(x, y, width, height, label, { type: 'start' });
}

function drawPrivateAdButton(renderer: CanvasRenderer, x: number, y: number, width: number, height: number, label: string): void {
  (renderer as unknown as { drawAdButton(x: number, y: number, width: number, height: number, label: string, action: { type: 'start' }): void }).drawAdButton(x, y, width, height, label, { type: 'start' });
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
    setTransform() {},
    save() {},
    restore() {},
    translate(x: number, y: number) {
      this.translates.push({ x, y });
    },
    scale() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
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
