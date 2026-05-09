import { describe, expect, it } from 'vitest';

import { parseAssetManifest, parseLevelConfig, resolveAssetUrl } from '../assets/loader';
import manifestJson from '../../public-pack/asset-manifest.json';
import levelsJson from '../../public-pack/level-configs/levels.json';

const bundledFiles = new Set(
  Object.keys(import.meta.glob('../../public-pack/**/*', { eager: true, query: '?url', import: 'default' }))
    .map((path) => path.replace('../../public-pack/', '')),
);

describe('asset loading helpers', () => {
  it('resolves relative asset paths against a base URL', () => {
    expect(resolveAssetUrl('/assets', 'level-configs/levels.json')).toBe('/assets/level-configs/levels.json');
    expect(resolveAssetUrl('assets/', 'assets/levels/reveal/a.png')).toBe('assets/assets/levels/reveal/a.png');
  });

  it('parses a valid manifest', () => {
    const manifest = parseAssetManifest({
      designSize: { width: 750, height: 1334 },
      levelConfigIndex: 'level-configs/levels.json',
      levels: [{ levelNo: 1, id: 'a', title: 'A', subject: 'a', maskImage: 'm', revealImage: 'r', thumbnail: 't', config: 'c' }],
    });

    expect(manifest.levels[0].id).toBe('a');
  });

  it('rejects malformed level cells', () => {
    expect(() => parseLevelConfig({
      id: 'bad',
      levelNo: 1,
      title: 'Bad',
      board: { width: 2, height: 2 },
      cells: [{ index: 1, direction: 9 }],
    })).toThrow(/invalid cell/);
  });

  it('keeps bundled level titles localized for display', () => {
    const levels = (levelsJson as unknown[]).map(parseLevelConfig);

    for (const level of levels) {
      expect(/[\u4e00-\u9fff]/.test(level.title), level.title).toBe(true);
    }
  });

  it('keeps bundled runtime asset references inside public-pack', () => {
    const manifest = parseAssetManifest(manifestJson);
    const levels = (levelsJson as unknown[]).map(parseLevelConfig);
    const referenced = [
      manifest.levelConfigIndex,
      ...manifest.levels.flatMap((level) => [level.config, level.maskImage, level.revealImage, level.thumbnail]),
      ...levels.flatMap((level) => [level.maskImage, level.revealImage, level.thumbnail]),
    ];

    for (const relativePath of referenced) {
      expect(bundledFiles.has(relativePath), relativePath).toBe(true);
    }
  });
});
