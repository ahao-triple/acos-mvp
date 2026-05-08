import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gamePath = process.argv[2];

if (!gamePath) {
  console.error('Usage: pnpm build games/<game-project>');
  process.exit(1);
}

const gameRoot = path.resolve(repoRoot, gamePath);
const gameName = path.basename(gameRoot);
const configFile = path.join(gameRoot, 'game.config.ts');
const outDir = path.posix.join('build', `${gameName}-douyin`);

if (!fs.existsSync(configFile)) {
  console.error(`Config file not found: ${path.relative(repoRoot, configFile)}`);
  process.exit(1);
}

run('pnpm', ['--dir', 'mini-pack', 'build']);
run(process.execPath, [
  'mini-pack/dist/cli.js',
  'build',
  '--platform',
  'douyin',
  '--project-root',
  gamePath,
  '--out-dir',
  outDir,
]);
run(process.execPath, ['scripts/smoke-douyin.mjs', gamePath]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
