import fs from 'fs-extra';
import path from 'node:path';

import { loadGameConfigFile } from '../core/config.js';
import { packConfigSchema, type PackConfig } from '../core/schema.js';
import { getPlatformBuilder } from '../platforms/index.js';
import { UserError } from '../shared/errors.js';
import { logger } from '../shared/logger.js';
import type { LoadedGameConfig } from '../shared/types.js';

export interface PackCommandOptions {
  configFile: string;
}

interface VivoVersionState {
  lastVersionCode: number;
}

const VERSION_STATE_DIR = '.mini-pack';
const VERSION_STATE_FILE = 'vivo-version.json';

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

  const game = await loadGameConfigFile(projectRoot);

  const entryAbs = resolveInside(projectRoot, game.entry, 'game.config.ts entry');
  const publicDirAbs = resolveInside(projectRoot, game.publicDir, 'game.config.ts publicDir');
  const iconAbs = resolveInside(projectRoot, config.vivo.iconPath, 'vivo.iconPath');
  const outputDirAbs = path.isAbsolute(config.output) ? config.output : path.resolve(projectRoot, config.output);
  const tempOutDir = path.join(projectRoot, '.mini-pack', `vivo-build-${config.vivo.packageName}`);

  await assertFileExists(entryAbs, `Game entry file not found: ${path.relative(projectRoot, entryAbs)}`);
  await assertDirExists(publicDirAbs, `publicDir is not a directory: ${path.relative(projectRoot, publicDirAbs)}`);
  await assertFileExists(
    iconAbs,
    `vivo icon not found: ${path.relative(projectRoot, iconAbs)}`,
    `Place the vivo channel icon at ${path.relative(process.cwd(), iconAbs)} and run pack again.`,
  );

  const { versionCode, versionName } = await nextVivoVersion(projectRoot);

  const loaded: LoadedGameConfig = {
    platform: 'vivo',
    projectRoot,
    game: {
      title: game.title,
      entry: game.entry,
      publicDir: game.publicDir,
      orientation: game.orientation,
      canvas: game.canvas,
      serverBaseUrl: config.serverBaseUrl ?? game.serverBaseUrl,
    },
    materials: {
      packageName: config.vivo.packageName,
      iconPath: config.vivo.iconPath,
      versionName,
      versionCode,
    },
    vivoMaterials: {
      packageName: config.vivo.packageName,
      iconPath: config.vivo.iconPath,
      versionName,
      versionCode,
    },
    paths: {
      configFileAbs,
      entryAbs,
      publicDirAbs,
      channelRoot: projectRoot,
      materialsAbs: configFileAbs,
      iconAbs,
      outDirAbs: tempOutDir,
    },
  };

  const builder = getPlatformBuilder('vivo');
  const report = await builder.build(loaded);

  for (const warning of report.warnings) {
    logger.warn(warning);
  }

  const rpkSource = await findRpkFile(tempOutDir, config.vivo.packageName);
  await fs.ensureDir(outputDirAbs);
  const finalRpk = path.join(outputDirAbs, `${config.vivo.packageName}.rpk`);
  await fs.copyFile(rpkSource, finalRpk);

  await commitVivoVersion(projectRoot, versionCode);

  const printable = path.relative(process.cwd(), finalRpk) || finalRpk;
  logger.success(`Built vivo .rpk (v${versionName} / code ${versionCode}) -> ${printable}`);
}

async function nextVivoVersion(projectRoot: string): Promise<{ versionCode: number; versionName: string }> {
  const stateFile = path.join(projectRoot, VERSION_STATE_DIR, VERSION_STATE_FILE);
  let last = 0;
  try {
    const text = await fs.readFile(stateFile, 'utf8');
    const parsed = JSON.parse(text) as Partial<VivoVersionState>;
    if (typeof parsed.lastVersionCode === 'number' && parsed.lastVersionCode > 0) {
      last = Math.floor(parsed.lastVersionCode);
    }
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      throw new UserError(
        `Failed to read vivo version state: ${stateFile}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  const versionCode = last + 1;
  const versionName = `1.0.${versionCode - 1}`;
  return { versionCode, versionName };
}

async function commitVivoVersion(projectRoot: string, versionCode: number): Promise<void> {
  const stateDir = path.join(projectRoot, VERSION_STATE_DIR);
  const stateFile = path.join(stateDir, VERSION_STATE_FILE);
  await fs.ensureDir(stateDir);
  const payload: VivoVersionState = { lastVersionCode: versionCode };
  await fs.writeFile(stateFile, `${JSON.stringify(payload, null, 2)}\n`);
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

function resolveInside(projectRoot: string, value: string, fieldName: string): string {
  if (path.isAbsolute(value)) {
    throw new UserError(
      `${fieldName} must be a path relative to the project root: ${value}`,
      `Use a relative path inside ${path.relative(process.cwd(), projectRoot) || '.'}.`,
    );
  }
  const resolved = path.resolve(projectRoot, value);
  const rel = path.relative(projectRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new UserError(
      `${fieldName} escapes the project root: ${value}`,
      `Keep ${fieldName} inside ${path.relative(process.cwd(), projectRoot) || '.'}.`,
    );
  }
  return resolved;
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
