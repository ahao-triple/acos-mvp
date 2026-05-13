#!/usr/bin/env node
import { Command } from 'commander';

import { runBuildCommand } from './commands/build.js';
import { runPackCommand } from './commands/pack.js';
import { reportPreflightIssues, runPreflight } from './commands/preflight.js';
import { isUserError } from './shared/errors.js';
import { logger } from './shared/logger.js';
import type { PlatformName } from './shared/types.js';

export async function main(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('mini-pack')
    .description('Package controlled Canvas games into mini game platform outputs.')
    .version('0.1.0');

  program
    .command('preflight')
    .description('Validate channel materials before building.')
    .requiredOption('--platform <platform>', 'target platform')
    .requiredOption('--project-root <path>', 'project root that contains game.config.ts')
    .action(async (options: { platform: string; projectRoot: string }) => {
      const platform = options.platform as PlatformName;
      const result = await runPreflight({ projectRoot: options.projectRoot, platform });
      if (result.issues.length > 0) {
        reportPreflightIssues(result.issues, platform, options.projectRoot);
        process.exitCode = 1;
        return;
      }
      logger.success(`Preflight passed for ${platform}.`);
    });

  program
    .command('build')
    .description('Build the platform output package.')
    .requiredOption('--platform <platform>', 'target platform')
    .requiredOption('--project-root <path>', 'project root that contains game.config.ts')
    .option('--skip-vivo-rpk', 'generate vivo project files without invoking mg-service')
    .action(async (options: { platform: string; projectRoot: string; skipVivoRpk?: boolean }) => {
      const platform = options.platform as PlatformName;
      const result = await runPreflight({ projectRoot: options.projectRoot, platform });
      if (result.issues.length > 0) {
        reportPreflightIssues(result.issues, platform, options.projectRoot);
        process.exitCode = 1;
        return;
      }
      await runBuildCommand({
        platform,
        projectRoot: options.projectRoot,
        skipVivoRpk: options.skipVivoRpk,
      });
    });

  program
    .command('pack')
    .description('Pack a mini game using a single JSON build config and output a single .rpk.')
    .argument('<config>', 'path to the JSON build config')
    .action(async (configFile: string) => {
      await runPackCommand({ configFile });
    });

  await program.parseAsync(argv);
}

main().catch((error: unknown) => {
  if (isUserError(error)) {
    logger.error(error.message);
    process.exitCode = error.exitCode;
    return;
  }

  logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 2;
});
