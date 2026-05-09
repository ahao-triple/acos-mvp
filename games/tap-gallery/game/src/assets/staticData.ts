import manifestJson from '../../public-pack/asset-manifest.json';
import levelsJson from '../../public-pack/level-configs/levels.json';

import { parseAssetManifest, parseLevelConfig } from './loader';
import type { AssetManifest, LevelConfig } from './types';

export function bundledManifest(): AssetManifest {
  return parseAssetManifest(manifestJson);
}

export function bundledLevels(): LevelConfig[] {
  if (!Array.isArray(levelsJson)) {
    throw new Error('Bundled levels index must be an array.');
  }
  return levelsJson.map(parseLevelConfig).sort((a, b) => a.levelNo - b.levelNo);
}
