import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

const validFixture = fixturePath('valid-douyin-game');
const outputDir = path.join(validFixture, 'builds/douyin');

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
});

function runCli(args: string[], cwd: string): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', path.resolve('node_modules/tsx/dist/loader.mjs'), path.resolve('src/cli.ts'), ...args], {
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
      resolve({ exitCode, stdout, stderr });
    });
  });
}

function fixturePath(name: string): string {
  return path.resolve(new URL(`../fixtures/${name}/`, import.meta.url).pathname);
}
