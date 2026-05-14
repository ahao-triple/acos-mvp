import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadSupportedPlatforms(repoRoot) {
  const indexFile = path.join(repoRoot, 'mini-pack/dist/index.js');
  runLocalBin(repoRoot, 'tsc', ['-p', 'mini-pack/tsconfig.json']);

  const mod = await import(pathToFileURL(indexFile).href);
  const platforms = mod.SUPPORTED_PLATFORMS;
  if (!Array.isArray(platforms) || platforms.length === 0) {
    throw new Error('mini-pack did not export a non-empty SUPPORTED_PLATFORMS array.');
  }
  return platforms;
}

export function platformUsage(platforms) {
  return platforms.join('|');
}

export function validatePlatform(platform, platforms) {
  if (platforms.includes(platform)) return { ok: true };
  return {
    ok: false,
    message: `Unsupported platform: ${platform}\nSupported platforms: ${platforms.join(', ')}`,
  };
}

export function runLocalBin(repoRoot, bin, args) {
  run(repoRoot, path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? `${bin}.cmd` : bin), args);
}

export function run(repoRoot, command, args, options = {}) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, { cwd: repoRoot, stdio: 'inherit', ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function resolveCommand(command, args) {
  if (process.platform === 'win32' && command.endsWith('.cmd')) {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', command, ...args] };
  }
  if (process.platform === 'win32' && command === 'pnpm') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm', ...args] };
  }
  return { command, args };
}
