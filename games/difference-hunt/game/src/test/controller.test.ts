import { describe, expect, test } from 'vitest';

import { GameController } from '../app/controller';
import { differenceHuntLevels } from '../assets/levels';
import type { PlatformAdapter, RewardedAdReason } from '../platform/types';

describe('GameController', () => {
  test('marks a target found when either matching image half is tapped', () => {
    const controller = new GameController({ levels: differenceHuntLevels, save: { ...defaultTestSave(), currentLevel: 1 } });
    controller.startLevel(1);
    const result = controller.tap({ x: 535, y: 724 });

    expect(result.type).toBe('found');
    expect(controller.getViewState().foundIds).toEqual(['picture01_01']);
    expect(controller.getViewState().remaining).toBe(9);
  });

  test('advances to the next level after all targets are found', () => {
    const controller = new GameController({ levels: differenceHuntLevels, save: { ...defaultTestSave(), currentLevel: 1 } });
    controller.startLevel(1);
    for (const target of differenceHuntLevels[0].targets) {
      controller.tap({
        x: 375 + target.cocos.x,
        y: 667 - target.cocos.y,
      });
    }

    expect(controller.getViewState().screen).toBe('win');
    expect(controller.nextLevel().level.levelNo).toBe(2);
    expect(controller.getViewState().foundIds).toEqual([]);
  });

  test('starts on home and enters the saved level through the start action', () => {
    const controller = new GameController({ levels: differenceHuntLevels, save: { ...defaultTestSave(), currentLevel: 3, highestUnlockedLevel: 3 } });

    expect(controller.getViewState().screen).toBe('home');
    expect(controller.startGame().level.levelNo).toBe(3);
    expect(controller.getViewState().screen).toBe('playing');
  });

  test('rewarded hint grants one hint and reveals the next missing target', async () => {
    const platform = createPlatformStub();
    const controller = new GameController({ levels: differenceHuntLevels, save: defaultTestSave(), platform });
    controller.startLevel(1);

    await controller.claimAdHint();

    expect(platform.adReasons).toEqual(['hint']);
    expect(controller.getViewState().save.hints).toBe(1);
    expect(controller.getViewState().hintTargetId).toBe('picture01_01');
    expect(controller.getViewState().feedback.message).toContain('提示');
  });

  test('rewarded add-time extends an active countdown', async () => {
    const platform = createPlatformStub();
    const controller = new GameController({
      levels: differenceHuntLevels,
      save: defaultTestSave(),
      platform,
      now: () => 10_000,
    });
    controller.startLevel(1);

    await controller.claimAdTimeBonus();

    expect(platform.adReasons).toEqual(['add_time']);
    expect(controller.getViewState().timer.remainingMs).toBe(150_000);
  });

  test('rewarded add-time resumes a failed countdown', async () => {
    const platform = createPlatformStub();
    let now = 10_000;
    const controller = new GameController({
      levels: differenceHuntLevels,
      save: defaultTestSave(),
      platform,
      now: () => now,
    });
    controller.startLevel(1);
    now = 131_000;
    controller.tick();

    await controller.claimAdTimeBonus();

    expect(platform.adReasons).toEqual(['add_time']);
    expect(controller.getViewState().screen).toBe('playing');
    expect(controller.getViewState().timer.remainingMs).toBe(30_000);
  });

  test('rewarded unlock opens a locked level without starting it immediately', async () => {
    const platform = createPlatformStub();
    const controller = new GameController({ levels: differenceHuntLevels, save: defaultTestSave(), platform });

    await controller.unlockLevelWithAd(4);

    expect(platform.adReasons).toEqual(['unlock_level']);
    expect(controller.getViewState().save.highestUnlockedLevel).toBe(4);
    expect(controller.getViewState().screen).toBe('levels');
  });

  test('rewarded double reward can only be claimed once after a win', async () => {
    const platform = createPlatformStub();
    const controller = new GameController({ levels: differenceHuntLevels, save: defaultTestSave(), platform });
    controller.startLevel(1);
    for (const target of differenceHuntLevels[0].targets) {
      controller.tap({ x: 375 + target.cocos.x, y: 667 - target.cocos.y });
    }

    await controller.claimDoubleReward();
    await controller.claimDoubleReward();

    expect(platform.adReasons).toEqual(['double_reward']);
    expect(controller.getViewState().save.coins).toBe(60);
    expect(controller.getViewState().reward.doubleClaimed).toBe(true);
  });

  test('sequential wins unlock every configured level without opening all levels by default', () => {
    const controller = new GameController({ levels: differenceHuntLevels, save: defaultTestSave() });

    for (let levelNo = 1; levelNo <= 6; levelNo += 1) {
      controller.startLevel(levelNo);
      for (const target of differenceHuntLevels[levelNo - 1].targets) {
        controller.tap({ x: 375 + target.cocos.x, y: 667 - target.cocos.y });
      }
      expect(controller.getViewState().save.highestUnlockedLevel).toBe(levelNo + 1);
    }

    expect(controller.getViewState().levels).toHaveLength(7);
    expect(controller.startLevel(7).screen).toBe('playing');
  });
});

function defaultTestSave() {
  return {
    highestUnlockedLevel: 1,
    completedLevels: [],
    currentLevel: 1,
    hints: 0,
    coins: 0,
    settings: {
      soundEnabled: true,
    },
    lastDailyRewardDay: '',
  };
}

function createPlatformStub(): PlatformAdapter & { adReasons: RewardedAdReason[] } {
  const adReasons: RewardedAdReason[] = [];
  return {
    name: 'test',
    adReasons,
    storage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    triggerHaptic() {},
    async playSfx() {},
    async showRewardedAd(reason) {
      adReasons.push(reason);
      return { status: 'success' };
    },
  };
}
