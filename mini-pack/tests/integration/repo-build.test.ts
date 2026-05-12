import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const douyinGameDir = path.join(repoRoot, 'games/gonglian-fangxian');
const douyinOutputDir = path.join(douyinGameDir, 'channels/douyin/build');
const kuaishouGameDir = path.join(repoRoot, 'games/gonglian-fangxian');
const kuaishouOutputDir = path.join(kuaishouGameDir, 'channels/kuaishou/build');
const vivoGameDir = path.join(repoRoot, 'games/difference-hunt');
const vivoOutputDir = path.join(vivoGameDir, 'channels/vivo/build');

afterEach(async () => {
  await fs.rm(douyinOutputDir, { force: true, recursive: true });
  await fs.rm(kuaishouOutputDir, { force: true, recursive: true });
  await fs.rm(vivoOutputDir, { force: true, recursive: true });
});

describe('repository game build command', () => {
  test('builds a Douyin package for gonglian-fangxian into channels/douyin/build', async () => {
    const result = await runCommand(['pnpm', 'build', 'games/gonglian-fangxian'], repoRoot, {
      DOUYIN_APPID: 'tt-repo-build-appid',
      DOUYIN_REWARDED_AD_UNIT_ID: 'tt-repo-build-rwd',
    });

    expect(result.exitCode).toBe(0);

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
    expect(projectConfig.appid).toBe('tt-repo-build-appid');
    expect(projectConfig.projectname).toBe('gonglian-fangxian');

    const report = JSON.parse(await fs.readFile(path.join(douyinOutputDir, 'build-report.json'), 'utf8'));
    expect(report).toMatchObject({
      tool: 'mini-pack',
      platform: 'douyin',
      outDir: 'channels/douyin/build',
      bundle: {
        file: 'game.js',
      },
    });
    expect(report.title).toEqual(expect.any(String));
    expect(report.title).not.toBe('');
    expect(report.bundle.bytes).toBeGreaterThan(0);
    expect(report.assets.count).toBeGreaterThan(0);
  });

  test('builds a Kuaishou package for gonglian-fangxian into channels/kuaishou/build', async () => {
    const result = await runCommand(
      ['pnpm', 'build', 'games/gonglian-fangxian', '--platform', 'kuaishou'],
      repoRoot,
    );

    expect(result.exitCode).toBe(0);

    await expect(fs.stat(path.join(kuaishouOutputDir, 'game.js'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(kuaishouOutputDir, 'game.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(kuaishouOutputDir, 'project.config.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(kuaishouOutputDir, 'assets/audio/button.wav'))).resolves.toBeTruthy();

    const gameJs = await fs.readFile(path.join(kuaishouOutputDir, 'game.js'), 'utf8');
    expect(gameJs).not.toContain('import_meta.env');
    expect(gameJs).toContain('var ks = root.ks || {};');
    expect(gameJs).toMatch(/var rewardedAdUnitId = "[^"]*";/);

    const gameJson = JSON.parse(await fs.readFile(path.join(kuaishouOutputDir, 'game.json'), 'utf8'));
    expect(gameJson).toEqual({
      deviceOrientation: 'portrait',
      showStatusBar: false,
    });
    const projectConfig = JSON.parse(
      await fs.readFile(path.join(kuaishouOutputDir, 'project.config.json'), 'utf8'),
    );
    expect(typeof projectConfig.appid).toBe('string');
    expect(projectConfig.appid.length).toBeGreaterThan(0);
    expect(projectConfig.projectname).toBe('gonglian-fangxian');
    expect(projectConfig.setting).toEqual({ es6: true });

    const report = JSON.parse(await fs.readFile(path.join(kuaishouOutputDir, 'build-report.json'), 'utf8'));
    expect(report).toMatchObject({
      tool: 'mini-pack',
      platform: 'kuaishou',
      outDir: 'channels/kuaishou/build',
      bundle: { file: 'game.js' },
    });
    expect(report.bundle.bytes).toBeGreaterThan(0);
    expect(report.assets.count).toBeGreaterThan(0);
  });

  test('builds a vivo package for difference-hunt into channels/vivo/build without changing game files', async () => {
    const beforeSnapshot = await snapshotFiles(vivoGameDir, ['channels/vivo/build']);

    const result = await runCommand(['pnpm', 'build', 'games/difference-hunt', '--platform', 'vivo'], repoRoot, {
      MINI_PACK_VIVO_FAKE_RPK: '1',
    });

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

    const rpkFiles = await findRpkFiles(vivoOutputDir);
    expect(rpkFiles).toEqual([path.join(vivoOutputDir, 'dist/debug/com.jnsy.jnysh.vivominigame.rpk')]);

    const manifest = JSON.parse(await fs.readFile(path.join(vivoOutputDir, 'src/manifest.json'), 'utf8'));
    expect(manifest.package).toBe('com.jnsy.jnysh.vivominigame');
    expect(manifest.versionName).toBe('1.0.9');
    expect(manifest.versionCode).toBe(10);

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
