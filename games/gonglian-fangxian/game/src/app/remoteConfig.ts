import type { RewardedAdRequest } from './controller';
import type { PlatformAdapter } from '../platform/types';

export interface RemoteGameConfig {
  adPolicy: RemoteAdPolicy;
}

export interface RemoteAdPolicy {
  enabled: boolean;
  trigger: 'level_start';
  minLevel: number;
  cooldownSeconds: number;
  maxPerSession: number;
  request: RewardedAdRequest;
}

export const DEFAULT_REMOTE_CONFIG: RemoteGameConfig = {
  adPolicy: {
    enabled: false,
    trigger: 'level_start',
    minLevel: 1,
    cooldownSeconds: 0,
    maxPerSession: 0,
    request: { type: 'extraMovesAd' },
  },
};

export async function loginAndLoadRemoteConfig(
  platform: PlatformAdapter,
  options: { serverBaseUrl: string; gameId: string; channel: string },
): Promise<RemoteGameConfig> {
  if (!options.serverBaseUrl.trim()) {
    return DEFAULT_REMOTE_CONFIG;
  }

  try {
    const login = await platform.login();
    const response = await platform.request({
      url: `${options.serverBaseUrl.replace(/\/+$/, '')}/game/session`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: {
        gameId: options.gameId,
        channel: options.channel,
        platform: login.platform,
        code: login.code,
      },
    });
    return parseRemoteGameConfig(response.data);
  } catch (error) {
    console.warn('[remote-config] failed to load remote config', error);
    return DEFAULT_REMOTE_CONFIG;
  }
}

export function parseRemoteGameConfig(input: unknown): RemoteGameConfig {
  const record = asRecord(input);
  const configRecord = asRecord(record?.config) ?? record;
  const adPolicy = parseAdPolicy(configRecord?.adPolicy);
  return {
    adPolicy: adPolicy ?? DEFAULT_REMOTE_CONFIG.adPolicy,
  };
}

function parseAdPolicy(input: unknown): RemoteAdPolicy | null {
  const record = asRecord(input);
  if (!record) return null;
  const trigger = record.trigger === 'level_start' ? 'level_start' : null;
  if (!trigger) return null;

  return {
    enabled: record.enabled === true,
    trigger,
    minLevel: readInt(record.minLevel, 1),
    cooldownSeconds: readInt(record.cooldownSeconds, 0),
    maxPerSession: readInt(record.maxPerSession, 1),
    request: parseAdRequest(record.request) ?? DEFAULT_REMOTE_CONFIG.adPolicy.request,
  };
}

function parseAdRequest(input: unknown): RewardedAdRequest | null {
  const record = asRecord(input);
  if (!record) return null;
  if (record.type === 'extraMovesAd') return { type: 'extraMovesAd' };
  if (record.type === 'doubleWinReward') return { type: 'doubleWinReward' };
  if (
    record.type === 'powerUpItem' &&
    (record.item === 'bomb' || record.item === 'suck' || record.item === 'shuffle')
  ) {
    return { type: 'powerUpItem', item: record.item };
  }
  return null;
}

function readInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}
