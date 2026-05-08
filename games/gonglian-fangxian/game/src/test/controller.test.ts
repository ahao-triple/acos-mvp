import { describe, expect, test, vi } from 'vitest';
import { GameController } from '../app/controller';
import type { PlatformAdapter } from '../platform/types';

describe('game controller visual cues', () => {
  test('emits select audio cue when a cell is selected', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'tapCell', position: { row: 0, col: 0 } });

    expect(controller.getViewState().audioCue).toMatchObject({ type: 'select' });
  });

  test('emits swapRejected cue for non-adjacent cell selection', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'tapCell', position: { row: 0, col: 0 } });
    await controller.dispatch({ type: 'tapCell', position: { row: 1, col: 1 } });

    expect(controller.getViewState().visualCue).toMatchObject({
      type: 'swapRejected',
      from: { row: 0, col: 0 },
      to: { row: 1, col: 1 },
    });
    expect(controller.getViewState().audioCue).toMatchObject({ type: 'invalid' });
  });

  test('emits button audio cue for normal command buttons', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'openSettings' });

    expect(controller.getViewState().audioCue).toMatchObject({ type: 'button' });
  });

  test('emits reward audio cue when a platform reward is granted', async () => {
    const controller = new GameController(mockPlatform({ desktop: { status: 'success' } }));

    await controller.dispatch({ type: 'desktopReward' });

    expect(controller.getViewState().audioCue).toMatchObject({ type: 'reward' });
  });

  test('in-game ad power-up activates after completed rewarded video', async () => {
    const controller = new GameController(mockPlatform({ ad: { status: 'success' } }));

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'usePowerUp', item: 'bomb' });

    expect(controller.getViewState().activePowerUp).toBe('bomb');
    expect(controller.getViewState().feedback).toContain('广告');
    expect(controller.getViewState().audioCue).toMatchObject({ type: 'reward' });
  });

  test('logs in-game rewarded power-up flow for device debugging', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const controller = new GameController(mockPlatform({ ad: { status: 'success' } }));

    try {
      await controller.dispatch({ type: 'start' });
      await controller.dispatch({ type: 'usePowerUp', item: 'bomb' });

      const events = info.mock.calls.map((call) => call[1]);
      expect(events).toEqual(expect.arrayContaining(['power_up_ad_request', 'power_up_activate']));
      expect(info).toHaveBeenCalledWith('[GLFX]', 'power_up_ad_request', expect.objectContaining({ item: 'bomb', available: 0 }));
      expect(info).toHaveBeenCalledWith('[GLFX]', 'power_up_activate', expect.objectContaining({ item: 'bomb', fromAd: true }));
    } finally {
      info.mockRestore();
    }
  });

  test('pause menu can return to the home screen', async () => {
    const controller = new GameController(mockPlatform());

    await controller.dispatch({ type: 'start' });
    await controller.dispatch({ type: 'pause' });
    await controller.dispatch({ type: 'home' });

    expect(controller.getViewState().screen).toBe('menu');
    expect(controller.getViewState().session).toBeNull();
  });
});

function mockPlatform(
  options: {
    ad?: { status: 'success' | 'failed' | 'cancelled' | 'unsupported' };
    desktop?: { status: 'success' | 'failed' | 'cancelled' | 'unsupported' };
  } = {},
): PlatformAdapter {
  return {
    name: 'test',
    storage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    async showRewardedAd() {
      return options.ad ?? { status: 'unsupported' };
    },
    async addDesktopShortcut() {
      return options.desktop ?? { status: 'unsupported' };
    },
    async showFavoriteGuide() {
      return { status: 'unsupported' };
    },
    async didEnterFromSidebar() {
      return false;
    },
    async requestSidebarEntry() {
      return { status: 'unsupported' };
    },
    getLaunchContext() {
      return { isSidebarEntry: false };
    },
  };
}
