import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMiniPackPlatformAdapter, type MiniPackGameRuntime } from '../platform/minipack';
import { createWebPlatformAdapter } from '../platform/web';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('platform haptics', () => {
  test('web adapter maps short and long haptics to navigator vibration durations', () => {
    const patterns: Array<number | number[]> = [];
    vi.stubGlobal('navigator', {
      vibrate(pattern: number | number[]) {
        patterns.push(pattern);
        return true;
      },
    });

    const adapter = createWebPlatformAdapter();
    adapter.triggerHaptic('short');
    adapter.triggerHaptic('long');

    expect(patterns).toEqual([24, 70]);
  });


  test('mini-pack adapter forwards haptics when runtime bridge exists', () => {
    const calls: string[] = [];
    const logs: Array<{ message: string; data?: unknown }> = [];
    const adapter = createMiniPackPlatformAdapter(miniPackRuntime({
      haptics: {
        trigger(kind) {
          calls.push(kind);
        },
      },
      logger: {
        info(message, data) {
          logs.push({ message, data });
        },
        warn() {},
        error() {},
      },
    }));

    adapter.triggerHaptic('short');
    adapter.triggerHaptic('long');

    expect(calls).toEqual(['short', 'long']);
    expect(logs).toEqual([
      { message: '[GLFX] haptic_bridge_request', data: { kind: 'short', supported: true } },
      { message: '[GLFX] haptic_bridge_forwarded', data: { kind: 'short' } },
      { message: '[GLFX] haptic_bridge_request', data: { kind: 'long', supported: true } },
      { message: '[GLFX] haptic_bridge_forwarded', data: { kind: 'long' } },
    ]);
  });

  test('mini-pack adapter logs when runtime haptic bridge is missing', () => {
    const logs: Array<{ message: string; data?: unknown }> = [];
    const adapter = createMiniPackPlatformAdapter(miniPackRuntime({
      logger: {
        info(message, data) {
          logs.push({ message, data });
        },
        warn() {},
        error() {},
      },
    }));

    adapter.triggerHaptic('short');

    expect(logs).toEqual([
      { message: '[GLFX] haptic_bridge_request', data: { kind: 'short', supported: false } },
      { message: '[GLFX] haptic_bridge_missing', data: { kind: 'short' } },
    ]);
  });

  test('adapters ignore missing haptic support without throwing', () => {
    expect(() => createWebPlatformAdapter().triggerHaptic('short')).not.toThrow();
    expect(() => createMiniPackPlatformAdapter(miniPackRuntime()).triggerHaptic('short')).not.toThrow();
  });
});

function miniPackRuntime(overrides: Partial<MiniPackGameRuntime> = {}): MiniPackGameRuntime {
  return {
    canvas: { width: 750, height: 1334 } as HTMLCanvasElement,
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
