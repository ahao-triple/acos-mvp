// vivo runtime BOM/DOM polyfill 总入口（Intl / navigator / document / window / 构造器 等）。
// 必须在任何拉 pixi.js 的 import 之前求值，所以放在第一行。详见 platform/vivo/dom-polyfill.ts。
import './platform/vivo/dom-polyfill';

import { GameController } from './app/controller';
import { SoundEngine } from './audio/soundEngine';
import { setSfxEnabled, unlockSfx } from './audio/sfx';
import { loginAndLoadRemoteConfig } from './app/remoteConfig';
import { PixiRenderer } from './pixi/renderer';
import { canUseDouyinAdapter, createDouyinPlatformAdapter } from './platform/douyin';
import { createMiniPackPlatformAdapter, createMiniPackSoundOptions, type MiniPackGameApp, type MiniPackGameRuntime } from './platform/minipack';
import { probeCanvas2DText } from './platform/vivo/canvas2d-text-probe';
import { createVivoEventBridge } from './platform/vivo/event-bridge';
import { createWebPlatformAdapter } from './platform/web';

export function createGame(runtime?: MiniPackGameRuntime): MiniPackGameApp {
  const realCanvas = runtime?.canvas ?? document.querySelector<HTMLCanvasElement>('#game');
  if (!realCanvas) {
    throw new Error('Missing #game canvas');
  }

  // 一次性 vivo Canvas2D Text 渲染诊断：v1.0.37 真机 Pixi.Text 颜色失真，
  // 通过 probe 直接验证 fillStyle / fillRect / fillText 各路径上的真实行为。
  // 仅在 vivo runtime 跑（不影响浏览器、抖音、快手）；输出 4 条 log 看 vConsole。
  if (runtime?.config?.platform === 'vivo') {
    try {
      probeCanvas2DText();
    } catch (e) {
      console.warn('[main] probeCanvas2DText threw:', (e as Error).message);
    }
  }

  const platform = runtime
    ? createMiniPackPlatformAdapter(runtime)
    : canUseDouyinAdapter()
      ? createDouyinPlatformAdapter('')
      : createWebPlatformAdapter();
  const controller = new GameController(platform);
  const soundEngine = new SoundEngine(runtime ? createMiniPackSoundOptions(runtime) : {});
  let renderer: PixiRenderer | null = null;
  let running = false;
  let lastAudioCueId = 0;

  const unlockAudio = () => {
    void soundEngine.unlock();
    void unlockSfx();
  };
  const resize = () => {
    if (!renderer) {
      return;
    }
    const size = runtime ? resolveRuntimeCanvasSize(realCanvas) : browserViewportSize();
    renderer.resize(size.width, size.height);
  };
  // 音频/震动副作用 —— 旧 CanvasRenderer 每帧调 view.audioCue + impactCue，Pixi 版搬到 main 这边
  // 用 setInterval 监听 viewState.audioCue.id 变化，触发 soundEngine.play。
  // （impact cue / haptic 后续接入 visualBoard.lastEvents → controller，本期先不接，避免引入战斗实现。）
  let audioTickHandle: number | null = null;
  const startAudioTick = () => {
    audioTickHandle = globalThis.setInterval(() => {
      const view = controller.getViewState();
      // sfx.ts 直调 API（PlayingScreen 用）的 enabled 开关与 view.save.soundEnabled 同步
      setSfxEnabled(view.save.soundEnabled);
      if (view.audioCue && view.audioCue.id !== lastAudioCueId) {
        lastAudioCueId = view.audioCue.id;
        void soundEngine.play(view.audioCue, view.save.soundEnabled);
      }
      void soundEngine.syncMusic(view.save.musicEnabled);
    }, 50) as unknown as number;
  };
  const stopAudioTick = () => {
    if (audioTickHandle !== null) {
      globalThis.clearInterval(audioTickHandle);
      audioTickHandle = null;
    }
  };

  return {
    start() {
      if (running) {
        return;
      }
      running = true;

      if (!runtime) {
        prepareBrowserDocument(realCanvas);
        window.addEventListener('resize', resize);
        window.addEventListener('pointerdown', unlockAudio, { passive: true });
      }
      soundEngine.preloadInitialAssets();

      const size = runtime ? resolveRuntimeCanvasSize(realCanvas) : browserViewportSize();

      // 事件 target：
      //  - vivo 路径：mainCanvas 不一定支持标准 addEventListener，且只派发 touch* 事件。
      //    用 createVivoEventBridge 包一层 wrapperCanvas，把 pointer* 自动注册为 touch*。
      //  - 其他平台：直接用 realCanvas，浏览器原生支持 pointer events。
      const eventCanvas = runtime?.config?.platform === 'vivo'
        ? createVivoEventBridge(realCanvas)
        : realCanvas;

      renderer = new PixiRenderer({
        canvas: realCanvas,
        controller,
        viewportWidth: size.width,
        viewportHeight: size.height,
        eventCanvas,
      });
      void renderer.init().then(() => {
        if (!running) return;
        renderer?.start();
        startAudioTick();
      });

      void loginAndLoadRemoteConfig(platform, {
        serverBaseUrl: runtime?.config?.serverBaseUrl ?? '',
        gameId: 'gonglian-fangxian',
        channel: runtime?.config?.platform ?? platform.name,
      }).then((config) => {
        controller.applyRemoteConfig(config);
      });
    },
    pause() {
      renderer?.pause();
    },
    resume() {
      renderer?.resume();
    },
    destroy() {
      running = false;
      stopAudioTick();
      if (!runtime) {
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointerdown', unlockAudio);
      }
      renderer?.destroy();
      renderer = null;
    },
  };
}

if (
  typeof document !== 'undefined' &&
  typeof document.querySelector === 'function' &&
  document.querySelector<HTMLCanvasElement>('#game')
) {
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
  document.body.style.background = '#fafaf7';
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
  const miniGameGlobal = globalThis as typeof globalThis & {
    ks?: {
      getWindowInfo?: () => unknown;
      getSystemInfoSync?: () => unknown;
    };
    tt?: {
      getWindowInfo?: () => unknown;
      getSystemInfoSync?: () => unknown;
    };
    qg?: {
      getSystemInfoSync?: () => unknown;
    };
  };
  const ksInfo = asRecord(miniGameGlobal.ks?.getWindowInfo?.()) ?? asRecord(miniGameGlobal.ks?.getSystemInfoSync?.());
  const ttInfo = asRecord(miniGameGlobal.tt?.getWindowInfo?.()) ?? asRecord(miniGameGlobal.tt?.getSystemInfoSync?.());
  const qgInfo = asRecord(miniGameGlobal.qg?.getSystemInfoSync?.());
  const info = ksInfo ?? ttInfo ?? qgInfo;
  if (!info) {
    return null;
  }

  const width = readPositiveNumber(info.windowWidth) ?? readPositiveNumber(info.screenWidth);
  const height = readPositiveNumber(info.windowHeight) ?? readPositiveNumber(info.screenHeight);
  if (!width || !height) {
    return null;
  }

  // vivo（qg）：dpr 强制 1。
  if (qgInfo && info === qgInfo) {
    return { width, height, dpr: 1 };
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
