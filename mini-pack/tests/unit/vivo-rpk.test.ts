import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { createVivoCliCommand } from '../../src/platforms/vivo/rpk.js';

describe('createVivoCliCommand', () => {
  test('uses a shell-safe command for Windows cmd shims', () => {
    const packageRoot = path.join('C:', 'repo', 'mini-pack');

    const command = createVivoCliCommand(packageRoot, 'win32');

    expect(command).toEqual({
      command: path.join(packageRoot, 'node_modules', '.bin', 'mg-service.cmd'),
      args: ['build'],
      spawnOptions: { shell: true },
    });
  });

  test('uses the local executable directly on non-Windows platforms', () => {
    const packageRoot = path.join('/repo', 'mini-pack');

    const command = createVivoCliCommand(packageRoot, 'darwin');

    expect(command).toEqual({
      command: path.join(packageRoot, 'node_modules', '.bin', 'mg-service'),
      args: ['build'],
      spawnOptions: {},
    });
  });
});
