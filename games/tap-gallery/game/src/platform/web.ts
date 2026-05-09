import type { HapticKind, PlatformAdapter, PlatformResult } from './types';
import { zhText } from '../i18n/zh';

export function createWebPlatformAdapter(): PlatformAdapter {
  return {
    name: 'web',
    storage: getWebStorage(),
    async showRewardedAd(): Promise<PlatformResult> {
      return { status: 'unsupported', message: zhText.messages.rewardedAdsUnavailable };
    },
    triggerHaptic(kind) {
      triggerWebHaptic(kind);
    },
  };
}

function getWebStorage(): Storage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return new MemoryStorage();
}

function triggerWebHaptic(kind: HapticKind): void {
  const nav = typeof navigator === 'undefined'
    ? null
    : navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  try {
    nav?.vibrate?.(kind === 'short' ? 18 : 60);
  } catch {
    return;
  }
}

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}
