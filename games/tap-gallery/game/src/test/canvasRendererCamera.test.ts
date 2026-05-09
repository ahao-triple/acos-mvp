import { describe, expect, it, vi } from 'vitest';

import type { GameController, GameViewState } from '../app/controller';
import { defaultSave } from '../app/save';
import type { AssetManifest, LevelConfig } from '../assets/types';
import { createBoard } from '../core/board';
import type { BoardCameraState } from '../render/camera';
import { CanvasRenderer } from '../render/canvasRenderer';
import { BOARD_BOX } from '../render/layout';

class FakeCanvas {
  readonly style: Partial<CSSStyleDeclaration> = {};
  width = 750;
  height = 1334;
  private readonly listeners = new Map<string, EventListenerOrEventListenerObject[]>();

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  getContext(type: string): CanvasRenderingContext2D | null {
    return type === '2d' ? this.ctx : null;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const current = this.listeners.get(type) ?? [];
    this.listeners.set(type, current.filter((callback) => callback !== listener));
  }

  getBoundingClientRect(): Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }

  dispatch(type: string, event: Record<string, unknown>): void {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') {
        listener(event as unknown as Event);
      } else {
        listener.handleEvent(event as unknown as Event);
      }
    }
  }
}

interface RecorderContext {
  calls: Array<{ name: string; args: unknown[] }>;
  ctx: CanvasRenderingContext2D;
}

