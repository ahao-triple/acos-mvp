import { spawn } from 'node:child_process';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

describe('mini-pack validate', () => {
  test('exits 0 for a valid Douyin fixture', async () => {
    const result = await runCli(['validate', '--platform', 'douyin'], fixturePath('valid-douyin-game'));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Configuration valid');
  });

  test('exits 1 and names the missing entry path', async () => {
    const result = await runCli(['validate', '--platform', 'douyin'], fixturePath('missing-entry'));

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('game/src/main.ts');
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
