import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const vivoGameDir = path.join(repoRoot, 'games/gonglian-fangxian');
const vivoOutputDir = path.join(vivoGameDir, 'channels/vivo/build');

afterEach(async () => {
  await fs.rm(vivoOutputDir, { force: true, recursive: true });
});

describe('repository game build command', () => {
  test('builds a vivo project for gonglian-fangxian into channels/vivo/build without changing game files', async () => {
    const beforeSnapshot = await snapshotFiles(vivoGameDir, ['channels/vivo/build']);

    const result = await runCommand(['pnpm', 'build', 'games/gonglian-fangxian', '--platform', 'vivo'], repoRoot);

    const afterSnapshot = await snapshotFiles(vivoGameDir, ['channels/vivo/build']);
    expect(afterSnapshot).toEqual(beforeSnapshot);

    expect(result.exitCode).toBe(0);
    await expect(fs.stat(path.join(vivoOutputDir, 'package.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/manifest.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/main.js'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/runtime-adapter/ral.js'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/runtime-adapter/web-adapter.js'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/game.js'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/icon.png'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/audio/bgm.mp3'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'build-report.json'))).resolves.toBeTruthy();

    const manifest = JSON.parse(await fs.readFile(path.join(vivoOutputDir, 'src/manifest.json'), 'utf8'));
    expect(manifest.package).toBe('com.jnsy.qmbg.vivominigame');
    expect(manifest.versionName).toBe('1.0.37');
    expect(manifest.versionCode).toBe(38);

    const report = JSON.parse(await fs.readFile(path.join(vivoOutputDir, 'build-report.json'), 'utf8'));
    expect(report).toMatchObject({
      tool: 'mini-pack',
      platform: 'vivo',
      outDir: 'channels/vivo/build',
    });
    expect(report.bundle.bytes).toBeGreaterThan(0);
    expect(report.assets.count).toBeGreaterThan(0);
  });
});

function runCommand(
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const resolved = resolveCommand(args[0], args.slice(1));
    const child = spawn(resolved.command, resolved.args, {
      cwd,
      env: { ...process.env, ...env },
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
  });
}

function resolveCommand(command: string, args: string[]): { command: string; args: string[] } {
  if (process.platform === 'win32' && command === 'pnpm') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm', ...args] };
  }
  return { command, args };
}

async function snapshotFiles(dir: string, excludeRelPaths: string[] = []): Promise<Record<string, string>> {
  const exclude = new Set(excludeRelPaths.map((p) => path.normalize(p)));

  async function walk(current: string): Promise<Array<[string, string]>> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    const results = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(current, entry.name);
        const relativePath = path.relative(dir, entryPath);
        if (exclude.has(relativePath)) return [] as Array<[string, string]>;
        if (entry.isDirectory()) return walk(entryPath);
        if (!entry.isFile()) return [] as Array<[string, string]>;
        const fileBuffer = await fs.readFile(entryPath);
        return [[relativePath, crypto.createHash('sha256').update(fileBuffer).digest('hex')]] as Array<[string, string]>;
      }),
    );
    return results.flat();
  }

  return Object.fromEntries(await walk(dir));
}
