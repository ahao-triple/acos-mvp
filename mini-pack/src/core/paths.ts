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

export function isSameOrInside(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
