import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePrefix = 'acos-mvp-';

for (const entry of await fs.readdir(repoRoot)) {
  if (entry.startsWith(packagePrefix) && entry.endsWith('.tgz')) {
    await fs.remove(path.join(repoRoot, entry));
  }
}
