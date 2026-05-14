import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSupportedPlatforms } from './platforms.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = path.join(repoRoot, 'games');
const supportedPlatforms = await loadSupportedPlatforms(repoRoot);

const matrix = collectMatrix(gamesDir);
console.log(`[verify:full] 矩阵：${matrix.map((m) => `${m.gameName}×${m.platform}`).join(', ')}`);

runOrExit('pnpm', ['test:game'], 'test:game', process.env);
runOrExit('pnpm', ['test:cli'], 'test:cli', process.env);

for (const { gameName, platform } of matrix) {
  const env = platform === 'vivo'
    ? { ...process.env, MINI_PACK_VIVO_FAKE_RPK: '1' }
    : process.env;
  runOrExit(
    'pnpm',
    ['build', `games/${gameName}`, '--platform', platform],
    `${gameName} × ${platform}`,
    env,
  );
}

console.log(`[verify:full] 全部 ${matrix.length} 组通过`);

function collectMatrix(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const result = [];
  for (const gameName of fs.readdirSync(rootDir).sort()) {
    const channelsDir = path.join(rootDir, gameName, 'channels');
    if (!fs.existsSync(channelsDir) || !fs.statSync(channelsDir).isDirectory()) continue;
    for (const platform of supportedPlatforms) {
      if (fs.existsSync(path.join(channelsDir, platform, 'materials.ts'))) {
        result.push({ gameName, platform });
      }
    }
  }
  return result;
}

function runOrExit(command, args, label, env) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
  });
  if (result.status !== 0) {
    console.error(`[verify:full] ${label} 失败 (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

function resolveCommand(command, args) {
  if (process.platform === 'win32' && command === 'pnpm') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm', ...args] };
  }
  return { command, args };
}
