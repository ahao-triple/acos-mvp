import { describe, expect, test, vi } from 'vitest';
import { createDefaultSave } from '../app/save';
import { claimAdItemReward, claimDesktopReward, claimDoubleCoinsReward, claimFavoriteReward, claimSidebarReward, requestExtraMoves } from '../app/rewards';
import type { PlatformAdapter, PlatformResult } from '../platform/types';
import type { GameSession } from '../core/types';

describe('reward flows', () => {
  test('completed rewarded video grants five extra moves', async () => {
    const session = createSession();
    const outcome = await requestExtraMoves(session, platform({ ad: { status: 'success' } }));

    expect(outcome.granted).toBe(true);
    expect(outcome.session.movesLeft).toBe(5);
    expect(outcome.session.status).toBe('playing');
  });

  test('interrupted rewarded video gives feedback without granting moves', async () => {
    const session = createSession();
    const outcome = await requestExtraMoves(session, platform({ ad: { status: 'cancelled' } }));

    expect(outcome.granted).toBe(false);
    expect(outcome.session.movesLeft).toBe(0);
    expect(outcome.feedback).toContain('未完整观看');
  });

  test('unsupported rewarded video grants fallback moves without blocking flow', async () => {
    const session = createSession();
    const outcome = await requestExtraMoves(session, platform({ ad: { status: 'unsupported' } }));

    expect(outcome.granted).toBe(true);
    expect(outcome.session.movesLeft).toBe(5);
    expect(outcome.feedback).toContain('已直接发放');
  });

  test('completed rewarded video grants selected item reward', async () => {
    const save = createDefaultSave();
    const outcome = await claimAdItemReward(save, 'shuffle', platform({ ad: { status: 'success' } }));

    expect(outcome.granted).toBe(true);
    expect(outcome.save.items.shuffle).toBe(1);
    expect(outcome.feedback).toContain('重排');
  });

  test('cancelled item rewarded video does not grant item', async () => {
    const save = createDefaultSave();
    const outcome = await claimAdItemReward(save, 'bomb', platform({ ad: { status: 'cancelled' } }));

    expect(outcome.granted).toBe(false);
    expect(outcome.save.items.bomb).toBe(0);
    expect(outcome.feedback).toContain('未完整观看');
  });

  test('failed item rewarded video grants fallback item reward', async () => {
    const save = createDefaultSave();
    const outcome = await claimAdItemReward(save, 'bomb', platform({ ad: { status: 'failed' } }));

    expect(outcome.granted).toBe(true);
    expect(outcome.save.items.bomb).toBe(1);
    expect(outcome.feedback).toContain('已直接发放');
  });

  test('completed rewarded video doubles win coins', async () => {
    const save = createDefaultSave();
    save.coins = 100;

    const outcome = await claimDoubleCoinsReward(save, 80, platform({ ad: { status: 'success' } }));

    expect(outcome.granted).toBe(true);
    expect(outcome.save.coins).toBe(180);
    expect(outcome.feedback).toContain('奖励已翻倍');
  });

  test('double coin reward logs debug reason and ad result', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    try {
      await claimDoubleCoinsReward(createDefaultSave(), 80, platform({ ad: { status: 'success' } }));

      expect(infoSpy).toHaveBeenCalledWith(
        '[GLFX]',
        'rewarded_ad_result',
        expect.objectContaining({
          reason: 'double_win_coins',
          coins: 80,
          status: 'success',
        }),
      );
    } finally {
      infoSpy.mockRestore();
    }
  });

  test('cancelled double reward video does not add coins', async () => {
    const save = createDefaultSave();
    save.coins = 100;

    const outcome = await claimDoubleCoinsReward(save, 80, platform({ ad: { status: 'cancelled' } }));

    expect(outcome.granted).toBe(false);
    expect(outcome.save.coins).toBe(100);
    expect(outcome.feedback).toContain('未完整观看');
  });

  test('cancelled double reward video ignores custom message for incomplete feedback', async () => {
    const save = createDefaultSave();
    save.coins = 100;

    const outcome = await claimDoubleCoinsReward(save, 80, platform({ ad: { status: 'cancelled', message: '用户关闭' } }));

    expect(outcome.granted).toBe(false);
    expect(outcome.save.coins).toBe(100);
    expect(outcome.feedback).toContain('未完整观看');
  });

  test('failed double reward video grants fallback coins', async () => {
    const save = createDefaultSave();
    save.coins = 100;

    const outcome = await claimDoubleCoinsReward(save, 80, platform({ ad: { status: 'failed' } }));

    expect(outcome.granted).toBe(true);
    expect(outcome.save.coins).toBe(180);
    expect(outcome.feedback).toContain('已直接发放');
  });

  test('desktop reward is always callable and only grants once', async () => {
    const save = createDefaultSave();
    const first = await claimDesktopReward(save, platform({ desktop: { status: 'success' } }));
    const second = await claimDesktopReward(first.save, platform({ desktop: { status: 'success' } }));

    expect(first.granted).toBe(true);
    expect(first.save.desktopRewardClaimed).toBe(true);
    expect(first.save.coins).toBe(100);
    expect(second.granted).toBe(false);
    expect(second.feedback).toContain('已领取');
  });

  test('unsupported favorite reward gives feedback and no reward', async () => {
    const save = createDefaultSave();
    const outcome = await claimFavoriteReward(save, platform({ favorite: { status: 'unsupported' } }));

    expect(outcome.granted).toBe(false);
    expect(outcome.save.favoriteRewardClaimed).toBe(false);
    expect(outcome.save.items.extraMoves).toBe(0);
    expect(outcome.feedback).toContain('暂不支持添加到常用');
  });

  test('sidebar reward opens sidebar without granting before sidebar return', async () => {
    const save = createDefaultSave();
    const calls: string[] = [];
    const outcome = await claimSidebarReward(
      save,
      platform({
        sidebarEntry: false,
        sidebarRequest: { status: 'success' },
        onSidebarRequest: () => calls.push('request'),
      }),
    );

    expect(outcome.granted).toBe(false);
    expect(outcome.save.sidebarRewardClaimed).toBe(false);
    expect(outcome.save.coins).toBe(0);
    expect(outcome.feedback).toContain('侧边栏');
    expect(outcome.feedback).toContain('返回');
    expect(outcome.feedback).toContain('从侧边栏卡片重新进入《共联防线软件》');
    expect(outcome.feedback).toContain('80金币');
    expect(calls).toEqual(['request']);
  });

  test('sidebar reward grants after sidebar return and only grants once', async () => {
    const save = createDefaultSave();
    const first = await claimSidebarReward(save, platform({ sidebarEntry: true }));
    const second = await claimSidebarReward(first.save, platform({ sidebarEntry: true }));

    expect(first.granted).toBe(true);
    expect(first.save.sidebarRewardClaimed).toBe(true);
    expect(first.save.coins).toBe(80);
    expect(second.granted).toBe(false);
    expect(second.feedback).toContain('已领取');
  });
});

