/**
 * PixiRenderer：gonglian Phase 1 渲染层主入口。
 *
 * 职责：
 *  - 初始化 Pixi Application + 舞台分层
 *  - 注册所有 screens 实例
 *  - 每帧：primary screen + 可选 modal screen 双轨切显示 + update
 *  - resize 时同步舞台缩放
 *
 * Screen 调度（modal 叠加）：
 *  - primary screen（独占底层）：menu / levels / playing
 *  - modal screen（叠在 primary 之上）：paused / won / lost / settings / supplies
 *  - view.screen 是 modal 时，primary 保持显示（playing 继续 visualBoard tween / effects 推进），
 *    modal 内容叠加；旧 canvasRenderer 也是同样的视觉效果（modal case 自己画底层背景 + 浮层）。
 *  - primary 由 view 推断：view.session 存在则 'playing'，否则 'menu'。
 */
import { Assets, type Application } from 'pixi.js';
import type { AppAction, AppViewState, Screen as ScreenName } from '../app/controller';
import type { GameController } from '../app/controller';
import { createPixiApp, type PixiAppHandle } from './app';
import { createStage, resizeStage, type StageLayers } from './stage';
import { LoadingScreen } from './screens/loading';
import { MenuScreen } from './screens/menu';
import { LevelsScreen } from './screens/levels';
import { PausedScreen, WonScreen, LostScreen } from './screens/result';
import { markAtlasReady } from './ui/text';
import { SettingsScreen } from './screens/settings';
import { SuppliesScreen } from './screens/supplies';
import { PlayingScreen } from './screens/playing';
import type { PixiScreen, ScreenContext } from './screens/base';

const MODAL_SCREENS: ReadonlySet<ScreenName> = new Set<ScreenName>([
  'paused',
  'won',
  'lost',
  'settings',
  'supplies',
]);

function isModal(name: ScreenName): boolean {
  return MODAL_SCREENS.has(name);
}

function inferPrimary(view: AppViewState): ScreenName {
  // view.session 存在意味着关卡正在进行（或刚结束等待结算）—— primary 是 playing。
  // 否则 primary 是 menu。
  // 注：levels 不是 modal，view.screen 直接就是它时 inferPrimary 不会被用到
  // （applyScreens 看 view.screen 不是 modal 时 primary 就是 view.screen 自己）。
  if (view.session) return 'playing';
  return 'menu';
}

export interface PixiRendererOptions {
  canvas: HTMLCanvasElement;
  controller: GameController;
  viewportWidth: number;
  viewportHeight: number;
  /** 可选：事件 target（如 vivo wrapperCanvas）。不传则用 canvas 自身。 */
  eventCanvas?: HTMLCanvasElement;
}

export class PixiRenderer {
  private appHandle: PixiAppHandle | null = null;
  private app: Application | null = null;
  private layers: StageLayers | null = null;
  private screens: Map<ScreenName, PixiScreen> = new Map();
  private currentPrimary: ScreenName | null = null;
  private currentModal: ScreenName | null = null;
  private running = false;
  private ready = false;
  private readonly screenCtx: ScreenContext;

  constructor(private readonly options: PixiRendererOptions) {
    this.screenCtx = {
      dispatch: (action: AppAction) => {
        void this.options.controller.dispatch(action);
      },
      logicalWidth: 750,
      logicalHeight: 1334,
      getRenderer: () => this.app?.renderer ?? null,
    };
  }

  async init(): Promise<void> {
    this.appHandle = await createPixiApp({
      canvas: this.options.canvas,
      width: this.options.viewportWidth,
      height: this.options.viewportHeight,
    });
    this.app = this.appHandle.app;
    this.layers = createStage(this.app, this.options.viewportWidth, this.options.viewportHeight);

    const eventCanvas = this.options.eventCanvas;
    if (eventCanvas && this.app.renderer.events && typeof this.app.renderer.events.setTargetElement === 'function') {
      try {
        this.app.renderer.events.setTargetElement(eventCanvas);
      } catch (e) {
        console.warn('[pixi-renderer] events.setTargetElement failed:', (e as Error).message);
      }
    }

    // 加载 SDF 字体 atlas（绕开 vivo Canvas2D fillText alpha bug，见 docs/vivo-quirks.md）
    // 路径用相对路径 'fonts/main.fnt'，**绝对不能加前导斜杠**：vivo runtime 的 qg.request
    // 会把 '/fonts/...' 当成 https://<current-domain>/fonts/... 网络请求 → 404 → atlas
    // 加载失败 → 回退 PixiJS Text → 撞上 fillText alpha bug → 全屏文字深色。
    // 见 docs/vivo-quirks.md "资源加载 - 前导斜杠"段。
    // 加载失败时 createText 回退 PixiJS Text（浏览器仍能渲染），vivo 上则承担 alpha bug 风险
    try {
      const font = await Assets.load('fonts/main.fnt');
      const chars = (font as { chars?: Record<string, unknown> })?.chars;
      if (chars && typeof chars === 'object') {
        markAtlasReady({ chars });
        const glyphCount = Object.keys(chars).length;
        console.log('[pixi-renderer] BitmapFont atlas loaded: %d glyphs', glyphCount);
      } else {
        console.warn('[pixi-renderer] atlas load returned but chars missing; fallback to PixiJS Text');
      }
    } catch (e) {
      // PixiJS Loader 把底层 reject 的 error.message 包成顶层 'ERROR' 占位，根因在 e.cause 或 stack 里。
      // 这里把所有字段都打出来避免下一次诊断时被 'Error: ERROR' 误导。
      const err = e as { message?: string; stack?: string; cause?: unknown; url?: string };
      console.error('[pixi-renderer] atlas load failed, fallback to PixiJS Text:', {
        message: err?.message,
        stack: err?.stack,
        cause: err?.cause,
        raw: String(e),
        fontUrl: err?.url,
      });
    }

    this.registerScreens();
    this.ready = true;
  }

