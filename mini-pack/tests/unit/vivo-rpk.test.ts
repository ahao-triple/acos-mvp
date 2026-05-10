import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { buildVivoRpk, createVivoCliCommand } from '../../src/platforms/vivo/rpk.js';
import type { LoadedGameConfig } from '../../src/shared/types.js';

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

afterEach(() => {
  spawnMock.mockReset();
});

describe('createVivoCliCommand', () => {
  test('uses shell only for the PATH mgs command on Windows', () => {
    const packageRoot = path.win32.join('C:\\', 'Users', 'Jane Doe', 'repo', 'mini-pack');
    const command = createVivoCliCommand(packageRoot, 'win32');

    expect(command.command).toBe('mgs');
    expect(command.args).toEqual(['build']);
    expect(command.spawnOptions.shell).toBe(true);
    expect(
      command.spawnOptions.env?.PATH?.startsWith(`${path.join(packageRoot, 'node_modules/.bin')}${path.delimiter}`),
    ).toBe(true);
  });

  test('uses the PATH mgs executable directly on non-Windows platforms', () => {
    const packageRoot = path.join('/repo', 'mini-pack');
    const command = createVivoCliCommand(packageRoot, 'darwin');

    expect(command.command).toBe('mgs');
    expect(command.args).toEqual(['build']);
    expect(command.spawnOptions.shell).toBe(false);
    expect(command.spawnOptions.env?.PATH?.split(path.delimiter)[0]).toBe(path.join(packageRoot, 'node_modules/.bin'));
  });
});

describe('buildVivoRpk', () => {
  test('includes CLI stdout and stderr when build exits successfully without an RPK', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-vivo-rpk-'));
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    spawnMock.mockReturnValue(child);

    const buildPromise = buildVivoRpk(projectDir, createLoaded());
    await vi.waitFor(() => {
      expect(spawnMock).toHaveBeenCalled();
    });

    child.stdout.write('manifest.icon was undefined\n');
    child.stdout.end();
    child.stderr.write('TypeError: Cannot read properties of undefined\n');
    child.stderr.end();
    child.emit('close', 0);

    await expect(buildPromise).rejects.toThrow(
      /Vivo CLI completed but no \.rpk file was found\.[\s\S]*stdout:[\s\S]*manifest\.icon was undefined[\s\S]*stderr:[\s\S]*TypeError/,
    );
  });

  test('returns generated RPK files when the CLI exits non-zero after packaging', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-vivo-rpk-'));
    const rpkFile = path.join(projectDir, 'dist', 'com.example.app.rpk');
    await fs.mkdir(path.dirname(rpkFile), { recursive: true });
    await fs.writeFile(rpkFile, 'rpk\n');
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    spawnMock.mockReturnValue(child);

    const buildPromise = buildVivoRpk(projectDir, createLoaded());
    await vi.waitFor(() => {
      expect(spawnMock).toHaveBeenCalled();
    });

    child.stderr.write('FetchError: request to telemetry failed\n');
    child.stderr.end();
    child.stdout.end();
    child.emit('close', 1);

    await expect(buildPromise).resolves.toEqual({
      rpkFiles: [rpkFile],
    });
  });

  test('writes a fake rpk named by materials.packageName when MINI_PACK_VIVO_FAKE_RPK=1', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-vivo-fake-'));

    const previous = process.env.MINI_PACK_VIVO_FAKE_RPK;
    process.env.MINI_PACK_VIVO_FAKE_RPK = '1';
    try {
      const result = await buildVivoRpk(projectDir, createLoaded());
      expect(result.rpkFiles).toHaveLength(1);
      expect(result.rpkFiles[0].endsWith('com.example.app.rpk')).toBe(true);
      const exists = await fs
        .stat(result.rpkFiles[0])
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.MINI_PACK_VIVO_FAKE_RPK;
      else process.env.MINI_PACK_VIVO_FAKE_RPK = previous;
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });
});

function createLoaded(): LoadedGameConfig {
  const projectRoot = path.join(os.tmpdir(), 'gonglian-fangxian');
  return {
    game: {
      title: '共联防线',
      entry: 'game/src/main.ts',
      publicDir: 'game/public',
      orientation: 'portrait',
      canvas: { width: 720, height: 1280 },
    },
    platform: 'vivo',
    materials: {
      packageName: 'com.example.app',
      iconPath: 'icon.png',
      versionName: '1.0.0',
      versionCode: 1,
    },
    projectRoot,
    paths: {
      configFileAbs: path.join(projectRoot, 'game.config.ts'),
      entryAbs: path.join(projectRoot, 'game/src/main.ts'),
      publicDirAbs: path.join(projectRoot, 'game/public'),
      channelRoot: path.join(projectRoot, 'channels/vivo'),
      materialsAbs: path.join(projectRoot, 'channels/vivo/materials.ts'),
      iconAbs: path.join(projectRoot, 'channels/vivo/icon.png'),
      outDirAbs: path.join(projectRoot, 'channels/vivo/build'),
    },
    vivoMaterials: {
      packageName: 'com.example.app',
      iconPath: 'icon.png',
      versionName: '1.0.0',
      versionCode: 1,
    },
  };
}
