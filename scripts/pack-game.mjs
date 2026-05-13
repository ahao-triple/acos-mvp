import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configFile = 'games/gonglian-fangxian/build.vivo.json';

runLocalBin('tsc', ['-p', 'mini-pack/tsconfig.json']);
run(process.execPath, ['mini-pack/dist/cli.js', 'pack', configFile]);

function runLocalBin(bin, args) {
  run(path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? `${bin}.cmd` : bin), args);
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