  start(): void {
    if (this.running || !this.ready) return;
    this.running = true;
    if (!this.app) return;
    this.app.ticker.add(this.frame);
  }

  pause(): void {
    if (!this.app) return;
    this.app.ticker.stop();
  }

  resume(): void {
    if (!this.app) return;
    this.app.ticker.start();
  }

  destroy(): void {
    this.running = false;
    if (this.app) {
      this.app.ticker.remove(this.frame);
    }
    for (const screen of this.screens.values()) {
      screen.dispose();
    }
    this.screens.clear();
    if (this.appHandle) {
      this.appHandle.destroy();
      this.appHandle = null;
      this.app = null;
    }
    this.layers = null;
  }

  resize(viewportWidth: number, viewportHeight: number): void {
    if (!this.app || !this.layers) return;
    this.options.viewportWidth = viewportWidth;
    this.options.viewportHeight = viewportHeight;
    resizeStage(this.app, this.layers, viewportWidth, viewportHeight);
  }

  private registerScreens(): void {
    if (!this.layers) return;
    const uiLayer = this.layers.ui;

    const addScreen = (name: ScreenName, screen: PixiScreen): void => {
      screen.container.visible = false;
      uiLayer.addChild(screen.container);
      this.screens.set(name, screen);
    };

    // 注册顺序决定 z 序：primary 先（playing 在最底，因为 modal 要叠在它上面）。
    // Pixi v8 addChild 顺序就是 z 序，后加的在上。
    addScreen('playing', new PlayingScreen(this.screenCtx));
    addScreen('menu', new MenuScreen(this.screenCtx));
    addScreen('levels', new LevelsScreen(this.screenCtx));
    addScreen('loading', new LoadingScreen(this.screenCtx));
    // 接下来 modal screen 注册在所有 primary 之后，自然处于更高 z 序。
    addScreen('paused', new PausedScreen(this.screenCtx));
    addScreen('won', new WonScreen(this.screenCtx));
    addScreen('lost', new LostScreen(this.screenCtx));
    addScreen('settings', new SettingsScreen(this.screenCtx));
    addScreen('supplies', new SuppliesScreen(this.screenCtx));
  }

  private frame = (): void => {
    if (!this.running || !this.ready) return;
    const view = this.options.controller.getViewState();
    const nowMs = performance.now();

    // 计算应显示的 primary + modal。
    const target = view.screen;
    let nextPrimary: ScreenName;
    let nextModal: ScreenName | null;
    if (isModal(target)) {
      nextPrimary = inferPrimary(view);
      nextModal = target;
    } else {
      nextPrimary = target;
      nextModal = null;
    }

    this.applyPrimary(nextPrimary, view, nowMs);
    this.applyModal(nextModal, view, nowMs);

    // 先 update primary（推进 visualBoard / effects），再 update modal（modal 是静态文案居多）。
    const primary = this.screens.get(this.currentPrimary!);
    primary?.update(view, nowMs);
    if (this.currentModal) {
      this.screens.get(this.currentModal)?.update(view, nowMs);
    }
  };

  private applyPrimary(target: ScreenName, view: AppViewState, nowMs: number): void {
    if (this.currentPrimary === target) return;
    if (this.currentPrimary) {
      this.screens.get(this.currentPrimary)?.hide();
    }
    this.currentPrimary = target;
    this.screens.get(target)?.show(view, nowMs);
  }

  private applyModal(target: ScreenName | null, view: AppViewState, nowMs: number): void {
    if (this.currentModal === target) return;
    if (this.currentModal) {
      this.screens.get(this.currentModal)?.hide();
    }
    this.currentModal = target;
    if (target) {
      this.screens.get(target)?.show(view, nowMs);
    }
  }
}
