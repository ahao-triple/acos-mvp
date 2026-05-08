import path from 'node:path';

import { UserError } from '../shared/errors.js';

export function resolveProjectPath(projectRoot: string, value: string, fieldName: string): string {
  if (path.isAbsolute(value)) {
    throw new UserError(
      `${fieldName} must be relative to the project root: ${value}`,
      `Use a project-relative path in game.config.ts.`,
    );
  }

  const resolved = path.resolve(projectRoot, value);
  if (!isSameOrInside(resolved, projectRoot)) {
    throw new UserError(
      `${fieldName} must stay inside the project root: ${value}`,
      `Update ${fieldName} in game.config.ts to a path inside this project.`,
    );
  }

  return resolved;
}

export function assertSafeOutDir(projectRoot: string, outDir: string, outDirAbs: string): void {
  if (outDirAbs === projectRoot) {
    throw new UserError('outDir cannot point to the project root.', 'Use a dedicated output directory like builds/douyin.');
  }

  assertSafeGeneratedOutDir(projectRoot, outDir, outDirAbs);
}

export function assertSafeGeneratedOutDir(projectRoot: string, outDir: string, outDirAbs: string): void {
  const blockedDirs = [
    { label: 'game/', abs: path.join(projectRoot, 'game') },
    { label: 'platform/', abs: path.join(projectRoot, 'platform') },
    { label: 'assets/raw/', abs: path.join(projectRoot, 'assets/raw') },
  ];

  for (const blocked of blockedDirs) {
    if (isSameOrInside(outDirAbs, blocked.abs)) {
      throw new UserError(
        `outDir cannot be inside ${blocked.label}: ${outDir}`,
        'Use a generated output directory such as builds/douyin.',
      );
    }
  }
}

export function isSameOrInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
