import { afterEach, describe, expect, test, vi } from 'vitest';
import { createDouyinPlatformAdapter } from '../platform/douyin';
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

  test('douyin adapter maps short and long haptics to tt vibration APIs', () => {
    const calls: string[] = [];
    vi.stubGlobal('tt', {
      vibrateShort() {
        calls.push('short');
      },
      vibrateLong() {
        calls.push('long');
      },
    });

    const adapter = createDouyinPlatformAdapter('');
    adapter.triggerHaptic('short');
    adapter.triggerHaptic('long');

    expect(calls).toEqual(['short', 'long']);
  });

  test('mini-pack adapter forwards haptics when runtime bridge exists', () => {
    const calls: string[] = [];
    const adapter = createMiniPackPlatformAdapter(miniPackRuntime({
      haptics: {
        trigger(kind) {
          calls.push(kind);
        },
      },
    }));

    adapter.triggerHaptic('short');
    adapter.triggerHaptic('long');

    expect(calls).toEqual(['short', 'long']);
  });

  test('adapters ignore missing haptic support without throwing', () => {
    vi.stubGlobal('tt', {});

    expect(() => createWebPlatformAdapter().triggerHaptic('short')).not.toThrow();
    expect(() => createDouyinPlatformAdapter('').triggerHaptic('long')).not.toThrow();
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
