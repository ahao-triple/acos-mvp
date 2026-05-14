import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { copyOppoReleaseSigningFiles } from '../../src/platforms/oppo/index.js';
import { buildOppoRpk, createOppoCliCommand } from '../../src/platforms/oppo/rpk.js';
import type { LoadedGameConfig } from '../../src/shared/types.js';

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

afterEach(() => {
  spawnMock.mockReset();
});

describe('createOppoCliCommand', () => {
  test('uses shell only for the PATH quickgame command on Windows', () => {
    const packageRoot = path.win32.join('C:\\', 'Users', 'Jane Doe', 'repo', 'mini-pack');
    const command = createOppoCliCommand(packageRoot, 'win32');

    expect(command.command).toBe('quickgame');
    expect(command.args).toEqual(['pack', 'release']);
    expect(command.spawnOptions.shell).toBe(true);
    expect(
      command.spawnOptions.env?.PATH?.startsWith(`${path.join(packageRoot, 'node_modules/.bin')}${path.delimiter}`),
    ).toBe(true);
  });

  test('uses the PATH quickgame executable directly on non-Windows platforms', () => {
    const packageRoot = path.join('/repo', 'mini-pack');
    const command = createOppoCliCommand(packageRoot, 'darwin');

    expect(command.command).toBe('quickgame');
    expect(command.args).toEqual(['pack', 'release']);
    expect(command.spawnOptions.shell).toBe(false);
    expect(command.spawnOptions.env?.PATH?.split(path.delimiter)[0]).toBe(path.join(packageRoot, 'node_modules/.bin'));
  });
});

describe('buildOppoRpk', () => {
  test('includes CLI stdout and stderr when build exits successfully without an RPK', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-oppo-rpk-'));
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    spawnMock.mockReturnValue(child);

    const buildPromise = buildOppoRpk(projectDir, createLoaded());
    await vi.waitFor(() => {
      expect(spawnMock).toHaveBeenCalled();
    });

    child.stdout.write('manifest.icon was undefined\n');
    child.stdout.end();
    child.stderr.write('TypeError: Cannot read properties of undefined\n');
    child.stderr.end();
    child.emit('close', 0);

    await expect(buildPromise).rejects.toThrow(
      /Oppo CLI completed but no \.rpk file was found\.[\s\S]*stdout:[\s\S]*manifest\.icon was undefined[\s\S]*stderr:[\s\S]*TypeError/,
    );
  });

  test('returns generated RPK files when the CLI exits non-zero after packaging', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-oppo-rpk-'));
    const rpkFile = path.join(projectDir, 'dist', 'com.example.app.rpk');
    await fs.mkdir(path.dirname(rpkFile), { recursive: true });
    await fs.writeFile(rpkFile, 'rpk\n');
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    spawnMock.mockReturnValue(child);

    const buildPromise = buildOppoRpk(projectDir, createLoaded());
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

  test('writes a fake rpk named by materials.packageName when MINI_PACK_OPPO_FAKE_RPK=1', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-oppo-fake-'));

    const previous = process.env.MINI_PACK_OPPO_FAKE_RPK;
    process.env.MINI_PACK_OPPO_FAKE_RPK = '1';
    try {
      const result = await buildOppoRpk(projectDir, createLoaded());
      expect(result.rpkFiles).toHaveLength(1);
      expect(result.rpkFiles[0].endsWith('com.example.app.rpk')).toBe(true);
      const exists = await fs
        .stat(result.rpkFiles[0])
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.MINI_PACK_OPPO_FAKE_RPK;
      else process.env.MINI_PACK_OPPO_FAKE_RPK = previous;
      await fs.rm(projectDir, { recursive: true, force: true });
    }
  });

  test('throws a clear message when the OPPO CLI cannot be started', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-oppo-missing-cli-'));
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    spawnMock.mockReturnValue(child);

    const buildPromise = buildOppoRpk(projectDir, createLoaded());
    await vi.waitFor(() => {
      expect(spawnMock).toHaveBeenCalled();
    });

    child.emit('error', new Error('spawn quickgame ENOENT'));

    await expect(buildPromise).rejects.toThrow(
      "OPPO CLI 'quickgame' not found. Install @oppo-minigame/cli or set MINI_PACK_OPPO_FAKE_RPK=1 for test builds.",
    );
    await fs.rm(projectDir, { recursive: true, force: true });
  });
});

describe('copyOppoReleaseSigningFiles', () => {
  test('copies configured release PEM files into the generated oppo project sign/release directory', async () => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mini-pack-oppo-sign-'));
    const sourceDir = path.join(projectRoot, 'oppo-pem');
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, 'private.pem'), 'private-key\n');
    await fs.writeFile(path.join(sourceDir, 'certificate.pem'), 'certificate\n');

    const loaded = createLoaded(projectRoot);
    loaded.oppoMaterials!.releaseSignDir = 'oppo-pem';
    (loaded.materials as { releaseSignDir?: string }).releaseSignDir = 'oppo-pem';

    await copyOppoReleaseSigningFiles(loaded);

    await expect(fs.readFile(path.join(loaded.paths.outDirAbs, 'sign/release/private.pem'), 'utf8')).resolves.toBe(
      'private-key\n',
    );
    await expect(fs.readFile(path.join(loaded.paths.outDirAbs, 'sign/release/certificate.pem'), 'utf8')).resolves.toBe(
      'certificate\n',
    );

    await fs.rm(projectRoot, { recursive: true, force: true });
  });
});

function createLoaded(projectRoot = path.join(os.tmpdir(), 'gonglian-fangxian')): LoadedGameConfig {
  return {
    game: {
      title: '全民爆梗游戏软件',
      entry: 'game/src/main.ts',
      publicDir: 'game/public',
      orientation: 'portrait',
      canvas: { width: 720, height: 1280 },
    },
    platform: 'oppo',
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
      channelRoot: path.join(projectRoot, 'channels/oppo'),
      materialsAbs: path.join(projectRoot, 'channels/oppo/materials.ts'),
      iconAbs: path.join(projectRoot, 'channels/oppo/icon.png'),
      outDirAbs: path.join(projectRoot, 'channels/oppo/build'),
    },
    oppoMaterials: {
      packageName: 'com.example.app',
      iconPath: 'icon.png',
      versionName: '1.0.0',
      versionCode: 1,
    },
  };
}
