import { describe, expect, test } from 'vitest';

import { differenceHuntLevels } from '../assets/levels';
import { hitZonesForTarget, imageFrameForLevel } from '../core/geometry';

describe('difference hunt level data', () => {
  test('contains all seven Cocos findGame levels with ten targets each', () => {
    expect(differenceHuntLevels).toHaveLength(7);
    expect(differenceHuntLevels.map((level) => level.levelNo)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(differenceHuntLevels.every((level) => level.targets.length === 10)).toBe(true);
  });

  test('points every level image to a copied public-pack resource', async () => {
    const { access } = await import('node:fs/promises');
    const root = `${process.cwd()}/public-pack`;

    for (const level of differenceHuntLevels) {
      await expect(access(`${root}/${level.background}`)).resolves.toBeUndefined();
      for (const target of level.targets) {
        await expect(access(`${root}/${target.image}`)).resolves.toBeUndefined();
      }
    }
  });

  test('converts Cocos coordinates into paired top and bottom hit zones', () => {
    const level = differenceHuntLevels[0];
    const target = level.targets[0];
    const zones = hitZonesForTarget(level, target);

    expect(imageFrameForLevel(level)).toEqual({
      x: 16,
      y: 241.818,
      width: 718,
      height: 850.363,
    });
    expect(zones).toHaveLength(2);
    expect(zones[0]).toMatchObject({
      x: 490.489,
      y: 685.114,
      width: 73.324,
      height: 69.515,
    });
    expect(zones[1]).toMatchObject({
      x: 490.489,
      y: 259.933,
      width: 73.324,
      height: 69.515,
    });
  });

  test('keeps the playable image frame inside the portrait design canvas', () => {
    for (const level of differenceHuntLevels) {
      const frame = imageFrameForLevel(level);

      expect(frame.x).toBeGreaterThanOrEqual(16);
      expect(frame.x + frame.width).toBeLessThanOrEqual(734);
    }
  });
});
