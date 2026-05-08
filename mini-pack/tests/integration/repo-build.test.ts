import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

const repoRoot = path.resolve(new URL('../../../', import.meta.url).pathname);
const outputDir = path.join(repoRoot, 'build/gonglian-fangxian-douyin');
const gameEnvFile = path.join(repoRoot, 'games/gonglian-fangxian/.env');
let previousGameEnv: string | null = null;

afterEach(async () => {
  await fs.rm(path.join(repoRoot, 'build'), { force: true, recursive: true });
  if (previousGameEnv === null) {
    await fs.rm(gameEnvFile, { force: true });
  } else {
    await fs.writeFile(gameEnvFile, previousGameEnv);
  }
  previousGameEnv = null;
});

describe('repository game build command', () => {
  test('builds a Douyin package for a game project into the repository build directory', async () => {
    previousGameEnv = await readOptionalFile(gameEnvFile);
    await fs.writeFile(gameEnvFile, 'DOUYIN_APPID=tt-repo-build-appid\n');

    const result = await runCommand(['pnpm', 'build', 'games/gonglian-fangxian'], repoRoot);

    expect(result.exitCode).toBe(0);
    const smokeResult = await runCommand(['pnpm', 'smoke', 'games/gonglian-fangxian'], repoRoot);
    expect(smokeResult.exitCode).toBe(0);

    await expect(fs.stat(path.join(outputDir, 'game.js'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(outputDir, 'game.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(outputDir, 'project.config.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(outputDir, 'assets/audio/button.wav'))).resolves.toBeTruthy();

    const gameJs = await fs.readFile(path.join(outputDir, 'game.js'), 'utf8');
    expect(gameJs).not.toContain('VITE_DOUYIN_REWARDED_AD_UNIT_ID');
    expect(gameJs).not.toContain('import_meta.env');
    expect(gameJs).not.toMatch(/\?\.(?!\d)|\?\?/);

    const gameJson = JSON.parse(await fs.readFile(path.join(outputDir, 'game.json'), 'utf8'));
    expect(gameJson).toEqual({
      deviceOrientation: 'portrait',
      showStatusBar: false,
    });
    const projectConfig = JSON.parse(await fs.readFile(path.join(outputDir, 'project.config.json'), 'utf8'));
    expect(projectConfig.appid).toBe('tt-repo-build-appid');

    const report = JSON.parse(await fs.readFile(path.join(outputDir, 'build-report.json'), 'utf8'));
    expect(report).toMatchObject({
      tool: 'mini-pack',
      platform: 'douyin',
      title: '共联防线',
      outDir: 'build/gonglian-fangxian-douyin',
      bundle: {
        file: 'game.js',
      },
    });
    expect(report.bundle.bytes).toBeGreaterThan(0);
    expect(report.assets.count).toBeGreaterThan(0);
  });
});

async function readOptionalFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

function runCommand(args: string[], cwd: string): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(args[0], args.slice(1), {
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
