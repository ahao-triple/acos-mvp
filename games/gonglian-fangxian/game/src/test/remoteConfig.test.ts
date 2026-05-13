import { describe, expect, test, vi } from 'vitest';

import { DEFAULT_REMOTE_CONFIG, loginAndLoadRemoteConfig, parseRemoteGameConfig } from '../app/remoteConfig';
import type { PlatformAdapter } from '../platform/types';

describe('remote game config', () => {
  test('logs in with the platform code and loads server config', async () => {
    const request = vi.fn(async () => ({
      status: 200,
      data: {
        config: {
          adPolicy: {
            enabled: true,
            trigger: 'level_start',
            minLevel: 3,
            cooldownSeconds: 60,
            maxPerSession: 2,
            request: { type: 'extraMovesAd' },
          },
        },
      },
    }));
    const platform = platformStub({ request });

    const config = await loginAndLoadRemoteConfig(platform, {
      serverBaseUrl: 'https://ks-games.xfyccm.cn/api',
      gameId: 'gonglian-fangxian',
      channel: 'vivo',
    });

    expect(request).toHaveBeenCalledWith({
      url: 'https://ks-games.xfyccm.cn/api/game/session',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: {
        gameId: 'gonglian-fangxian',
        channel: 'vivo',
        platform: 'vivo',
        code: 'platform-code',
      },
    });
    expect(config.adPolicy).toMatchObject({
      enabled: true,
      trigger: 'level_start',
      minLevel: 3,
      cooldownSeconds: 60,
      maxPerSession: 2,
      request: { type: 'extraMovesAd' },
    });
  });

  test('returns default config when server url is empty', async () => {
    const request = vi.fn();
    const config = await loginAndLoadRemoteConfig(platformStub({ request }), {
      serverBaseUrl: '',
      gameId: 'gonglian-fangxian',
      channel: 'web',
    });

    expect(config).toEqual(DEFAULT_REMOTE_CONFIG);
    expect(request).not.toHaveBeenCalled();
  });

  test('returns default config for vivo without platform login or session request', async () => {
    const login = vi.fn(async () => ({ platform: 'vivo', code: 'platform-code' }));
    const request = vi.fn();

    const config = await loginAndLoadRemoteConfig(platformStub({ login, request }), {
      serverBaseUrl: 'https://ks-games.xfyccm.cn/api',
      gameId: 'gonglian-fangxian',
      channel: 'vivo',
    });

    expect(config).toEqual(DEFAULT_REMOTE_CONFIG);
    expect(login).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  test('sanitizes malformed ad policy data', () => {
    expect(parseRemoteGameConfig({ config: { adPolicy: { enabled: true, trigger: 'bad' } } })).toEqual(DEFAULT_REMOTE_CONFIG);
  });
});

function platformStub(options: {
  login?: PlatformAdapter['login'];
  request?: PlatformAdapter['request'];
} = {}): PlatformAdapter {
  return {
    name: 'test',
    storage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    login: options.login ?? (async () => ({ platform: 'vivo', code: 'platform-code' })),
    request: options.request ?? (async () => ({ status: 200, data: {} })),
    async showRewardedAd() {
      return { status: 'unsupported' };
    },
    async addDesktopShortcut() {
      return { status: 'unsupported' };
    },
    async showFavoriteGuide() {
      return { status: 'unsupported' };
    },
    async didEnterFromSidebar() {
      return false;
    },
    async requestSidebarEntry() {
      return { status: 'unsupported' };
    },
    getLaunchContext() {
      return { isSidebarEntry: false };
    },
    triggerHaptic() {},
  };
}
