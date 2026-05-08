import path from 'node:path';

import fg from 'fast-glob';
import fs from 'fs-extra';

import type { AssetStats } from '../shared/types.js';

export interface CopyAssetsOptions {
  sourceDir: string;
  destinationDir: string;
}

export async function copyAssets(options: CopyAssetsOptions): Promise<AssetStats> {
  await fs.remove(options.destinationDir);
  await fs.ensureDir(options.destinationDir);
  await fs.copy(options.sourceDir, options.destinationDir, {
    dereference: false,
    errorOnExist: false,
    overwrite: true,
  });

  return statFiles(options.destinationDir);
}

export async function statFiles(rootDir: string): Promise<AssetStats> {
  const files = await fg('**/*', {
    cwd: rootDir,
    dot: true,
    onlyFiles: true,
  });

  let bytes = 0;
  for (const file of files) {
    const stat = await fs.stat(path.join(rootDir, file));
    bytes += stat.size;
  }

  return {
    count: files.length,
    bytes,
  };
}
