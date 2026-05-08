import type { PlatformAdapter, PlatformResult } from './types';

export function createWebPlatformAdapter(): PlatformAdapter {
  return {
    name: 'web',
    storage: getWebStorage(),
    async showRewardedAd(): Promise<PlatformResult> {
      return { status: 'unsupported', message: '当前环境暂不支持广告，稍后再试。' };
    },
    async addDesktopShortcut(): Promise<PlatformResult> {
      return { status: 'unsupported', message: '当前环境暂不支持添加到桌面。' };
    },
    async showFavoriteGuide(): Promise<PlatformResult> {
      return { status: 'unsupported', message: '当前环境暂不支持添加到常用。' };
    },
    async didEnterFromSidebar(): Promise<boolean> {
      return false;
    },
    async requestSidebarEntry(): Promise<PlatformResult> {
      return { status: 'unsupported', message: '当前环境暂不支持侧边栏跳转。' };
    },
    getLaunchContext() {
      return { isSidebarEntry: false };
    },
  };
}

function getWebStorage(): Storage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return new MemoryStorage();
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
