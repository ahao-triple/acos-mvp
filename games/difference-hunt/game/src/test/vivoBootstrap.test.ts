import { describe, expect, test, vi } from 'vitest';

import {
  VIVO_CLIENT_CONFIG_KEY,
  VIVO_OPEN_ID_KEY,
  bootstrapVivoSession,
} from '../app/vivoBootstrap';
import type { MiniPackGameRuntime } from '../platform/minipack';

function makeRuntime(overrides: Partial<MiniPackGameRuntime> = {}): MiniPackGameRuntime {
  const memory = new Map<string, string>();
  const runtime: MiniPackGameRuntime = {
    canvas: {} as HTMLCanvasElement,
    config: {
      platform: 'vivo',
      serverBaseUrl: 'https://api.example.com/api',
      pkgName: 'com.example.app',
    },
    storage: {
      getString: (key) => memory.get(key) ?? null,
      setString: vi.fn((key: string, value: string) => {
        memory.set(key, value);
      }),
      remove: vi.fn((key: string) => {
        memory.delete(key);
      }),
    },
    audio: {
      playSfx: vi.fn(async () => undefined),
      playMusic: vi.fn(async () => undefined),
      stopMusic: vi.fn(),
      setMuted: vi.fn(),
    },
    auth: {
      login: vi.fn(async () => ({ platform: 'vivo', code: 'tok-vivo' })),
    },
    net: {
      request: vi.fn(async () => ({
        status: 200,
        data: {
          game: { pkgName: 'com.example.app', name: 'Demo' },
          openId: 'oid-1',
          clientConfig: { startScene: 'intro' },
        },
      })),
    },
    ads: {
      isRewardedVideoReady: () => false,
      showRewardedVideo: async () => ({ completed: false }),
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
  return runtime;
}

describe('bootstrapVivoSession', () => {
  test('returns null and does nothing when runtime is not vivo', async () => {
    const runtime = makeRuntime({ config: { platform: 'douyin', serverBaseUrl: 'x' } });
    const result = await bootstrapVivoSession(runtime);
    expect(result).toBeNull();
    expect(runtime.auth.login).not.toHaveBeenCalled();
    expect(runtime.net.request).not.toHaveBeenCalled();
  });

  test('persists openId and clientConfig on success and logs info', async () => {
    const runtime = makeRuntime();
    const result = await bootstrapVivoSession(runtime);
    expect(result?.openId).toBe('oid-1');
    expect(runtime.storage.setString).toHaveBeenCalledWith(VIVO_OPEN_ID_KEY, 'oid-1');
    expect(runtime.storage.setString).toHaveBeenCalledWith(
      VIVO_CLIENT_CONFIG_KEY,
      JSON.stringify({ startScene: 'intro' }),
    );
    expect(runtime.logger.info).toHaveBeenCalled();
  });

  test('clears stale clientConfig when response has none', async () => {
    const runtime = makeRuntime({
      net: {
        request: vi.fn(async () => ({
          status: 200,
          data: { game: { pkgName: 'com.example.app' }, openId: 'oid-2' },
        })),
      },
    });
    await bootstrapVivoSession(runtime);
    expect(runtime.storage.remove).toHaveBeenCalledWith(VIVO_CLIENT_CONFIG_KEY);
  });

  test('warns and skips login when pkgName is missing', async () => {
    const runtime = makeRuntime({
      config: { platform: 'vivo', serverBaseUrl: 'https://api/api' },
    });
    const result = await bootstrapVivoSession(runtime);
    expect(result).toBeNull();
    expect(runtime.auth.login).not.toHaveBeenCalled();
    expect(runtime.logger.warn).toHaveBeenCalled();
  });

  test('does not throw or auto-retry when server returns 502', async () => {
    const runtime = makeRuntime({
      net: {
        request: vi.fn(async () => ({
          status: 502,
          data: { statusCode: 502, message: 'vivo token 已失效：x' },
        })),
      },
    });
    const result = await bootstrapVivoSession(runtime);
    expect(result).toBeNull();
    expect(runtime.auth.login).toHaveBeenCalledTimes(1);
    expect(runtime.logger.warn).toHaveBeenCalled();
    expect(runtime.storage.setString).not.toHaveBeenCalled();
  });
});
