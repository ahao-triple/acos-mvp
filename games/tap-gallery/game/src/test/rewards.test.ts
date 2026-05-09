import { describe, expect, it } from 'vitest';

import { rewardForLevel } from '../app/rewards';

describe('level rewards', () => {
  it('grants deterministic coins by level number', () => {
    expect(rewardForLevel(1).coins).toBe(25);
    expect(rewardForLevel(10).coins).toBe(70);
  });

  it('grants occasional tool rewards', () => {
    expect(rewardForLevel(4).tools.hint).toBe(1);
    expect(rewardForLevel(10).tools.bomb).toBe(1);
  });
});
