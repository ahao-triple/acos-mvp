import type { PlatformAdapter, PlatformResult } from './types';

interface DouyinRewardedVideoAd {
  show(): Promise<void>;
  onClose(listener: (result: { isEnded?: boolean }) => void): void;
  onError(listener: (error: { errMsg?: string }) => void): void;
}

interface DouyinApi {
  createRewardedVideoAd?: (options: { adUnitId: string }) => DouyinRewardedVideoAd;
  canIUse?: (schema: string) => boolean;
  addShortcut?: DouyinShortcutApi;
  checkShortcut?: DouyinShortcutApi;
  showFavoriteGuide?: (options: DouyinFavoriteGuideOptions) => void;
  navigateToScene?: (options: { scene: 'sidebar'; success?: () => void; fail?: (error: { errMsg?: string }) => void }) => void;
  getEnterOptionsSync?: () => DouyinLaunchOptions;
  getLaunchOptionsSync?: () => DouyinLaunchOptions;
  onShow?: (listener: (options: DouyinLaunchOptions) => void) => void;
  getStorageSync?: (key: string) => string;
  setStorageSync?: (key: string, value: string) => void;
  removeStorageSync?: (key: string) => void;
}

interface DouyinCallbackResult {
  errMsg?: string;
  exist?: boolean;
  status?: {
    exist?: boolean;
  };
}

interface DouyinCallbackOptions {
  success?: (result: DouyinCallbackResult) => void;
  fail?: (error: { errMsg?: string }) => void;
}

type DouyinShortcutApi = (options: DouyinCallbackOptions | ((result?: DouyinCallbackResult | boolean) => void)) => void;

interface DouyinFavoriteGuideOptions extends DouyinCallbackOptions {
  type?: 'bar' | 'tip';
  content?: string;
  position?: 'bottom' | 'overtab';
}

interface DouyinLaunchOptions {
  scene?: string;
  launch_from?: string;
  location?: string;
  query?: Record<string, string>;
}

export function createDouyinPlatformAdapter(adUnitId: string): PlatformAdapter {
  const tt = readDouyinApi();
  let sidebarEntry = isSidebarEntry(tt?.getEnterOptionsSync?.()) || isSidebarEntry(tt?.getLaunchOptionsSync?.());
  tt?.onShow?.((options) => {
    if (isSidebarEntry(options)) {
      sidebarEntry = true;
    }
  });

  return {
    name: 'douyin',
    storage: {
      getItem(key: string) {
        return tt?.getStorageSync?.(key) ?? null;
      },
      setItem(key: string, value: string) {
        tt?.setStorageSync?.(key, value);
      },
      removeItem(key: string) {
        tt?.removeStorageSync?.(key);
      },
    },
    async showRewardedAd(): Promise<PlatformResult> {
      if (!tt?.createRewardedVideoAd) {
        return { status: 'unsupported' };
      }

      return new Promise((resolve) => {
        const ad = tt.createRewardedVideoAd?.({ adUnitId });
        if (!ad) {
          resolve({ status: 'unsupported' });
          return;
        }

        let resolved = false;
        const finish = (result: PlatformResult) => {
          if (!resolved) {
            resolved = true;
            resolve(result);
          }
        };

        ad.onClose((result) => {
          finish(result.isEnded ? { status: 'success' } : { status: 'cancelled' });
        });
        ad.onError((error) => {
          finish({ status: 'failed', message: error.errMsg });
        });
        ad.show().catch((error: unknown) => {
          finish({ status: 'failed', message: error instanceof Error ? error.message : '广告暂时不可用，稍后再试。' });
        });
      });
    },
    async addDesktopShortcut(): Promise<PlatformResult> {
      if (!canUseApi(tt, 'addShortcut') && !canUseApi(tt, 'checkShortcut')) {
        return { status: 'unsupported', message: '当前环境暂不支持添加到桌面。' };
      }

      if ((await checkShortcutExists(tt)) === true) {
        return { status: 'success' };
      }

      if (await addDesktopShortcut(tt)) {
        return { status: 'success' };
      }

      return (await checkShortcutExists(tt)) === true
        ? { status: 'success' }
        : { status: 'failed', message: '添加到桌面未完成，暂未获得奖励。' };
    },
    async showFavoriteGuide(): Promise<PlatformResult> {
      if (!canUseApi(tt, 'showFavoriteGuide')) {
        return { status: 'unsupported', message: '当前环境暂不支持添加到常用。' };
      }

      return (await showFavoriteGuide(tt))
        ? { status: 'success' }
        : { status: 'failed', message: '添加到常用未完成，暂未获得奖励。' };
    },
    async didEnterFromSidebar(): Promise<boolean> {
      sidebarEntry = sidebarEntry || isSidebarEntry(tt?.getEnterOptionsSync?.()) || isSidebarEntry(tt?.getLaunchOptionsSync?.());
      return sidebarEntry;
    },
    async requestSidebarEntry(): Promise<PlatformResult> {
      return requestSidebarEntry(tt?.navigateToScene);
    },
    getLaunchContext() {
      return {
        isSidebarEntry: sidebarEntry,
      };
    },
  };
}

export function canUseDouyinAdapter(): boolean {
  return Boolean(readDouyinApi());
}

function readDouyinApi(): DouyinApi | undefined {
  return (globalThis as typeof globalThis & { tt?: DouyinApi }).tt;
}

function requestSidebarEntry(api: DouyinApi['navigateToScene'] | undefined): Promise<PlatformResult> {
  if (!api) {
    return Promise.resolve({ status: 'unsupported', message: '当前环境暂不支持侧边栏跳转。' });
  }

  return new Promise((resolve) => {
    api({
      scene: 'sidebar',
      success: () => resolve({ status: 'success' }),
      fail: (error) => resolve({ status: 'failed', message: error.errMsg }),
    });
  });
}

function canUseApi(tt: DouyinApi | undefined, name: keyof DouyinApi): boolean {
  if (typeof tt?.[name] !== 'function') {
    return false;
  }

  if (typeof tt.canIUse !== 'function') {
    return true;
  }

  try {
    return tt.canIUse(String(name));
  } catch {
    return true;
  }
}

function checkShortcutExists(tt: DouyinApi | undefined): Promise<boolean | null> {
  if (!tt?.checkShortcut) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    tt.checkShortcut?.((result) => resolve(parseShortcutExists(result)));
  });
}

function parseShortcutExists(result: DouyinCallbackResult | boolean | undefined): boolean {
  if (typeof result === 'boolean') {
    return result;
  }
  return Boolean(result?.exist ?? result?.status?.exist);
}

function addDesktopShortcut(tt: DouyinApi | undefined): Promise<boolean> {
  if (!tt?.addShortcut) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    tt.addShortcut?.((result) => resolve(result !== false));
  });
}

function showFavoriteGuide(tt: DouyinApi | undefined): Promise<boolean> {
  if (!tt?.showFavoriteGuide) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    tt.showFavoriteGuide?.({
      type: 'bar',
      content: '添加到常用',
      position: 'bottom',
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
}

function isSidebarEntry(options: DouyinLaunchOptions | undefined): boolean {
  const query = options?.query ?? {};
  return (
    options?.scene === '021036' ||
    options?.scene === 'sidebar' ||
    (options?.launch_from === 'homepage' && options?.location === 'sidebar_card') ||
    (query.launch_from === 'homepage' && query.location === 'sidebar_card') ||
    query.from === 'sidebar'
  );
}
