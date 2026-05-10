import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, test } from 'vitest';

const validFixture = fixturePath('valid-douyin-game');
const outputDir = path.join(validFixture, 'builds/douyin');
const vivoOutputDir = path.join(validFixture, 'builds/vivo');

afterEach(async () => {
  await fs.rm(path.join(validFixture, 'builds'), { force: true, recursive: true });
});

describe('mini-pack build', () => {
  test('generates a complete Douyin output without modifying source files', async () => {
    const sourceBefore = await fs.readFile(path.join(validFixture, 'game/src/main.ts'), 'utf8');

    const result = await runCli(['build', '--platform', 'douyin'], validFixture);

    expect(result.exitCode).toBe(0);
    await expect(fs.stat(path.join(outputDir, 'game.js'))).resolves.toBeTruthy();
    const gameJs = await fs.readFile(path.join(outputDir, 'game.js'), 'utf8');
    expect(gameJs).toContain('createInnerAudioContext');
    expect(gameJs).toContain('assets/audio/');
    expect(gameJs).toContain("musicAudio.src = musicPath(name);");
    expect(gameJs).toContain("'.mp3'");
    expect(gameJs).not.toContain('musicAudio.src = sfxPath(name);');
    expect(gameJs).toContain('var haptics = {');
    expect(gameJs).toContain("info('Haptic platform call.'");
    expect(gameJs).toContain("info('Haptic platform success.'");
    expect(gameJs).toContain("warn('Haptic platform failed.'");
    expect(gameJs).toContain('haptics: haptics');
    expect(gameJs).toContain('navigateToScene');
    expect(gameJs).toContain('onShow');
    expect(gameJs).toContain('021036');
    expect(gameJs).toContain('sidebar_card');
    expect(gameJs).toContain('tt.checkShortcut');
    expect(gameJs).toContain('tt.addShortcut');
    expect(gameJs).toContain('tt.checkShortcut(function');
    expect(gameJs).toContain('tt.addShortcut(function');
    expect(gameJs).toContain('tt.showFavoriteGuide');
    expect(gameJs).toContain("type: 'bar'");
    expect(gameJs).toContain('createRewardedVideoAd');
    expect(gameJs).toContain('rewardedAdUnitId');
    await expect(fs.stat(path.join(outputDir, 'assets/piece-shield.txt'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(outputDir, 'assets/nested/readme.txt'))).resolves.toBeTruthy();
    expect(JSON.parse(await fs.readFile(path.join(outputDir, 'game.json'), 'utf8'))).toEqual({
      deviceOrientation: 'portrait',
      showStatusBar: false,
    });
    expect(JSON.parse(await fs.readFile(path.join(outputDir, 'project.config.json'), 'utf8'))).toEqual({
      appid: '',
      projectname: 'gonglian-fangxian',
      setting: {
        es6: true,
      },
      condition: {},
    });
    const report = JSON.parse(await fs.readFile(path.join(outputDir, 'build-report.json'), 'utf8'));
    expect(report).toMatchObject({
      tool: 'mini-pack',
      platform: 'douyin',
      title: '共联防线',
      bundle: {
        file: 'game.js',
      },
      assets: {
        count: 2,
      },
    });
    expect(report.bundle.bytes).toBeGreaterThan(0);
    expect(report.assets.bytes).toBeGreaterThan(0);
    await expect(fs.readFile(path.join(validFixture, 'game/src/main.ts'), 'utf8')).resolves.toBe(sourceBefore);
  });

  test('generates a vivo project without modifying source files', async () => {
    const sourceBefore = await fs.readFile(path.join(validFixture, 'game/src/main.ts'), 'utf8');

    const result = await runCli(['build', '--platform', 'vivo', '--out-dir', 'builds/vivo', '--skip-vivo-rpk'], validFixture);

    expect(result.exitCode).toBe(0);
    await expect(fs.stat(path.join(vivoOutputDir, 'package.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/manifest.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/icon.png'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/game.js'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/assets/piece-shield.txt'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(vivoOutputDir, 'src/assets/nested/readme.txt'))).resolves.toBeTruthy();

    const packageJson = JSON.parse(await fs.readFile(path.join(vivoOutputDir, 'package.json'), 'utf8'));
    expect(packageJson.scripts).toMatchObject({
      build: 'mgs build',
      release: 'mgs release',
      watch: 'mgs watch',
      server: 'mgs server',
    });
    expect(packageJson.devDependencies).toMatchObject({
      '@vivo-minigame/cli': '1.27.23',
    });

    const manifest = JSON.parse(await fs.readFile(path.join(vivoOutputDir, 'src/manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({
      package: 'com.minipack.gonglianfangxian',
      name: '共联防线',
      versionName: '1.0.0',
      versionCode: 1,
      minPlatformVersion: 1060,
      deviceOrientation: 'portrait',
      type: 'game',
      icon: '/icon.png',
      config: {
        logLevel: 'debug',
      },
    });

    const gameJs = await fs.readFile(path.join(vivoOutputDir, 'src/game.js'), 'utf8');
    expect(gameJs).toContain('var qg = root.qg || {};');
    expect(gameJs).toContain('qg.createCanvas');
    expect(gameJs).toContain('qg.createInnerAudioContext');
    expect(gameJs).toContain('qg.createRewardedVideoAd');
    expect(gameJs).toContain('ad.onError(onError)');
    expect(gameJs).toContain('haptics: haptics');
    expect(gameJs).toContain('ad.offError(onError)');
    expect(gameJs).toContain('[mini-pack:vivo]');
    expect(gameJs).toContain('musicAudio.src = musicPath(name);');
    expect(gameJs).toContain("'.mp3'");

    const report = JSON.parse(await fs.readFile(path.join(vivoOutputDir, 'build-report.json'), 'utf8'));
    expect(report).toMatchObject({
      tool: 'mini-pack',
      platform: 'vivo',
      title: '共联防线',
      outDir: 'builds/vivo',
      bundle: {
        file: 'game.js',
      },
      assets: {
        count: 2,
      },
    });

    await expect(fs.readFile(path.join(validFixture, 'game/src/main.ts'), 'utf8')).resolves.toBe(sourceBefore);
  });

  test('invokes the vivo RPK builder and records the generated artifact', async () => {
    const result = await runCli(['build', '--platform', 'vivo', '--out-dir', 'builds/vivo'], validFixture, {
      MINI_PACK_VIVO_FAKE_RPK: '1',
    });

    expect(result.exitCode).toBe(0);
    const rpkFiles = await findRpkFiles(vivoOutputDir);
    expect(rpkFiles).toEqual([path.join(vivoOutputDir, 'dist/debug/com.minipack.gonglianfangxian.rpk')]);
    expect(result.stdout).toContain('Built vivo package at builds/vivo');
  });
});

function runCli(
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', pathToFileURL(path.resolve('node_modules/tsx/dist/loader.mjs')).href, path.resolve('src/cli.ts'), ...args], {
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

function fixturePath(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}/`, import.meta.url));
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
