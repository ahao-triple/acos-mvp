import { build as esbuild } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';

import { UserError } from '../shared/errors.js';

export interface BundleGameEntryOptions {
  entryAbs: string;
  outfile: string;
  platform: string;
}

export async function bundleGameEntry(options: BundleGameEntryOptions): Promise<{ bytes: number }> {
  try {
    await fs.mkdir(path.dirname(options.outfile), { recursive: true });
    await esbuild({
      entryPoints: [options.entryAbs],
      outfile: options.outfile,
      bundle: true,
      format: 'iife',
      globalName: '__MiniPackGameBundle',
      platform: 'browser',
      target: 'es2015',
      logLevel: 'silent',
      sourcemap: false,
      define: { __GAME_PLATFORM__: JSON.stringify(options.platform) },
    });

    const stats = await fs.stat(options.outfile);
    return {
      bytes: stats.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UserError(
      `Failed to bundle entry file: ${options.entryAbs}`,
      `Fix the entry file or its imports. esbuild reported: ${message}`,
    );
  }
}
