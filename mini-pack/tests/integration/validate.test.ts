import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, test } from 'vitest';

describe('mini-pack validate', () => {
  const validFixture = fixturePath('valid-douyin-game');

  test('exits 0 for a valid Douyin fixture', async () => {
    const result = await runCli(['validate', '--platform', 'douyin'], validFixture);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Configuration valid');
  });

  test('validates a config through the vivo platform override', async () => {
    const result = await runCli(['validate', '--platform', 'vivo'], validFixture);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Configuration valid for vivo: 共联防线');
  });

  test('reports all supported platforms for invalid validation platform', async () => {
    const result = await runCli(['validate', '--platform', 'wechat'], validFixture);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unsupported platform: wechat');
    expect(result.stderr).toContain('Supported platforms: douyin, vivo');
  });

  test('exits 1 and names the missing entry path', async () => {
    const result = await runCli(['validate', '--platform', 'douyin'], fixturePath('missing-entry'));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('game/src/main.ts');
  });
});

function runCli(args: string[], cwd: string): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', pathToFileURL(path.resolve('node_modules/tsx/dist/loader.mjs')).href, path.resolve('src/cli.ts'), ...args], {
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
  return fileURLToPath(new URL(`../fixtures/${name}/`, import.meta.url));
}
