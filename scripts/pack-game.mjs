import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadSupportedPlatforms,
  platformUsage,
  validatePlatform,
} from './platforms.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supportedPlatforms = await loadSupportedPlatforms(repoRoot);
const defaultPlatform = 'vivo';
const usage = `Usage: pnpm pack [--platform ${platformUsage(supportedPlatforms)}]`;
const parsed = parseArgs(process.argv.slice(2));

if (!parsed.ok) {
  console.error(parsed.message);
  console.error(usage);
  process.exit(1);
}

const configFile = `games/gonglian-fangxian/build.${parsed.platform}.json`;

run(process.execPath, ['mini-pack/dist/cli.js', 'pack', configFile]);

function parseArgs(args) {
  let platform = defaultPlatform;
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
    return { ok: false, message: `Unexpected argument: ${arg}` };
  }
  const validation = validatePlatform(platform, supportedPlatforms);
  if (!validation.ok) return validation;
  return { ok: true, platform };
}

function run(command, args) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function resolveCommand(command, args) {
  if (process.platform === 'win32' && command.endsWith('.cmd')) {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', command, ...args] };
  }
  return { command, args };
}
