import { describe, expect, it } from 'vitest';
import {
  createGameJson,
  createProjectConfigJson,
  renderDouyinGameJs,
} from '../../src/platforms/douyin/template.js';
import type { LoadedGameConfig } from '../../src/shared/types.js';

function makeLoaded(): LoadedGameConfig {
  return {
    game: {
      title: '全民爆梗游戏软件',
      entry: 'game/src/main.ts',
      publicDir: 'game/public-pack',
      orientation: 'portrait',
      canvas: { width: 750, height: 1334 },
    },
    platform: 'douyin',
    materials: {
      appid: 'tt-real-appid',
      projectName: 'gonglian-fangxian',
      rewardedAdUnitId: 'tt-rwd-001',
      iconPath: 'icon.png',
    },
    projectRoot: '/tmp/x',
    paths: {
      configFileAbs: '/tmp/x/game.config.ts',
      entryAbs: '/tmp/x/game/src/main.ts',
      publicDirAbs: '/tmp/x/game/public-pack',
      channelRoot: '/tmp/x/channels/douyin',
      materialsAbs: '/tmp/x/channels/douyin/materials.ts',
      iconAbs: '/tmp/x/channels/douyin/icon.png',
      outDirAbs: '/tmp/x/channels/douyin/build',
    },
    douyinMaterials: {
      appid: 'tt-real-appid',
      projectName: 'gonglian-fangxian',
      rewardedAdUnitId: 'tt-rwd-001',
      iconPath: 'icon.png',
    },
  };
}

describe('createGameJson', () => {
  it('uses game.orientation', () => {
    const json = createGameJson(makeLoaded());
    expect(json.deviceOrientation).toBe('portrait');
    expect(json.showStatusBar).toBe(false);
  });
});

describe('createProjectConfigJson', () => {
  it('uses materials.appid and materials.projectName', () => {
    const json = createProjectConfigJson(makeLoaded());
    expect(json.appid).toBe('tt-real-appid');
    expect(json.projectname).toBe('gonglian-fangxian');
  });
});

describe('renderDouyinGameJs', () => {
  it('embeds materials.rewardedAdUnitId via JSON.stringify', () => {
    const js = renderDouyinGameJs(
      'var __MiniPackGameBundle = { createGame: () => ({ start(){} }) };',
      makeLoaded(),
    );
    expect(js).toContain('var rewardedAdUnitId = "tt-rwd-001";');
  });

  it('embeds empty string when materials.rewardedAdUnitId missing', () => {
    const loaded = makeLoaded();
    delete (loaded.douyinMaterials as { rewardedAdUnitId?: string }).rewardedAdUnitId;
    delete (loaded.materials as { rewardedAdUnitId?: string }).rewardedAdUnitId;
    const js = renderDouyinGameJs(
      'var __MiniPackGameBundle = { createGame: () => ({ start(){} }) };',
      loaded,
    );
    expect(js).toContain('var rewardedAdUnitId = "";');
  });
});
