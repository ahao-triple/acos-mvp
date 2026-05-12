import { GameController } from './app/controller';
import { bootstrapVivoSession } from './app/vivoBootstrap';
import { differenceHuntLevels } from './assets/levels';
import { createMiniPackPlatformAdapter, type MiniPackGameApp, type MiniPackGameRuntime } from './platform/minipack';
import { createWebPlatformAdapter } from './platform/web';
import { CanvasRenderer } from './render/canvasRenderer';
import { WebglRenderer } from './render/webglRenderer';

type Renderer = CanvasRenderer | WebglRenderer;
export type RendererKind = 'canvas' | 'webgl';

export function createGame(runtime?: MiniPackGameRuntime): MiniPackGameApp {
  const canvas = runtime?.canvas ?? getBrowserCanvas();
  if (!canvas) {
    throw new Error('Missing #game canvas');
  }

  const platform = runtime ? createMiniPackPlatformAdapter(runtime) : createWebPlatformAdapter();
  if (runtime) {
    void bootstrapVivoSession(runtime);
  }
  const controller = new GameController({
    levels: differenceHuntLevels,
    storage: platform.storage,
    platform,
  });
  const assetBase = resolveAssetBase(runtime);
  let renderer: Renderer | null = null;
  let frameHandle: number | null = null;
  let running = false;
  let paused = false;

  const resize = () => {
    if (!renderer) {
      return;
    }
    const size = runtime ? resolveRuntimeCanvasSize(canvas) : browserViewportSize();
    renderer.resize(size.width, size.height, size.dpr);
  };

  const frame = () => {
    if (!renderer || !running) {
      return;
    }
    if (!paused) {
      controller.tick();
      renderer.render();
      runtime?.present?.();
    }
    frameHandle = requestFrame(frame);
  };

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      paused = false;
      if (!runtime) {
        prepareBrowserDocument(canvas);
        window.addEventListener('resize', resize);
      }
      renderer = selectRendererKind(runtime) === 'webgl'
        ? new WebglRenderer(canvas, controller, assetBase, runtime?.createCanvas)
        : new CanvasRenderer(canvas, controller, assetBase);
      resize();
      controller.syncBackgroundMusic();
      frame();
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    destroy() {
      running = false;
      platform.stopMusic();
      renderer?.destroy();
      renderer = null;
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
      if (!runtime) {
        window.removeEventListener('resize', resize);
      }
    },
  };
}

function getBrowserCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') {
    return null;
  }
  return document.querySelector('#game');
}

if (getBrowserCanvas() && !isMiniGameRuntime()) {
  createGame().start();
}

function prepareBrowserDocument(canvas: HTMLCanvasElement): void {
  document.documentElement.style.margin = '0';
  document.documentElement.style.width = '100%';
  document.documentElement.style.height = '100%';
  document.body.style.margin = '0';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#d9eef6';
  canvas.style.display = 'block';
}

function browserViewportSize(): { width: number; height: number; dpr: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  };
}

export function resolveRuntimeCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number; dpr: number } {
  const info = readMiniGameWindowInfo();
  if (info) {
    return info;
  }
  return {
    width: canvas.width || 750,
    height: canvas.height || 1334,
    dpr: 1,
  };
}

export function resolveAssetBase(runtime?: MiniPackGameRuntime): string {
  return runtime ? '' : '/';
}

export function selectRendererKind(runtime?: MiniPackGameRuntime): RendererKind {
  return runtime?.renderMode === 'webgl' ? 'webgl' : 'canvas';
}

function readMiniGameWindowInfo(): { width: number; height: number; dpr: number } | null {
  const g = globalThis as typeof globalThis & {
    tt?: { getWindowInfo?: () => unknown; getSystemInfoSync?: () => unknown };
    qg?: { getSystemInfoSync?: () => unknown };
  };
  const ttInfo = asRecord(g.tt?.getWindowInfo?.()) ?? asRecord(g.tt?.getSystemInfoSync?.());
  const qgInfo = asRecord(g.qg?.getSystemInfoSync?.());
  const record = ttInfo ?? qgInfo;
  if (!record) {
    return null;
  }
  const rawWidth = readPositiveNumber(record.windowWidth) ?? readPositiveNumber(record.screenWidth);
  const rawHeight = readPositiveNumber(record.windowHeight) ?? readPositiveNumber(record.screenHeight);
  const dpr = readPositiveNumber(record.pixelRatio) ?? 1;
  if (!rawWidth || !rawHeight) {
    return null;
  }
  if (qgInfo) {
    return {
      width: rawWidth,
      height: rawHeight,
      dpr: 1,
    };
  }
  return {
    width: rawWidth,
    height: rawHeight,
    dpr,
  };
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function isMiniGameRuntime(): boolean {
  const g = globalThis as typeof globalThis & {
    qg?: unknown;
    tt?: unknown;
  };
  return !!g.qg || !!g.tt;
}

function requestFrame(callback: FrameRequestCallback): number {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }
  const globalSetTimeout = (globalThis as typeof globalThis & { setTimeout?: typeof setTimeout }).setTimeout;
  if (typeof globalSetTimeout === 'function') {
    return globalSetTimeout(() => callback(Date.now()), 16);
  }
  return 0;
}

function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
    return;
  }
  const globalClearTimeout = (globalThis as typeof globalThis & { clearTimeout?: typeof clearTimeout }).clearTimeout;
  if (typeof globalClearTimeout === 'function' && handle !== 0) {
    globalClearTimeout(handle);
  }
}
