import type { PlatformLoginResult, PlatformRequestOptions, PlatformResponse } from '../platform/types';

export interface VivoSessionDeps {
  login: () => Promise<PlatformLoginResult>;
  request: (options: PlatformRequestOptions) => Promise<PlatformResponse>;
  baseUrl: string;
  pkgName: string;
}

export interface VivoSessionInfo {
  game: { pkgName: string; name?: string };
  openId: string;
  nickName?: string;
  smallAvatar?: string;
  biggerAvatar?: string;
  gender?: number;
  clientConfig?: Record<string, unknown>;
}

export class VivoSessionError extends Error {
  readonly statusCode: number;
  readonly serverMessage?: string;
  readonly raw?: unknown;

  constructor(statusCode: number, message: string, serverMessage?: string, raw?: unknown) {
    super(message);
    this.name = 'VivoSessionError';
    this.statusCode = statusCode;
    this.serverMessage = serverMessage;
    this.raw = raw;
  }
}

export async function loginVivoSession(deps: VivoSessionDeps): Promise<VivoSessionInfo> {
  if (!deps.pkgName) {
    throw new VivoSessionError(0, 'vivo session requires a configured pkgName.');
  }

  const loginResult = await deps.login();
  const token = loginResult?.code;
  if (!token) {
    throw new VivoSessionError(0, 'qg.login did not return a token.');
  }

  const response = await deps.request({
    url: joinUrl(deps.baseUrl, '/vivo/sessions'),
    method: 'POST',
    data: { pkgName: deps.pkgName, token },
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status < 200 || response.status >= 300) {
    const serverMessage = readServerMessage(response.data);
    throw new VivoSessionError(
      response.status,
      `vivo /sessions failed with status ${response.status}.`,
      serverMessage,
      response.data,
    );
  }

  const info = parseSessionInfo(response.data);
  if (!info.openId) {
    throw new VivoSessionError(
      response.status,
      'vivo /sessions returned no openId.',
      undefined,
      response.data,
    );
  }
  return info;
}

function joinUrl(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
}

function readServerMessage(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'message' in data) {
    const value = (data as { message?: unknown }).message;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

function parseSessionInfo(data: unknown): VivoSessionInfo {
  const record = (data ?? {}) as Record<string, unknown>;
  const gameRecord = (record.game ?? {}) as Record<string, unknown>;
  return {
    game: {
      pkgName: typeof gameRecord.pkgName === 'string' ? gameRecord.pkgName : '',
      name: typeof gameRecord.name === 'string' ? gameRecord.name : undefined,
    },
    openId: typeof record.openId === 'string' ? record.openId : '',
    nickName: typeof record.nickName === 'string' ? record.nickName : undefined,
    smallAvatar: typeof record.smallAvatar === 'string' ? record.smallAvatar : undefined,
    biggerAvatar: typeof record.biggerAvatar === 'string' ? record.biggerAvatar : undefined,
    gender: typeof record.gender === 'number' ? record.gender : undefined,
    clientConfig:
      record.clientConfig && typeof record.clientConfig === 'object'
        ? (record.clientConfig as Record<string, unknown>)
        : undefined,
  };
}
