import type { AssetManifest, LevelCellConfig, LevelConfig } from './types';

export const DEFAULT_ASSET_BASE = '/';

export function resolveAssetUrl(baseUrl: string, relativePath: string): string {
  if (/^(https?:)?\/\//.test(relativePath) || relativePath.startsWith('data:')) {
    return relativePath;
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${relativePath.replace(/^\/+/, '')}`;
}

export function parseAssetManifest(value: unknown): AssetManifest {
  if (!isRecord(value)) {
    throw new Error('Asset manifest must be an object.');
  }
  const designSize = value.designSize;
  const levels = value.levels;
  if (!isRecord(designSize) || typeof designSize.width !== 'number' || typeof designSize.height !== 'number') {
    throw new Error('Asset manifest is missing designSize.');
  }
  if (typeof value.levelConfigIndex !== 'string') {
    throw new Error('Asset manifest is missing levelConfigIndex.');
  }
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new Error('Asset manifest must include levels.');
  }

  return value as unknown as AssetManifest;
}

export function parseLevelConfig(value: unknown): LevelConfig {
  if (!isRecord(value)) {
    throw new Error('Level config must be an object.');
  }
  if (typeof value.id !== 'string' || typeof value.levelNo !== 'number' || typeof value.title !== 'string') {
    throw new Error('Level config is missing identity fields.');
  }
  if (!isRecord(value.board) || typeof value.board.width !== 'number' || typeof value.board.height !== 'number') {
    throw new Error(`Level ${value.id} is missing board dimensions.`);
  }
  if (!Array.isArray(value.cells)) {
    throw new Error(`Level ${value.id} is missing cells.`);
  }
  for (const cell of value.cells) {
    assertLevelCell(value.id, cell);
  }

  return value as unknown as LevelConfig;
}

export async function loadAssetManifest(baseUrl = DEFAULT_ASSET_BASE): Promise<AssetManifest> {
  return parseAssetManifest(await loadJson(resolveAssetUrl(baseUrl, 'asset-manifest.json')));
}

export async function loadLevels(manifest: AssetManifest, baseUrl = DEFAULT_ASSET_BASE): Promise<LevelConfig[]> {
  const levels = await Promise.all(
    manifest.levels.map(async (level) => parseLevelConfig(await loadJson(resolveAssetUrl(baseUrl, level.config)))),
  );
  return levels.sort((a, b) => a.levelNo - b.levelNo);
}

async function loadJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

function assertLevelCell(levelId: unknown, value: unknown): asserts value is LevelCellConfig {
  if (!isRecord(value) || typeof value.index !== 'number' || ![0, 1, 2, 3].includes(Number(value.direction))) {
    throw new Error(`Level ${String(levelId)} has an invalid cell.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
