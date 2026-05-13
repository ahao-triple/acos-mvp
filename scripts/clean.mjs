import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  'build',
  'builds',
  'dist',
  '.mini-pack',
  'test-results',
  'playwright-report',
  'mini-pack/dist',
  'mini-pack/tests/tmp',
  'games/gonglian-fangxian/dist',
  'games/gonglian-fangxian/.mini-pack',
  'games/gonglian-fangxian/channels/vivo/build',
  'games/gonglian-fangxian/game/dist',
  'games/gonglian-fangxian/game/test-results',
  'games/gonglian-fangxian/game/playwright-report',
];

for (const target of targets) {
  await fs.remove(path.join(repoRoot, target));
}

console.log(`[clean] removed ${targets.length} generated paths`);
