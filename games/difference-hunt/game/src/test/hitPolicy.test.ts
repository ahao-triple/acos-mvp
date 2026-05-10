import { describe, expect, test } from 'vitest';

import { shouldHandleHit } from '../render/hitPolicy';

describe('renderer hit policy', () => {
  test('blocks covered game taps while the win overlay is open', () => {
    expect(shouldHandleHit('win', null)).toBe(false);
    expect(shouldHandleHit('win', 'target')).toBe(false);
    expect(shouldHandleHit('win', 'continue')).toBe(true);
    expect(shouldHandleHit('win', 'doubleReward')).toBe(true);
  });

  test('blocks covered game taps while the failed overlay is open', () => {
    expect(shouldHandleHit('failed', null)).toBe(false);
    expect(shouldHandleHit('failed', 'target')).toBe(false);
    expect(shouldHandleHit('failed', 'retry')).toBe(true);
    expect(shouldHandleHit('failed', 'adTime')).toBe(true);
  });

  test('allows normal play taps outside modal overlays', () => {
    expect(shouldHandleHit('playing', null)).toBe(true);
    expect(shouldHandleHit('playing', 'target')).toBe(true);
    expect(shouldHandleHit('home', null)).toBe(true);
  });
});
