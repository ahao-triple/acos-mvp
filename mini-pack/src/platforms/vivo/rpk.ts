import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { UserError } from '../../shared/errors.js';
import type { LoadedGameConfig } from '../../shared/types.js';
import { createVivoPackageName } from './template.js';

export interface VivoRpkBuildResult {
  rpkFiles: string[];
}

export async function buildVivoRpk(projectDir: string, config: LoadedGameConfig): Promise<VivoRpkBuildResult> {
  if (process.env.MINI_PACK_VIVO_FAKE_RPK === '1') {
    const fakeRpk = path.join(projectDir, 'dist/debug', `${createVivoPackageName(config.douyin.projectName)}.rpk`);
    await fs.mkdir(path.dirname(fakeRpk), { recursive: true });
    await fs.writeFile(fakeRpk, 'fake vivo rpk for tests\n');
    return { rpkFiles: [fakeRpk] };
  }

  const cliPath = await resolveVivoCliPath();
  await runCommand(cliPath, ['build'], projectDir);

  const rpkFiles = await findRpkFiles(projectDir);
  if (rpkFiles.length === 0) {
    throw new UserError(
      'Vivo CLI completed but no .rpk file was found.',
      `Check the generated project at ${projectDir} and run mg-service build manually for more details.`,
    );
  }

  return { rpkFiles };
}

async function resolveVivoCliPath(): Promise<string> {
  const packageRoot = await findMiniPackRoot(path.dirname(fileURLToPath(import.meta.url)));
  const executable = process.platform === 'win32' ? 'mg-service.cmd' : 'mg-service';
  const cliPath = path.join(packageRoot, 'node_modules', '.bin', executable);

  try {
    await fs.access(cliPath);
    return cliPath;
  } catch {
    throw new UserError(
      'Vivo CLI is not installed.',
      'Run pnpm --dir mini-pack install, then rerun pnpm build games/gonglian-fangxian --platform vivo.',
    );
  }
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

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(
        new UserError(
          `Vivo CLI failed with exit code ${exitCode ?? 'unknown'}.`,
          `Command: ${command} ${args.join(' ')}\nProject: ${cwd}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      );
    });
    child.on('error', (error) => {
      reject(
        new UserError(
          `Failed to start Vivo CLI: ${error.message}`,
          `Command: ${command} ${args.join(' ')}\nProject: ${cwd}`,
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
