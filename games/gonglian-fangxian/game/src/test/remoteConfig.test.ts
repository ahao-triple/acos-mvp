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
      channel: 'kuaishou',
    });

    expect(request).toHaveBeenCalledWith({
      url: 'https://ks-games.xfyccm.cn/api/game/session',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: {
        gameId: 'gonglian-fangxian',
        channel: 'kuaishou',
        platform: 'kuaishou',
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

  test('sanitizes malformed ad policy data', () => {
    expect(parseRemoteGameConfig({ config: { adPolicy: { enabled: true, trigger: 'bad' } } })).toEqual(DEFAULT_REMOTE_CONFIG);
  });
});

function platformStub(options: {
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
    async login() {
      return { platform: 'kuaishou', code: 'platform-code' };
    },
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
