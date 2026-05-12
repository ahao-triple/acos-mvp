import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ImpactEvent } from '../feedback/impact';
import { createGame } from '../main';
import type { MiniPackGameRuntime } from '../platform/minipack';
import { CanvasRenderer } from '../render/canvasRenderer';

describe('impact runtime wiring', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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

  test('routes renderer impact cues through runtime sound haptics and shake', async () => {
    const impact: ImpactEvent = {
      id: 42,
      level: 6,
      source: 'cascade',
      sound: 'combo',
      haptic: 'long',
      shake: { amplitude: 5, durationMs: 170 },
    };
    const sfx: string[] = [];
    const haptics: string[] = [];
    const appliedImpacts: ImpactEvent[] = [];
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

    vi.spyOn(CanvasRenderer.prototype, 'render').mockImplementation(() => undefined);
    vi.spyOn(CanvasRenderer.prototype, 'consumeImpactCue').mockReturnValueOnce(impact).mockReturnValue(null);
    vi.spyOn(CanvasRenderer.prototype, 'applyImpact').mockImplementation((routedImpact) => {
      appliedImpacts.push(routedImpact);
    });
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);

    const app = createGame(runtime);
    app.start();
    await Promise.resolve();
    app.destroy();

    expect(sfx).toEqual(['combo']);
    expect(haptics).toEqual(['long']);
    expect(appliedImpacts).toEqual([impact]);
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
    auth: {
      async login() {
        return { platform: 'test', code: 'test-code' };
      },
    },
    net: {
      async request() {
        return { status: 200, data: null };
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
