import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const douyinOutputDir = path.join(repoRoot, 'build/gonglian-fangxian-douyin');
const vivoOutputDir = path.join(repoRoot, 'build/gonglian-fangxian-vivo');
const gameProjectDir = path.join(repoRoot, 'games/gonglian-fangxian');

afterEach(async () => {
  await fs.rm(path.join(repoRoot, 'build'), { force: true, recursive: true });
});

describe('repository game build command', () => {
  test('builds a Douyin package for a game project into the repository build directory', async () => {
    const result = await runCommand(['pnpm', 'build', 'games/gonglian-fangxian'], repoRoot, {
      DOUYIN_APPID: 'tt-repo-build-appid',
    });

    expect(result.exitCode).toBe(0);
    const smokeResult = await runCommand(['pnpm', 'smoke', 'games/gonglian-fangxian'], repoRoot);
    expect(smokeResult.exitCode).toBe(0);

    await expect(fs.stat(path.join(douyinOutputDir, 'game.js'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(douyinOutputDir, 'game.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(douyinOutputDir, 'project.config.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(douyinOutputDir, 'assets/audio/button.wav'))).resolves.toBeTruthy();

    const gameJs = await fs.readFile(path.join(douyinOutputDir, 'game.js'), 'utf8');
    expect(gameJs).not.toContain('VITE_DOUYIN_REWARDED_AD_UNIT_ID');
    expect(gameJs).not.toContain('import_meta.env');
    expect(gameJs).not.toMatch(/\?\.(?!\d)|\?\?/);

    const gameJson = JSON.parse(await fs.readFile(path.join(douyinOutputDir, 'game.json'), 'utf8'));
    expect(gameJson).toEqual({
      deviceOrientation: 'portrait',
      showStatusBar: false,
    });
    const projectConfig = JSON.parse(await fs.readFile(path.join(douyinOutputDir, 'project.config.json'), 'utf8'));
    expect(projectConfig.appid).toEqual(expect.any(String));
    expect(projectConfig.appid).not.toBe('');

    const report = JSON.parse(await fs.readFile(path.join(douyinOutputDir, 'build-report.json'), 'utf8'));
    expect(report).toMatchObject({
      tool: 'mini-pack',
      platform: 'douyin',
      outDir: 'build/gonglian-fangxian-douyin',
      bundle: {
        file: 'game.js',
      },
    });
    expect(report.title).toEqual(expect.any(String));
    expect(report.title).not.toBe('');
    expect(report.bundle.bytes).toBeGreaterThan(0);
    expect(report.assets.count).toBeGreaterThan(0);
  });

  test('builds a vivo package for a game project into the repository build directory without changing game files', async () => {
    const beforeSnapshot = await snapshotFiles(gameProjectDir);

    const result = await runCommand(['pnpm', 'build', 'games/gonglian-fangxian', '--platform', 'vivo'], repoRoot, {
      MINI_PACK_VIVO_FAKE_RPK: '1',
    });

    const afterSnapshot = await snapshotFiles(gameProjectDir);
    expect(afterSnapshot).toEqual(beforeSnapshot);

    expect(result.exitCode).toBe(0);
    await expect(fs.stat(path.join(vivoOutputDir, 'package.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/manifest.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/game.js'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/assets/audio/button.wav'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'build-report.json'))).resolves.toBeTruthy();

    const rpkFiles = await findRpkFiles(vivoOutputDir);
    expect(rpkFiles).toEqual([path.join(vivoOutputDir, 'dist/debug/com.minipack.gonglianfangxian.rpk')]);

    const report = JSON.parse(await fs.readFile(path.join(vivoOutputDir, 'build-report.json'), 'utf8'));
    expect(report).toMatchObject({
      tool: 'mini-pack',
      platform: 'vivo',
      outDir: 'build/gonglian-fangxian-vivo',
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

async function snapshotFiles(dir: string): Promise<Record<string, string>> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      const relativePath = path.relative(dir, entryPath);
      if (entry.isDirectory()) {
        const childSnapshot = await snapshotFiles(entryPath);
        return Object.entries(childSnapshot).map(([childPath, hash]) => [path.join(relativePath, childPath), hash]);
      }
      if (!entry.isFile()) {
        return [];
      }
      const fileBuffer = await fs.readFile(entryPath);
      return [[relativePath, crypto.createHash('sha256').update(fileBuffer).digest('hex')]];
    }),
  );
  return Object.fromEntries(files.flat());
}
