import type { PlatformAdapter } from './types';

export function createWebPlatformAdapter(): PlatformAdapter {
  return {
    name: 'web',
    storage: {
      getItem(key) {
        return globalThis.localStorage?.getItem(key) ?? null;
      },
      setItem(key, value) {
        globalThis.localStorage?.setItem(key, value);
      },
      removeItem(key) {
        globalThis.localStorage?.removeItem(key);
      },
    },
    triggerHaptic() {
      // Browsers do not expose a consistent short haptic API.
    },
    async playSfx() {
      // Browser preview keeps audio optional; platform builds provide sound.
    },
    async showRewardedAd() {
      return { status: 'success', message: '预览环境已直接发放奖励。' };
    },
  };
}
