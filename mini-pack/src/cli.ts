#!/usr/bin/env node
import { Command } from 'commander';

import { runBuildCommand } from './commands/build.js';
import { runValidateCommand } from './commands/validate.js';
import { isUserError } from './shared/errors.js';
import { logger } from './shared/logger.js';

export async function main(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('mini-pack')
    .description('Package controlled Canvas games into mini game platform outputs.')
    .version('0.1.0');

  program
    .command('validate')
    .description('Validate game.config.ts and project files.')
    .requiredOption('--platform <platform>', 'target platform')
    .action(async (options: { platform: string }) => {
      await runValidateCommand({
        platform: options.platform,
      });
    });

  program
    .command('build')
    .description('Build the platform output package.')
    .requiredOption('--platform <platform>', 'target platform')
    .option('--project-root <path>', 'project root that contains game.config.ts')
    .option('--out-dir <path>', 'override output directory, resolved from the current working directory')
    .action(async (options: { platform: string; projectRoot?: string; outDir?: string }) => {
      await runBuildCommand({
        platform: options.platform,
        projectRoot: options.projectRoot,
        outDir: options.outDir,
      });
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
