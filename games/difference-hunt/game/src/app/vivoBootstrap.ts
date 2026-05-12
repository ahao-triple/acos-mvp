import type { MiniPackGameRuntime } from '../platform/minipack';
import { VivoSessionError, loginVivoSession, type VivoSessionInfo } from './vivoSession';

export const VIVO_OPEN_ID_KEY = 'vivo:openId';
export const VIVO_CLIENT_CONFIG_KEY = 'vivo:clientConfig';

export async function bootstrapVivoSession(
  runtime: MiniPackGameRuntime,
): Promise<VivoSessionInfo | null> {
  if (runtime.config?.platform !== 'vivo') {
    return null;
  }
  const pkgName = runtime.config?.pkgName;
  const baseUrl = runtime.config?.serverBaseUrl;
  if (!pkgName || !baseUrl) {
    runtime.logger.warn('vivo session skipped: missing pkgName or serverBaseUrl.', {
      pkgName,
      baseUrl,
    });
    return null;
  }

  try {
    const info = await loginVivoSession({
      login: () => runtime.auth.login(),
      request: (options) => runtime.net.request(options),
      baseUrl,
      pkgName,
    });
    runtime.storage.setString(VIVO_OPEN_ID_KEY, info.openId);
    if (info.clientConfig) {
      runtime.storage.setString(VIVO_CLIENT_CONFIG_KEY, JSON.stringify(info.clientConfig));
    } else {
      runtime.storage.remove(VIVO_CLIENT_CONFIG_KEY);
    }
    runtime.logger.info('vivo session ready.', {
      openId: info.openId,
      pkgName: info.game.pkgName,
      hasClientConfig: !!info.clientConfig,
    });
    return info;
  } catch (error) {
    runtime.logger.warn('vivo session failed.', describeError(error));
    return null;
  }
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof VivoSessionError) {
    return {
      kind: 'VivoSessionError',
      statusCode: error.statusCode,
      message: error.message,
      serverMessage: error.serverMessage,
    };
  }
  if (error instanceof Error) {
    return { kind: error.name, message: error.message };
  }
  return { kind: 'unknown', value: String(error) };
}
