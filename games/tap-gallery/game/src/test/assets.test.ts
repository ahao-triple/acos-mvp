import { describe, expect, it } from 'vitest';

import { parseAssetManifest, parseLevelConfig, resolveAssetUrl } from '../assets/loader';

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
});
