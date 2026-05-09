import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { createVivoCliCommand } from '../../src/platforms/vivo/rpk.js';

describe('createVivoCliCommand', () => {
  test('uses node to execute the JS entry on Windows when the package path contains spaces', () => {
    const packageRoot = path.win32.join('C:\\', 'Users', 'Jane Doe', 'repo', 'mini-pack');
    const jsEntry = path.win32.join(
      packageRoot,
      'node_modules',
      '@vivo-minigame',
      'cli-service',
      'bin',
      'cli-service.js',
    );

    const command = createVivoCliCommand(packageRoot, jsEntry);

    expect(command).toEqual({
      command: process.execPath,
      args: [jsEntry, 'build'],
      spawnOptions: {},
    });
  });

  test('uses node to execute the JS entry on non-Windows platforms', () => {
    const packageRoot = path.join('/repo', 'mini-pack');
    const jsEntry = path.join(packageRoot, 'node_modules', '@vivo-minigame', 'cli-service', 'bin', 'cli-service.js');

    const command = createVivoCliCommand(packageRoot, jsEntry);

    expect(command).toEqual({
      command: process.execPath,
      args: [jsEntry, 'build'],
      spawnOptions: {},
    });
  });
});
