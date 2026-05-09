import { GameController, type FeedbackEvent } from './app/controller';
import { SoundEngine } from './audio/soundEngine';
import { bundledLevels, bundledManifest } from './assets/staticData';
import { CanvasRenderer } from './render/canvasRenderer';
import { createMiniPackPlatformAdapter, type MiniPackGameApp, type MiniPackGameRuntime } from './platform/minipack';
import { createWebPlatformAdapter } from './platform/web';

export function createGame(runtime?: MiniPackGameRuntime): MiniPackGameApp {
  const canvas = runtime?.canvas ?? document.querySelector<HTMLCanvasElement>('#game');
  if (!canvas) {
    throw new Error('Missing #game canvas');
  }

  const assetBase = runtime ? 'assets/' : '/';
  const manifest = bundledManifest();
  const controller = new GameController({
    levels: bundledLevels(),
    platform: runtime ? createMiniPackPlatformAdapter(runtime) : createWebPlatformAdapter(),
  });
  const sound = new SoundEngine({ runtime, baseUrl: assetBase });
  let renderer: CanvasRenderer | null = null;
  let frameHandle: number | null = null;
  let running = false;
  let paused = false;
  let lastFeedback: FeedbackEvent | null = null;

  const resize = () => {
    if (!renderer) {
      return;
    }
    const size = runtime ? resolveRuntimeCanvasSize(canvas) : browserViewportSize();
    renderer.resize(size.width, size.height, size.dpr);
  };

  const unlockAudio = () => {
    sound.unlock();
    if (runtime) {
      void sound.play('tap', controller.getViewState().save.settings.soundEnabled);
    }
  };

  const frame = () => {
    if (!renderer || !running) {
      return;
    }
    if (!paused) {
      controller.tick();
      renderer.render();
      const view = controller.getViewState();
      if (view.feedback !== lastFeedback) {
        lastFeedback = view.feedback;
        void sound.play(view.feedback.sound, view.save.settings.soundEnabled);
      }
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
      } else {
        sound.unlock();
        canvas.addEventListener('pointerdown', unlockAudio);
        canvas.addEventListener('touchstart', unlockAudio);
      }
      renderer = new CanvasRenderer(canvas, controller, manifest, assetBase);
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
      renderer?.destroy();
      renderer = null;
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
      if (!runtime) {
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointerdown', unlockAudio);
      } else {
        canvas.removeEventListener('pointerdown', unlockAudio);
        canvas.removeEventListener('touchstart', unlockAudio);
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
  document.body.style.background = '#bfe9ff';
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

function readMiniGameWindowInfo(): { width: number; height: number; dpr: number } | null {
  const tt = (globalThis as typeof globalThis & {
    tt?: {
      getWindowInfo?: () => unknown;
      getSystemInfoSync?: () => unknown;
    };
  }).tt;
  const record = asRecord(tt?.getWindowInfo?.()) ?? asRecord(tt?.getSystemInfoSync?.());
  if (!record) {
    return null;
  }
  const width = readPositiveNumber(record.windowWidth) ?? readPositiveNumber(record.screenWidth);
  const height = readPositiveNumber(record.windowHeight) ?? readPositiveNumber(record.screenHeight);
  if (!width || !height) {
    return null;
  }
  return {
    width,
    height,
    dpr: readPositiveNumber(record.pixelRatio) ?? 1,
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
