import fs from 'node:fs/promises';

import type { BuildReport, PlatformName } from '../shared/types.js';

const BUNDLE_WARNING_BYTES = 2 * 1024 * 1024;
const ASSETS_WARNING_BYTES = 10 * 1024 * 1024;
const TOTAL_WARNING_BYTES = 15 * 1024 * 1024;

export interface CreateBuildReportOptions {
  platform: PlatformName;
  title: string;
  entry: string;
  publicDir: string;
  outDir: string;
  bundleBytes: number;
  assetCount: number;
  assetBytes: number;
}

export function createBuildReport(options: CreateBuildReportOptions): BuildReport {
  const warnings: string[] = [];
  const totalBytes = options.bundleBytes + options.assetBytes;

  if (options.bundleBytes > BUNDLE_WARNING_BYTES) {
    warnings.push('game.js is larger than 2 MB.');
  }

  if (options.assetBytes > ASSETS_WARNING_BYTES) {
    warnings.push('assets are larger than 10 MB.');
  }

  if (totalBytes > TOTAL_WARNING_BYTES) {
    warnings.push('total output is larger than 15 MB.');
  }

  return {
    tool: 'mini-pack',
    platform: options.platform,
    title: options.title,
    entry: options.entry,
    publicDir: options.publicDir,
    outDir: options.outDir,
    bundle: {
      file: 'game.js',
      bytes: options.bundleBytes,
    },
    assets: {
      count: options.assetCount,
      bytes: options.assetBytes,
    },
    warnings,
  };
}

export async function writeBuildReport(filePath: string, report: BuildReport): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`);
}
