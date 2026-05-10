import { build as esbuild } from 'esbuild';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  douyinMaterialsSchema,
  gameConfigSchema,
  vivoMaterialsSchema,
  type DouyinMaterials,
  type GameConfig,
  type VivoMaterials,
} from './schema.js';
import { resolveProjectPath } from './paths.js';
import { UserError } from '../shared/errors.js';
import type {
  ChannelMaterials,
  LoadedGameConfig,
  PlatformName,
} from '../shared/types.js';

export interface LoadGameConfigOptions {
  projectRoot?: string;
  platform: PlatformName;
  configFile?: string;
}

export async function loadGameConfig(options: LoadGameConfigOptions): Promise<LoadedGameConfig> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const configFileAbs = path.resolve(projectRoot, options.configFile ?? 'game.config.ts');
  const platform = options.platform;

  await assertPathExists(
    configFileAbs,
    'Config file not found',
    'Create game.config.ts in the project root.',
  );

  const rawGame = await withProjectEnv(projectRoot, () => importDefault(configFileAbs));
  const parsedGame = gameConfigSchema.safeParse(rawGame);

  if (!parsedGame.success) {
    throw new UserError(
      'Invalid game.config.ts.',
      parsedGame.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'),
    );
  }

  const game: GameConfig = parsedGame.data;
  const channelRoot = path.join(projectRoot, 'channels', platform);
  const materialsAbs = path.join(channelRoot, 'materials.ts');

  await assertPathExists(
    materialsAbs,
    `Channel materials not found: channels/${platform}/materials.ts`,
    `Create channels/${platform}/materials.ts before building or running preflight.`,
  );

  const rawMaterials = await withProjectEnv(projectRoot, () => importDefault(materialsAbs));
  const materials: ChannelMaterials =
    platform === 'douyin'
      ? parseMaterials(douyinMaterialsSchema, rawMaterials, 'douyin')
      : parseMaterials(vivoMaterialsSchema, rawMaterials, 'vivo');

  const entryAbs = resolveProjectPath(projectRoot, game.entry, 'entry');
  const publicDirAbs = resolveProjectPath(projectRoot, game.publicDir, 'publicDir');
  const iconAbs = path.resolve(channelRoot, materials.iconPath);
  const outDirAbs = path.join(channelRoot, 'build');

  return {
    game,
    platform,
    materials,
    projectRoot,
    paths: {
      configFileAbs,
      entryAbs,
      publicDirAbs,
      channelRoot,
      materialsAbs,
      iconAbs,
      outDirAbs,
    },
    douyinMaterials: platform === 'douyin' ? (materials as DouyinMaterials) : undefined,
    vivoMaterials: platform === 'vivo' ? (materials as VivoMaterials) : undefined,
  };
}

interface SafeParseResult<T> {
  success: boolean;
  data?: T;
  error?: { issues: Array<{ path: Array<string | number>; message: string }> };
}

interface SafeParser<T> {
  safeParse: (input: unknown) => SafeParseResult<T>;
}

function parseMaterials<T>(schema: SafeParser<T>, raw: unknown, platform: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success || !parsed.data) {
    const detail = parsed.error?.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n') ?? 'unknown';
    throw new UserError(`Invalid channels/${platform}/materials.ts.`, detail);
  }
  return parsed.data;
}

async function withProjectEnv<T>(projectRoot: string, load: () => Promise<T>): Promise<T> {
  const env = await loadProjectEnv(projectRoot);
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  try {
    return await load();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function loadProjectEnv(projectRoot: string): Promise<Record<string, string>> {
  const envFile = path.join(projectRoot, '.env');
  try {
    return parseDotEnv(await fs.readFile(envFile, 'utf8'));
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

function parseDotEnv(content: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    values[key] = parseEnvValue(normalized.slice(equalsIndex + 1).trim());
  }

  return values;
}

function parseEnvValue(value: string): string {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }
  const commentIndex = value.indexOf(' #');
  return (commentIndex >= 0 ? value.slice(0, commentIndex) : value).trim();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

async function importDefault(fileAbs: string): Promise<unknown> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-config-'));
  const outfile = path.join(tempDir, 'module.mjs');

  try {
    await esbuild({
      entryPoints: [fileAbs],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      logLevel: 'silent',
    });

    const moduleUrl = `${pathToFileURL(outfile).href}?t=${Date.now()}`;
    const loaded = (await import(moduleUrl)) as { default?: unknown };
    if (!loaded.default || typeof loaded.default !== 'object') {
      throw new UserError(`${path.basename(fileAbs)} must export a default object.`);
    }
    return loaded.default;
  } catch (error) {
    if (error instanceof UserError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(
      `Failed to load ${path.basename(fileAbs)}: ${message}`,
      'Fix syntax errors or invalid imports.',
    );
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

async function assertPathExists(filePath: string, message: string, suggestion: string): Promise<void> {
  try {
    await fs.stat(filePath);
  } catch {
    throw new UserError(message, suggestion);
  }
}
