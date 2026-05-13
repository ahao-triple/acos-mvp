import { spawn, type SpawnOptions } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { UserError } from '../../shared/errors.js';
import type { LoadedGameConfig } from '../../shared/types.js';

export interface OppoRpkBuildResult {
  rpkFiles: string[];
}

export interface OppoCliCommand {
  command: string;
  args: string[];
  spawnOptions: Pick<SpawnOptions, 'env' | 'shell'>;
}

interface OppoCliRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

const OPPO_CLI_BIN = 'quickgame';

export async function buildOppoRpk(projectDir: string, loaded: LoadedGameConfig): Promise<OppoRpkBuildResult> {
  if (loaded.platform !== 'oppo' || !loaded.oppoMaterials) {
    throw new UserError('buildOppoRpk requires a loaded oppo config');
  }
  if (process.env.MINI_PACK_OPPO_FAKE_RPK === '1') {
    const fakeRpk = path.join(projectDir, 'dist/debug', `${loaded.oppoMaterials.packageName}.rpk`);
    await fs.mkdir(path.dirname(fakeRpk), { recursive: true });
    await fs.writeFile(fakeRpk, 'fake oppo rpk for tests\n');
    return { rpkFiles: [fakeRpk] };
  }

  const packageRoot = await findMiniPackRoot(path.dirname(fileURLToPath(import.meta.url)));
  const cliCommand = createOppoCliCommand(packageRoot);
  const cliResult = await runCommand(cliCommand, projectDir);

  const rpkFiles = await findRpkFiles(projectDir);
  if (rpkFiles.length > 0) {
    return { rpkFiles };
  }

  if (cliResult.exitCode !== 0) {
    throw new UserError(
      `Oppo CLI failed with exit code ${cliResult.exitCode ?? 'unknown'}.`,
      `Command: ${cliCommand.command} ${cliCommand.args.join(' ')}\nProject: ${projectDir}\nstdout:\n${cliResult.stdout}\nstderr:\n${cliResult.stderr}`,
    );
  }

  if (rpkFiles.length === 0) {
    throw new UserError(
      'Oppo CLI completed but no .rpk file was found.',
      `Command: ${cliCommand.command} ${cliCommand.args.join(' ')}\nProject: ${projectDir}\nstdout:\n${cliResult.stdout}\nstderr:\n${cliResult.stderr}`,
    );
  }

  return { rpkFiles };
}

export function createOppoCliCommand(packageRoot: string, platform = process.platform): OppoCliCommand {
  return {
    command: OPPO_CLI_BIN,
    args: ['pack', 'release'],
    spawnOptions: {
      env: {
        ...process.env,
        PATH: prependPath(path.join(packageRoot, 'node_modules/.bin'), process.env.PATH),
      },
      shell: platform === 'win32',
    },
  };
}

function prependPath(directory: string, currentPath: string | undefined): string {
  return currentPath ? `${directory}${path.delimiter}${currentPath}` : directory;
}

async function findMiniPackRoot(startDir: string): Promise<string> {
  let current = startDir;

  for (;;) {
    const packageJsonPath = path.join(current, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as { name?: string };
      if (packageJson.name === 'mini-pack') {
        return current;
      }
    } catch {
      // Keep walking toward the filesystem root.
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new UserError('Unable to locate the mini-pack package root.');
    }
    current = parent;
  }
}

function runCommand(cliCommand: OppoCliCommand, cwd: string): Promise<OppoCliRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cliCommand.command, cliCommand.args, {
      cwd,
      ...cliCommand.spawnOptions,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
    child.on('error', (error) => {
      reject(
        new UserError(
          "OPPO CLI 'quickgame' not found. Install @oppo-minigame/cli or set MINI_PACK_OPPO_FAKE_RPK=1 for test builds.",
          `Command: ${cliCommand.command} ${cliCommand.args.join(' ')}\nProject: ${cwd}\nOriginal error: ${error.message}`,
        ),
      );
    });
  });
}

async function findRpkFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return findRpkFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith('.rpk') ? [entryPath] : [];
    }),
  );
  return files.flat().sort();
}