function createSession(): GameSession {
  return {
    levelId: 1,
    board: [],
    movesLeft: 0,
    targetProgress: {},
    targets: [],
    selectedCell: null,
    comboCount: 0,
    status: 'lost',
    lastEvents: [],
    piecePool: ['shield', 'ammo', 'radar', 'medal', 'wrench'],
  };
}

function platform(options: {
  ad?: PlatformResult;
  desktop?: PlatformResult;
  favorite?: PlatformResult;
  sidebarEntry?: boolean;
  sidebarRequest?: PlatformResult;
  onSidebarRequest?: () => void;
}): PlatformAdapter {
  return {
    name: 'test',
    async login() {
      return { platform: 'test', code: 'test-code' };
    },
    async request() {
      return { status: 200, data: null };
    },
    async showRewardedAd() {
      return options.ad ?? { status: 'unsupported' };
    },
    async addDesktopShortcut() {
      return options.desktop ?? { status: 'unsupported' };
    },
    async showFavoriteGuide() {
      return options.favorite ?? { status: 'unsupported' };
    },
    async didEnterFromSidebar() {
      return options.sidebarEntry ?? false;
    },
    async requestSidebarEntry() {
      options.onSidebarRequest?.();
      return options.sidebarRequest ?? { status: 'unsupported' };
    },
    getLaunchContext() {
      return { isSidebarEntry: options.sidebarEntry ?? false };
    },
    triggerHaptic() {},
    storage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
  };
}
