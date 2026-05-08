import { build as esbuild } from 'esbuild';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { gameConfigSchema, type GameConfig } from './schema.js';
import { assertSafeOutDir, resolveProjectPath } from './paths.js';
import { UserError } from '../shared/errors.js';
import type { LoadedGameConfig, PlatformName } from '../shared/types.js';

export interface LoadGameConfigOptions {
  projectRoot?: string;
  platform?: PlatformName;
  configFile?: string;
  overrides?: Partial<GameConfig>;
}

export async function loadGameConfig(options: LoadGameConfigOptions = {}): Promise<LoadedGameConfig> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const configFileAbs = path.resolve(projectRoot, options.configFile ?? 'game.config.ts');

  await assertPathExists(configFileAbs, 'Config file not found', 'Create game.config.ts in the project root.');

  const rawConfig = await withProjectEnv(projectRoot, () => importConfig(configFileAbs));
  const candidate = mergeConfig(rawConfig, options.overrides);
  const parsed = gameConfigSchema.safeParse(candidate);

  if (!parsed.success) {
    throw new UserError('Invalid game.config.ts.', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  }

  const config = parsed.data;
  if (options.platform && config.platform !== options.platform) {
    throw new UserError(
      `Configured platform "${config.platform}" does not match requested platform "${options.platform}".`,
      'Update game.config.ts or pass the matching --platform value.',
    );
  }

  const entryAbs = resolveProjectPath(projectRoot, config.entry, 'entry');
  const publicDirAbs = resolveProjectPath(projectRoot, config.publicDir, 'publicDir');
  const outDirAbs = resolveProjectPath(projectRoot, config.outDir, 'outDir');
  const douyinMaterialsAbs = path.join(projectRoot, 'platform/douyin/materials');

  assertSafeOutDir(projectRoot, config.outDir, outDirAbs);
  await assertPathExists(entryAbs, `Entry file not found: ${config.entry}`, 'Create this file or update "entry" in game.config.ts.');
  await assertDirectoryExists(
    publicDirAbs,
    `Public directory not found: ${config.publicDir}`,
    'Create this directory or update "publicDir" in game.config.ts.',
  );
  await assertDirectoryExists(
    douyinMaterialsAbs,
    'Douyin materials directory not found: platform/douyin/materials',
    'Create platform/douyin/materials before validating the Douyin package.',
  );

  return {
    ...config,
    projectRoot,
    paths: {
      configFileAbs,
      entryAbs,
      publicDirAbs,
      outDirAbs,
      douyinMaterialsAbs,
    },
  };
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
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

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

async function importConfig(configFileAbs: string): Promise<unknown> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-config-'));
  const outfile = path.join(tempDir, 'game.config.mjs');

  try {
    await esbuild({
      entryPoints: [configFileAbs],
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
      throw new UserError('game.config.ts must export a default config object.');
    }

    return loaded.default;
  } catch (error) {
    if (error instanceof UserError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Failed to load game.config.ts: ${message}`, 'Fix syntax errors or invalid imports in game.config.ts.');
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true });
  }
}

function mergeConfig(rawConfig: unknown, overrides?: Partial<GameConfig>): unknown {
  if (!overrides || typeof rawConfig !== 'object' || rawConfig === null) {
    return rawConfig;
  }

  const base = rawConfig as GameConfig;
  return {
    ...base,
    ...overrides,
    canvas: overrides.canvas ? { ...base.canvas, ...overrides.canvas } : base.canvas,
    douyin: overrides.douyin ? { ...base.douyin, ...overrides.douyin } : base.douyin,
  };
}

async function assertPathExists(filePath: string, message: string, suggestion: string): Promise<void> {
  try {
    await fs.stat(filePath);
  } catch {
    throw new UserError(message, suggestion);
  }
}

async function assertDirectoryExists(dirPath: string, message: string, suggestion: string): Promise<void> {
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      throw new Error('not a directory');
    }
  } catch {
    throw new UserError(message, suggestion);
  }
}
