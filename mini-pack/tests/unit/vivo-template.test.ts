import { describe, expect, it } from 'vitest';
import { createVivoManifest } from '../../src/platforms/vivo/template.js';
import type { LoadedGameConfig } from '../../src/shared/types.js';

function makeLoaded(): LoadedGameConfig {
  return {
    game: {
      title: '就你眼神好',
      entry: 'game/src/main.ts',
      publicDir: 'game/public-pack',
      orientation: 'portrait',
      canvas: { width: 750, height: 1334 },
    },
    platform: 'vivo',
    materials: {
      packageName: 'com.example.app',
      iconPath: 'icon.png',
      versionName: '2.5.0',
      versionCode: 7,
    },
    projectRoot: '/tmp/x',
    paths: {
      configFileAbs: '/tmp/x/game.config.ts',
      entryAbs: '/tmp/x/game/src/main.ts',
      publicDirAbs: '/tmp/x/game/public-pack',
      channelRoot: '/tmp/x/channels/vivo',
      materialsAbs: '/tmp/x/channels/vivo/materials.ts',
      iconAbs: '/tmp/x/channels/vivo/icon.png',
      outDirAbs: '/tmp/x/channels/vivo/build',
    },
    vivoMaterials: {
      packageName: 'com.example.app',
      iconPath: 'icon.png',
      versionName: '2.5.0',
      versionCode: 7,
    },
  };
}

describe('createVivoManifest', () => {
  it('uses materials.packageName / versionName / versionCode and game.title / orientation', () => {
    const manifest = createVivoManifest(makeLoaded());
    expect(manifest.package).toBe('com.example.app');
    expect(manifest.name).toBe('就你眼神好');
    expect(manifest.versionName).toBe('2.5.0');
    expect(manifest.versionCode).toBe(7);
    expect(manifest.deviceOrientation).toBe('portrait');
    expect(manifest.icon).toBe('/icon.png');
    expect(manifest.type).toBe('game');
    expect(manifest.minPlatformVersion).toBe(1060);
  });
});
