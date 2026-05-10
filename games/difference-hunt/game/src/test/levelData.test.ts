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
      x: -2,
      y: 220.5,
      width: 754,
      height: 893,
    });
    expect(zones).toHaveLength(2);
    expect(zones[0]).toMatchObject({
      x: 496.28,
      y: 686.023,
      width: 77,
      height: 73,
    });
    expect(zones[1]).toMatchObject({
      x: 496.28,
      y: 239.523,
      width: 77,
      height: 73,
    });
  });

  test('keeps the same slight horizontal bleed as the Cocos source levels', () => {
    for (const level of differenceHuntLevels) {
      const frame = imageFrameForLevel(level);

      expect(frame.x).toBe(-2);
      expect(frame.x + frame.width).toBe(752);
    }
  });
});