function createRecorderContext(): RecorderContext {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const gradient = { addColorStop: vi.fn() };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(object, property) {
      if (property in object) {
        return object[property as string];
      }
      if (property === 'createLinearGradient') {
        return (...args: unknown[]) => {
          calls.push({ name: String(property), args });
          return gradient;
        };
      }
      return (...args: unknown[]) => {
        calls.push({ name: String(property), args });
        return undefined;
      };
    },
    set(object, property, value) {
      object[property as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { calls, ctx };
}

function level(guidance: LevelConfig['guidance'] = {
  introCue: 'none',
  weakHintEnabled: false,
  revealFocus: true,
}): LevelConfig {
  return {
    id: 'level-12',
    levelNo: 12,
    title: 'Twelve',
    subject: 'test',
    maskImage: 'mask.png',
    revealImage: 'reveal.png',
    thumbnail: 'thumb.png',
    board: {
      width: 3,
      height: 3,
      allowPan: true,
      allowZoom: true,
      initialZoom: 1,
    },
    moves: 10,
    cellsTarget: 1,
    mechanics: [],
    idleHintDelayMs: 5000,
    guidance,
    cells: [{ index: 4, direction: 0 }],
    artStatus: 'test',
  };
}

function camera(overrides: Partial<BoardCameraState> = {}): BoardCameraState {
  return {
    scale: 1,
    x: 0,
    y: 0,
    minScale: 1,
    maxScale: 2.2,
    canPan: true,
    canZoom: true,
    isDragging: false,
    ...overrides,
  };
}

function viewState(boardCamera: BoardCameraState, overrides: Partial<Pick<GameViewState, 'guidance'>> = {}): GameViewState {
  const currentLevel = level(overrides.guidance
    ? {
        introCue: 'tap',
        weakHintEnabled: false,
        revealFocus: true,
        firstTapIndex: overrides.guidance.index,
      }
    : undefined);
  return {
    screen: 'playing',
    level: currentLevel,
    levels: [currentLevel],
    board: createBoard(currentLevel),
    camera: boardCamera,
    save: defaultSave(),
    movesLeft: 10,
    progress: 0,
    feedback: { type: 'none' },
    selectedTool: null,
    timer: {
      freezeRemainingMs: 0,
      remainingMs: null,
    },
    guidance: overrides.guidance ?? null,
    weakHint: {
      active: false,
      index: null,
    },
    reveal: {
      canContinue: false,
      elapsedMs: 0,
    },
    levelSelect: [],
  };
}

function manifest(): AssetManifest {
  return {
    designSize: { width: 750, height: 1334 },
    levelConfigIndex: 'levels.json',
    levels: [],
  };
}

function rendererFor(boardCamera: BoardCameraState, overrides: Partial<Pick<GameViewState, 'guidance'>> = {}): {
  canvas: FakeCanvas;
  controller: GameController;
  recorder: RecorderContext;
  renderer: CanvasRenderer;
} {
  const recorder = createRecorderContext();
  const canvas = new FakeCanvas(recorder.ctx);
  const controller = {
    getViewState: () => viewState(boardCamera, overrides),
    tapCell: vi.fn(),
    continueAfterWin: vi.fn(),
    retryLevel: vi.fn(),
    useHint: vi.fn(),
    selectTool: vi.fn(),
    openLevelSelect: vi.fn(),
    startLevel: vi.fn(),
    zoomBoardCamera: vi.fn(),
    panBoardCamera: vi.fn(),
  } as unknown as GameController;
  const renderer = new CanvasRenderer(canvas as unknown as HTMLCanvasElement, controller, manifest(), '/');
  return { canvas, controller, recorder, renderer };
}

describe('canvas renderer board camera integration', () => {
  it('applies the board camera transform while rendering cells', () => {
    const { recorder, renderer } = rendererFor(camera({ scale: 1.8, x: 30, y: -20 }));

    renderer.render();

    expect(recorder.calls).toContainEqual({ name: 'translate', args: [BOARD_BOX.x + BOARD_BOX.size / 2 + 30, BOARD_BOX.y + BOARD_BOX.size / 2 - 20] });
    expect(recorder.calls).toContainEqual({ name: 'scale', args: [1.8, 1.8] });
  });

  it('draws guidance labels after restoring the clipped board camera layer', () => {
    const { recorder, renderer } = rendererFor(camera(), { guidance: { type: 'firstTap', index: 4, label: '点击' } });

    renderer.render();

    const toolLabelIndex = recorder.calls.findIndex((call) => call.name === 'fillText' && call.args[0] === '提示');
    let boardRestoreIndex = -1;
    for (let index = 0; index < toolLabelIndex; index += 1) {
      if (recorder.calls[index].name === 'restore') {
        boardRestoreIndex = index;
      }
    }
    const labelIndex = recorder.calls.findIndex((call) => call.name === 'fillText' && call.args[0] === '点击');

    expect(labelIndex).toBeGreaterThan(boardRestoreIndex);
    expect(labelIndex).toBeLessThan(toolLabelIndex);
  });

  it('zooms around the pointer on wheel input inside the board', () => {
    const preventDefault = vi.fn();
    const { canvas, controller } = rendererFor(camera({ scale: 1 }));

    canvas.dispatch('wheel', {
      clientX: BOARD_BOX.x + BOARD_BOX.size / 2,
      clientY: BOARD_BOX.y + BOARD_BOX.size / 2,
      deltaY: -120,
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(controller.zoomBoardCamera).toHaveBeenCalledWith(expect.any(Number), { x: 330, y: 330 });
    expect(vi.mocked(controller.zoomBoardCamera).mock.calls[0][0]).toBeGreaterThan(1);
  });

  it('toggles zoom on double click inside the board', () => {
    const { canvas, controller } = rendererFor(camera({ scale: 1 }));

    canvas.dispatch('dblclick', {
      clientX: BOARD_BOX.x + BOARD_BOX.size / 2,
      clientY: BOARD_BOX.y + BOARD_BOX.size / 2,
      preventDefault: vi.fn(),
    });

    expect(controller.zoomBoardCamera).toHaveBeenCalledWith(1.8, { x: 330, y: 330 });
  });

  it('pans a zoomed board on pointer drag', () => {
    const { canvas, controller } = rendererFor(camera({ scale: 1.8 }));

    canvas.dispatch('pointerdown', {
      clientX: BOARD_BOX.x + BOARD_BOX.size / 2,
      clientY: BOARD_BOX.y + BOARD_BOX.size / 2,
      pointerId: 1,
      preventDefault: vi.fn(),
    });
    canvas.dispatch('pointermove', {
      clientX: BOARD_BOX.x + BOARD_BOX.size / 2 + 24,
      clientY: BOARD_BOX.y + BOARD_BOX.size / 2 + 18,
      pointerId: 1,
      preventDefault: vi.fn(),
    });
    canvas.dispatch('pointerup', {
      clientX: BOARD_BOX.x + BOARD_BOX.size / 2 + 24,
      clientY: BOARD_BOX.y + BOARD_BOX.size / 2 + 18,
      pointerId: 1,
      preventDefault: vi.fn(),
    });

    expect(controller.panBoardCamera).toHaveBeenCalledWith({ dx: 24, dy: 18 });
    expect(controller.tapCell).not.toHaveBeenCalled();
  });

  it('zooms around the two-finger midpoint on pinch input', () => {
    const preventDefault = vi.fn();
    const { canvas, controller } = rendererFor(camera({ scale: 1 }));

    canvas.dispatch('touchstart', {
      touches: [
        { clientX: BOARD_BOX.x + 280, clientY: BOARD_BOX.y + 330 },
        { clientX: BOARD_BOX.x + 380, clientY: BOARD_BOX.y + 330 },
      ],
      preventDefault,
    });
    canvas.dispatch('touchmove', {
      touches: [
        { clientX: BOARD_BOX.x + 250, clientY: BOARD_BOX.y + 330 },
        { clientX: BOARD_BOX.x + 410, clientY: BOARD_BOX.y + 330 },
      ],
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(controller.zoomBoardCamera).toHaveBeenCalledWith(1.6, { x: 330, y: 330 });
    expect(controller.tapCell).not.toHaveBeenCalled();
  });
});
