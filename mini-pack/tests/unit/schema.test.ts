import { describe, expect, it } from 'vitest';
import {
  oppoMaterialsSchema,
  gameConfigSchema,
  vivoMaterialsSchema,
  defineGameConfig,
  defineOppoMaterials,
  defineVivoMaterials,
} from '../../src/core/schema.js';

describe('gameConfigSchema', () => {
  it('accepts a minimal game config without platform/outDir', () => {
    const result = gameConfigSchema.safeParse({
      title: '就你眼神好',
      entry: 'game/src/main.ts',
      publicDir: 'game/public-pack',
      orientation: 'portrait',
      canvas: { width: 750, height: 1334 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects extra keys (strict)', () => {
    const result = gameConfigSchema.safeParse({
      title: 't',
      entry: 'e',
      publicDir: 'p',
      orientation: 'portrait',
      canvas: { width: 1, height: 1 },
      platform: 'unexpected',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = gameConfigSchema.safeParse({
      title: '',
      entry: 'e',
      publicDir: 'p',
      orientation: 'portrait',
      canvas: { width: 1, height: 1 },
    });
    expect(result.success).toBe(false);
  });
});


describe('vivoMaterialsSchema', () => {
  it('accepts valid vivo materials and applies defaults', () => {
    const result = vivoMaterialsSchema.safeParse({
      packageName: 'com.example.app',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.iconPath).toBe('icon.png');
      expect(result.data.versionName).toBe('1.0.0');
      expect(result.data.versionCode).toBe(1);
    }
  });

  it('accepts optional rewardedAdUnitId for vivo ad placement configuration', () => {
    const result = vivoMaterialsSchema.safeParse({
      packageName: 'com.example.app',
      rewardedAdUnitId: 'vivo-rwd-001',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rewardedAdUnitId).toBe('vivo-rwd-001');
    }
  });

  it('accepts optional vivo release signing directory and homePage asset', () => {
    const result = vivoMaterialsSchema.safeParse({
      packageName: 'com.example.app',
      releaseSignDir: '../../vivo-pem',
      homePage: '/icon.png',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.releaseSignDir).toBe('../../vivo-pem');
      expect(result.data.homePage).toBe('/icon.png');
    }
  });

  it('rejects packageName missing dot', () => {
    const result = vivoMaterialsSchema.safeParse({ packageName: 'singletoken' });
    expect(result.success).toBe(false);
  });

  it('rejects packageName starting with digit', () => {
    const result = vivoMaterialsSchema.safeParse({ packageName: '1com.example.app' });
    expect(result.success).toBe(false);
  });

  it('rejects packageName with hyphen', () => {
    const result = vivoMaterialsSchema.safeParse({ packageName: 'com.example-app.x' });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive versionCode', () => {
    const result = vivoMaterialsSchema.safeParse({ packageName: 'com.x.y', versionCode: 0 });
    expect(result.success).toBe(false);
  });
});

describe('oppoMaterialsSchema', () => {
  it('accepts valid oppo materials and applies defaults', () => {
    const result = oppoMaterialsSchema.safeParse({
      packageName: 'com.example.oppo',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.iconPath).toBe('icon.png');
      expect(result.data.versionName).toBe('1.0.0');
      expect(result.data.versionCode).toBe(1);
    }
  });

  it('accepts the same optional fields as vivo materials', () => {
    const result = oppoMaterialsSchema.safeParse({
      packageName: 'com.example.oppo',
      rewardedAdUnitId: 'oppo-rwd-001',
      releaseSignDir: '../../oppo-pem',
      homePage: '/logo.png',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rewardedAdUnitId).toBe('oppo-rwd-001');
      expect(result.data.releaseSignDir).toBe('../../oppo-pem');
      expect(result.data.homePage).toBe('/logo.png');
    }
  });

  it('rejects invalid oppo package names', () => {
    const result = oppoMaterialsSchema.safeParse({ packageName: 'bad-name' });
    expect(result.success).toBe(false);
  });
});

describe('define*', () => {
  it('defineGameConfig returns its input', () => {
    const config = {
      title: 't',
      entry: 'e',
      publicDir: 'p',
      orientation: 'portrait' as const,
      canvas: { width: 1, height: 1 },
    };
    expect(defineGameConfig(config)).toBe(config);
  });

  it('defineVivoMaterials returns its input', () => {
    const m = { packageName: 'com.x.y', iconPath: 'icon.png', versionName: '1.0.0', versionCode: 1 };
    expect(defineVivoMaterials(m)).toBe(m);
  });

  it('defineOppoMaterials returns its input', () => {
    const m = { packageName: 'com.x.y', iconPath: 'icon.png', versionName: '1.0.0', versionCode: 1 };
    expect(defineOppoMaterials(m)).toBe(m);
  });
});
