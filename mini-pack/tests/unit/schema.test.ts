import { describe, expect, it } from 'vitest';
import {
  gameConfigSchema,
  douyinMaterialsSchema,
  vivoMaterialsSchema,
  defineGameConfig,
  defineDouyinMaterials,
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
      douyin: { appid: '' },
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

describe('douyinMaterialsSchema', () => {
  it('accepts valid douyin materials with default iconPath', () => {
    const result = douyinMaterialsSchema.safeParse({
      appid: 'tt12345',
      projectName: 'difference-hunt',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.iconPath).toBe('icon.png');
  });

  it('allows empty appid (preflight strictness, not schema)', () => {
    const result = douyinMaterialsSchema.safeParse({
      appid: '',
      projectName: 'difference-hunt',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty projectName', () => {
    const result = douyinMaterialsSchema.safeParse({
      appid: 'tt12345',
      projectName: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra keys', () => {
    const result = douyinMaterialsSchema.safeParse({
      appid: 'tt12345',
      projectName: 'difference-hunt',
      packageName: 'com.x.y',
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

  it('defineDouyinMaterials returns its input', () => {
    const m = { appid: 'a', projectName: 'p', iconPath: 'icon.png' };
    expect(defineDouyinMaterials(m)).toBe(m);
  });

  it('defineVivoMaterials returns its input', () => {
    const m = { packageName: 'com.x.y', iconPath: 'icon.png', versionName: '1.0.0', versionCode: 1 };
    expect(defineVivoMaterials(m)).toBe(m);
  });
});
