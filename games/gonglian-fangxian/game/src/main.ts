import { GameController } from './app/controller';
import { SoundEngine } from './audio/soundEngine';
import { CanvasRenderer } from './render/canvasRenderer';
import { canUseDouyinAdapter, createDouyinPlatformAdapter } from './platform/douyin';
import { createMiniPackPlatformAdapter, createMiniPackSoundOptions, type MiniPackGameApp, type MiniPackGameRuntime } from './platform/minipack';
import { createWebPlatformAdapter } from './platform/web';

export function createGame(runtime?: MiniPackGameRuntime): MiniPackGameApp {
  const canvas = runtime?.canvas ?? document.querySelector<HTMLCanvasElement>('#game');
  if (!canvas) {
    throw new Error('Missing #game canvas');
  }

  const platform = runtime
    ? createMiniPackPlatformAdapter(runtime)
    : canUseDouyinAdapter()
      ? createDouyinPlatformAdapter('')
      : createWebPlatformAdapter();
  const controller = new GameController(platform);
  const soundEngine = new SoundEngine(runtime ? createMiniPackSoundOptions(runtime) : {});
  let renderer: CanvasRenderer | null = null;
  let frameHandle: number | null = null;
  let running = false;
  let paused = false;

  const unlockAudio = () => {
    void soundEngine.unlock();
  };
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
      renderer.render();
      const view = controller.getViewState();
      void soundEngine.play(view.audioCue, view.save.soundEnabled);
      void soundEngine.syncMusic(view.save.musicEnabled);
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
        window.addEventListener('pointerdown', unlockAudio, { passive: true });
      }
      soundEngine.preloadInitialAssets();
      renderer = new CanvasRenderer(canvas, controller);
      resize();
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
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
      if (!runtime) {
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointerdown', unlockAudio);
      }
    },
  };
}

if (typeof document !== 'undefined' && document.querySelector<HTMLCanvasElement>('#game')) {
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
  document.body.style.background = '#020617';
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
  const miniGameWindow = readMiniGameWindowInfo();
  if (miniGameWindow) {
    return miniGameWindow;
  }

  return {
    width: canvas.width || 750,
    height: canvas.height || 1334,
    dpr: 1,
  };
}

function readMiniGameWindowInfo(): { width: number; height: number; dpr: number } | null {
  const tt = (globalThis as typeof globalThis & {
    tt?: {
      getWindowInfo?: () => unknown;
      getSystemInfoSync?: () => unknown;
    };
  }).tt;
  const info = asRecord(tt?.getWindowInfo?.()) ?? asRecord(tt?.getSystemInfoSync?.());
  if (!info) {
    return null;
  }

  const width = readPositiveNumber(info.windowWidth) ?? readPositiveNumber(info.screenWidth);
  const height = readPositiveNumber(info.windowHeight) ?? readPositiveNumber(info.screenHeight);
  if (!width || !height) {
    return null;
  }

  return {
    width,
    height,
    dpr: readPositiveNumber(info.pixelRatio) ?? 1,
  };
}

function readPositiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function requestFrame(callback: FrameRequestCallback): number {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(Date.now()), 16);
}

function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
    return;
  }

  clearTimeout(handle);
}
