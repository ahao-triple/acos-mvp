import fs from 'fs-extra';
import path from 'node:path';

import { loadGameConfig } from '../core/config.js';
import { packConfigSchema, type PackConfig } from '../core/schema.js';
import { getPlatformBuilder } from '../platforms/index.js';
import { UserError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import type { LoadedGameConfig } from '../shared/types.js';

export interface PackCommandOptions {
  configFile: string;
}

export async function runPackCommand(options: PackCommandOptions): Promise<void> {
  const configFileAbs = path.resolve(options.configFile);
  const projectRoot = path.dirname(configFileAbs);

  const raw = await readConfigJson(configFileAbs);
  const parsed = packConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.message}`)
      .join('\n');
    throw new UserError(`Invalid build config: ${path.relative(process.cwd(), configFileAbs)}`, detail);
  }
  const config: PackConfig = parsed.data;

  const baseLoaded = await loadGameConfig({ projectRoot, platform: config.platform });
  assertPlatformMatchesChannel(config, baseLoaded);
  const platformMaterials = getPlatformMaterials(baseLoaded);
  if (!platformMaterials?.packageName) {
    throw new UserError(`Missing packageName in channels/${config.platform}/materials.ts.`);
  }
  const packageName = platformMaterials.packageName;

  const outputDirAbs = path.isAbsolute(config.output) ? config.output : path.resolve(projectRoot, config.output);
  const tempOutDir = path.join(projectRoot, '.mini-pack', `${config.platform}-build-${packageName}`);

  await assertFileExists(
    baseLoaded.paths.entryAbs,
    `Game entry file not found: ${path.relative(projectRoot, baseLoaded.paths.entryAbs)}`,
  );
  await assertDirExists(
    baseLoaded.paths.publicDirAbs,
    `publicDir is not a directory: ${path.relative(projectRoot, baseLoaded.paths.publicDirAbs)}`,
  );
  await assertFileExists(
    baseLoaded.paths.iconAbs,
    `${config.platform} icon not found: ${path.relative(projectRoot, baseLoaded.paths.iconAbs)}`,
    `Place the ${config.platform} channel icon at ${path.relative(process.cwd(), baseLoaded.paths.iconAbs)} and run pack again.`,
  );

  const loaded: LoadedGameConfig = {
    ...baseLoaded,
    game: {
      ...baseLoaded.game,
      serverBaseUrl: config.serverBaseUrl ?? baseLoaded.game.serverBaseUrl,
    },
    paths: {
      ...baseLoaded.paths,
      outDirAbs: tempOutDir,
    },
  };

  const builder = getPlatformBuilder(config.platform);
  const report = await builder.build(loaded);

  for (const warning of report.warnings) {
    logger.warn(warning);
  }

  const rpkSource = await findRpkFile(tempOutDir, packageName);
  await fs.ensureDir(outputDirAbs);
  const finalRpk = path.join(outputDirAbs, `${packageName}.rpk`);
  await fs.copyFile(rpkSource, finalRpk);

  const printable = path.relative(process.cwd(), finalRpk) || finalRpk;
  logger.success(
    `Built ${config.platform} .rpk (v${platformMaterials.versionName} / code ${platformMaterials.versionCode}) -> ${printable}`,
  );
}

function getPlatformMaterials(loaded: LoadedGameConfig) {
  if (loaded.platform === 'vivo') return loaded.vivoMaterials;
  if (loaded.platform === 'oppo') return loaded.oppoMaterials;
  return undefined;
}

async function readConfigJson(file: string): Promise<unknown> {
  let text: string;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new UserError(`Build config not found: ${file}`);
    }
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(`Build config is not valid JSON: ${file}`, message);
  }
}

function assertPlatformMatchesChannel(config: PackConfig, loaded: LoadedGameConfig): void {
  const channelName = path.basename(loaded.paths.channelRoot);
  if (channelName !== config.platform) {
    throw new UserError(
      `Build config platform "${config.platform}" does not match channel directory "${channelName}".`,
      `Use channels/${config.platform}/materials.ts for this build config.`,
    );
  }
}

async function assertFileExists(file: string, message: string, suggestion?: string): Promise<void> {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) throw new Error('not a file');
  } catch {
    throw new UserError(message, suggestion);
  }
}

async function assertDirExists(dir: string, message: string): Promise<void> {
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) throw new Error('not a directory');
  } catch {
    throw new UserError(message);
  }
}

async function findRpkFile(dir: string, packageName: string): Promise<string> {
  const preferred = await walk(dir, (entry) => entry.endsWith(`${packageName}.rpk`));
  if (preferred.length > 0) return preferred[0];
  const any = await walk(dir, (entry) => entry.endsWith('.rpk'));
  if (any.length > 0) return any[0];
  throw new UserError(`No .rpk file was produced under ${dir}.`);
}

async function walk(dir: string, predicate: (name: string) => boolean): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full, predicate);
      return entry.isFile() && predicate(entry.name) ? [full] : [];
    }),
  );
  return results.flat().sort();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
