import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import {
  createKuaishouGameJson,
  createKuaishouProjectConfigJson,
  renderKuaishouGameJs,
} from '../../src/platforms/kuaishou/template.js';
import type { LoadedGameConfig } from '../../src/shared/types.js';

function makeLoaded(): LoadedGameConfig {
  return {
    game: {
      title: '共联防线软件',
      entry: 'game/src/main.ts',
      publicDir: 'game/public-pack',
      orientation: 'portrait',
      canvas: { width: 750, height: 1334 },
    },
    platform: 'kuaishou',
    materials: {
      appid: 'kwai_game_test_appid',
      projectName: 'gonglian-fangxian',
      rewardedAdUnitId: 'ks-rwd-001',
      iconPath: 'icon.png',
    },
    projectRoot: '/tmp/x',
    paths: {
      configFileAbs: '/tmp/x/game.config.ts',
      entryAbs: '/tmp/x/game/src/main.ts',
      publicDirAbs: '/tmp/x/game/public-pack',
      channelRoot: '/tmp/x/channels/kuaishou',
      materialsAbs: '/tmp/x/channels/kuaishou/materials.ts',
      iconAbs: '/tmp/x/channels/kuaishou/icon.png',
      outDirAbs: '/tmp/x/channels/kuaishou/build',
    },
    kuaishouMaterials: {
      appid: 'kwai_game_test_appid',
      projectName: 'gonglian-fangxian',
      rewardedAdUnitId: 'ks-rwd-001',
      iconPath: 'icon.png',
    },
  };
}

describe('createKuaishouGameJson', () => {
  it('uses game.orientation', () => {
    const json = createKuaishouGameJson(makeLoaded());
    expect(json.deviceOrientation).toBe('portrait');
    expect(json.showStatusBar).toBe(false);
  });
});

describe('createKuaishouProjectConfigJson', () => {
  it('uses materials.appid and materials.projectName', () => {
    const json = createKuaishouProjectConfigJson(makeLoaded());
    expect(json.appid).toBe('kwai_game_test_appid');
    expect(json.projectname).toBe('gonglian-fangxian');
  });
});

describe('renderKuaishouGameJs', () => {
  it('embeds ks runtime APIs and materials.rewardedAdUnitId', () => {
    const js = renderKuaishouGameJs(
      'var __MiniPackGameBundle = { createGame: () => ({ start(){} }) };',
      makeLoaded(),
    );
    expect(js).toContain('var ks = root.ks || {};');
    expect(js).toContain('ks.createCanvas()');
    expect(js).toContain('ks.createRewardedVideoAd({ adUnitId: rewardedAdUnitId })');
    expect(js).toContain('var rewardedAdUnitId = "ks-rwd-001";');
  });

  it('embeds empty string when materials.rewardedAdUnitId missing', () => {
    const loaded = makeLoaded();
    delete (loaded.kuaishouMaterials as { rewardedAdUnitId?: string }).rewardedAdUnitId;
    delete (loaded.materials as { rewardedAdUnitId?: string }).rewardedAdUnitId;
    const js = renderKuaishouGameJs(
      'var __MiniPackGameBundle = { createGame: () => ({ start(){} }) };',
      loaded,
    );
    expect(js).toContain('var rewardedAdUnitId = "";');
  });

  it('requests a desktop shortcut through ks.checkShortcut and ks.addShortcut', async () => {
    const calls: string[] = [];
    const runtime = renderRuntime({
      checkShortcut(options: { success(result: { installed: boolean }): void }) {
        calls.push('checkShortcut');
        options.success({ installed: false });
      },
      addShortcut(options: { success(result: { code: number }): void }) {
        calls.push('addShortcut');
        options.success({ code: 1 });
      },
    });

    await expect(runtime.rewards.canAddDesktop()).resolves.toBe(true);
    await expect(runtime.rewards.requestAddDesktop()).resolves.toBe(true);
    expect(calls).toEqual(['checkShortcut', 'addShortcut', 'checkShortcut']);
  });

  it('treats an existing desktop shortcut as completed', async () => {
    const calls: string[] = [];
    const runtime = renderRuntime({
      checkShortcut(options: { success(result: { installed: boolean }): void }) {
        calls.push('checkShortcut');
        options.success({ installed: true });
      },
      addShortcut() {
        calls.push('addShortcut');
      },
    });

    await expect(runtime.rewards.requestAddDesktop()).resolves.toBe(true);
    expect(calls).toEqual(['checkShortcut']);
  });

  it('requests common-use through ks.checkCommonUse and ks.addCommonUse', async () => {
    const calls: string[] = [];
    const runtime = renderRuntime({
      checkCommonUse(options: { success(result: { isCommonUse: boolean }): void }) {
        calls.push('checkCommonUse');
        options.success({ isCommonUse: false });
      },
      addCommonUse(options: { success(result: { code: number }): void }) {
        calls.push('addCommonUse');
        options.success({ code: 1 });
      },
    });

    await expect(runtime.rewards.canAddFavorite()).resolves.toBe(true);
    await expect(runtime.rewards.requestAddFavorite()).resolves.toBe(true);
    expect(calls).toEqual(['checkCommonUse', 'addCommonUse', 'checkCommonUse']);
  });

  it('supports callback-style common-use SDK shims', async () => {
    const runtime = renderRuntime({
      checkCommonUse(success: (result: { isCommonUse: boolean }) => void) {
        success({ isCommonUse: false });
      },
      addCommonUse(success: (result: { code: number }) => void) {
        success({ code: 1 });
      },
    });

    await expect(runtime.rewards.requestAddFavorite()).resolves.toBe(true);
  });
});

interface CapturedRuntime {
  rewards: {
    canAddDesktop(): Promise<boolean>;
    requestAddDesktop(): Promise<boolean>;
    canAddFavorite(): Promise<boolean>;
    requestAddFavorite(): Promise<boolean>;
  };
}

function renderRuntime(ks: Record<string, unknown>): CapturedRuntime {
  const js = renderKuaishouGameJs(
    `var __MiniPackGameBundle = {
      createGame: function (runtime) {
        globalThis.__capturedRuntime = runtime;
        return { start: function () {}, pause: function () {}, resume: function () {}, destroy: function () {} };
      }
    };`,
    makeLoaded(),
  );
  const context = vm.createContext({
    console,
    Promise,
    globalThis: {
      ks: {
        createCanvas() {
          return { getContext() { return null; } };
        },
        ...ks,
      },
    },
  });
  vm.runInContext(js, context);
  return (context.globalThis as { __capturedRuntime: CapturedRuntime }).__capturedRuntime;
}
