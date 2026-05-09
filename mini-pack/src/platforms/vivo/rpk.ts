import { spawn, type SpawnOptions } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { UserError } from '../../shared/errors.js';
import type { LoadedGameConfig } from '../../shared/types.js';
import { createVivoPackageName } from './template.js';

export interface VivoRpkBuildResult {
  rpkFiles: string[];
}

export interface VivoCliCommand {
  command: string;
  args: string[];
  spawnOptions: Pick<SpawnOptions, 'shell'>;
}

interface VivoCliRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

const VIVO_CLI_BIN = 'mgs';

export async function buildVivoRpk(projectDir: string, config: LoadedGameConfig): Promise<VivoRpkBuildResult> {
  if (process.env.MINI_PACK_VIVO_FAKE_RPK === '1') {
    const fakeRpk = path.join(projectDir, 'dist/debug', `${createVivoPackageName(config.douyin.projectName)}.rpk`);
    await fs.mkdir(path.dirname(fakeRpk), { recursive: true });
    await fs.writeFile(fakeRpk, 'fake vivo rpk for tests\n');
    return { rpkFiles: [fakeRpk] };
  }

  const cliCommand = createVivoCliCommand();
  const cliResult = await runCommand(cliCommand, projectDir);

  const rpkFiles = await findRpkFiles(projectDir);
  if (rpkFiles.length > 0) {
    return { rpkFiles };
  }

  if (cliResult.exitCode !== 0) {
    throw new UserError(
      `Vivo CLI failed with exit code ${cliResult.exitCode ?? 'unknown'}.`,
      `Command: ${cliCommand.command} ${cliCommand.args.join(' ')}\nProject: ${projectDir}\nstdout:\n${cliResult.stdout}\nstderr:\n${cliResult.stderr}`,
    );
  }

  if (rpkFiles.length === 0) {
    throw new UserError(
      'Vivo CLI completed but no .rpk file was found.',
      `Command: ${cliCommand.command} ${cliCommand.args.join(' ')}\nProject: ${projectDir}\nstdout:\n${cliResult.stdout}\nstderr:\n${cliResult.stderr}`,
    );
  }

  return { rpkFiles };
}

export function createVivoCliCommand(platform = process.platform): VivoCliCommand {
  return {
    command: VIVO_CLI_BIN,
    args: ['build'],
    spawnOptions: {
      shell: platform === 'win32',
    },
  };
}

function runCommand(cliCommand: VivoCliCommand, cwd: string): Promise<VivoCliRunResult> {
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
          `Failed to start Vivo CLI: ${error.message}`,
          `Command: ${cliCommand.command} ${cliCommand.args.join(' ')}\nProject: ${cwd}\nInstall @vivo-minigame/cli globally so the ${VIVO_CLI_BIN} command is available.`,
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
