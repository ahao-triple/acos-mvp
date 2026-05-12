import { describe, expect, test, vi } from 'vitest';

import { VivoSessionError, loginVivoSession, type VivoSessionDeps } from '../app/vivoSession';

function makeDeps(overrides: Partial<VivoSessionDeps> = {}): VivoSessionDeps {
  const login = vi.fn(async () => ({ platform: 'vivo', code: 'tok-xyz' }));
  const request = vi.fn(async () => ({
    status: 200,
    data: {
      game: { pkgName: 'com.example.app', name: 'Demo' },
      openId: 'oid-1',
      nickName: 'tester',
      smallAvatar: 'https://small',
      biggerAvatar: 'https://big',
      gender: 1,
      clientConfig: { startScene: 'intro' },
    },
  }));
  return {
    login,
    request,
    baseUrl: 'https://api.example.com/api',
    pkgName: 'com.example.app',
    ...overrides,
  };
}

describe('loginVivoSession', () => {
  test('posts pkgName + token from qg.login to /vivo/sessions and returns parsed info', async () => {
    const deps = makeDeps();
    const info = await loginVivoSession(deps);

    expect(deps.login).toHaveBeenCalledTimes(1);
    expect(deps.request).toHaveBeenCalledTimes(1);
    expect(deps.request).toHaveBeenCalledWith({
      url: 'https://api.example.com/api/vivo/sessions',
      method: 'POST',
      data: { pkgName: 'com.example.app', token: 'tok-xyz' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(info.openId).toBe('oid-1');
    expect(info.clientConfig).toEqual({ startScene: 'intro' });
    expect(info.game.pkgName).toBe('com.example.app');
  });

  test('joins baseUrl that already ends with a slash without duplicating it', async () => {
    const deps = makeDeps({ baseUrl: 'https://api.example.com/api/' });
    await loginVivoSession(deps);
    expect(deps.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://api.example.com/api/vivo/sessions' }),
    );
  });

  test('throws when pkgName is empty (must be configured before calling)', async () => {
    const deps = makeDeps({ pkgName: '' });
    await expect(loginVivoSession(deps)).rejects.toBeInstanceOf(VivoSessionError);
    expect(deps.login).not.toHaveBeenCalled();
    expect(deps.request).not.toHaveBeenCalled();
  });

  test('throws when qg.login does not return a token (code)', async () => {
    const deps = makeDeps({
      login: vi.fn(async () => ({ platform: 'vivo', code: '' })),
    });
    await expect(loginVivoSession(deps)).rejects.toBeInstanceOf(VivoSessionError);
    expect(deps.request).not.toHaveBeenCalled();
  });

  test('maps 404 not-configured response to VivoSessionError with serverMessage', async () => {
    const deps = makeDeps({
      request: vi.fn(async () => ({
        status: 404,
        data: {
          statusCode: 404,
          error: 'Not Found',
          message: 'Vivo game com.example.app is not configured',
        },
      })),
    });
    const err = await loginVivoSession(deps).catch((e) => e);
    expect(err).toBeInstanceOf(VivoSessionError);
    expect((err as VivoSessionError).statusCode).toBe(404);
    expect((err as VivoSessionError).serverMessage).toBe(
      'Vivo game com.example.app is not configured',
    );
  });

  test('maps 502 token-expired response to VivoSessionError so callers can show retry UI', async () => {
    const deps = makeDeps({
      request: vi.fn(async () => ({
        status: 502,
        data: { statusCode: 502, error: 'Bad Gateway', message: 'vivo token 已失效：xxx' },
      })),
    });
    const err = await loginVivoSession(deps).catch((e) => e);
    expect(err).toBeInstanceOf(VivoSessionError);
    expect((err as VivoSessionError).statusCode).toBe(502);
    expect((err as VivoSessionError).serverMessage).toContain('vivo token 已失效');
  });

  test('treats a 2xx response without openId as a server error', async () => {
    const deps = makeDeps({
      request: vi.fn(async () => ({ status: 200, data: { openId: '' } })),
    });
    await expect(loginVivoSession(deps)).rejects.toBeInstanceOf(VivoSessionError);
  });

  test('does not auto-retry qg.login after a request failure (vivo guideline)', async () => {
    const login = vi.fn(async () => ({ platform: 'vivo', code: 'tok' }));
    const deps = makeDeps({
      login,
      request: vi.fn(async () => ({ status: 502, data: { message: 'vivo 登录异常：x' } })),
    });
    await loginVivoSession(deps).catch(() => undefined);
    expect(login).toHaveBeenCalledTimes(1);
  });
});
