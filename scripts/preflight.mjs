import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supportedPlatforms = new Set(['vivo']);
const defaultGamePath = 'games/gonglian-fangxian';
const usage = 'Usage: pnpm preflight [games/<game-project>] [--platform vivo]';
const parsed = parseArgs(process.argv.slice(2));

if (!parsed.ok) {
  console.error(parsed.message);
  console.error(usage);
  process.exit(1);
}

const { gamePath, platform } = parsed;
const gameRoot = path.resolve(repoRoot, gamePath);
const configFile = path.join(gameRoot, 'game.config.ts');

if (!fs.existsSync(configFile)) {
  console.error(`Config file not found: ${path.relative(repoRoot, configFile)}`);
  process.exit(1);
}

runLocalBin('tsc', ['-p', 'mini-pack/tsconfig.json']);
run(process.execPath, [
  'mini-pack/dist/cli.js',
  'preflight',
  '--platform',
  platform,
  '--project-root',
  gamePath,
]);

function parseArgs(args) {
  let gamePath;
  let platform = 'vivo';
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--platform') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) return { ok: false, message: 'Missing value for --platform.' };
      platform = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--platform=')) {
      platform = arg.slice('--platform='.length);
      if (!platform) return { ok: false, message: 'Missing value for --platform.' };
      continue;
    }
    if (arg.startsWith('--')) return { ok: false, message: `Unexpected argument: ${arg}` };
    if (gamePath) return { ok: false, message: `Unexpected argument: ${arg}` };
    gamePath = arg;
  }
  gamePath ??= defaultGamePath;
  if (!supportedPlatforms.has(platform)) return { ok: false, message: `Unsupported platform: ${platform}\nSupported platforms: ${[...supportedPlatforms].join(', ')}` };
  return { ok: true, gamePath, platform };
}

function run(command, args) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runLocalBin(bin, args) {
  run(path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? `${bin}.cmd` : bin), args);
}

function resolveCommand(command, args) {
  if (process.platform === 'win32' && command.endsWith('.cmd')) {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', command, ...args] };
  }
  return { command, args };
}
