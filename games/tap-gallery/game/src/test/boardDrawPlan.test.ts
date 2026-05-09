import { describe, expect, it } from 'vitest';

import { boardDrawOrder } from '../render/boardDrawPlan';

describe('board draw plan', () => {
  it('draws hint overlays after every active cell so neighboring cells cannot cover them', () => {
    const order = boardDrawOrder([
      { index: 1, cleared: false },
      { index: 2, cleared: false },
      { index: 3, cleared: false },
    ], {
      weakHint: { active: false, index: null },
      guidance: { type: 'firstTap', index: 1, label: 'Tap' },
    });

    expect(order.map((item) => item.layer)).toEqual(['cell', 'cell', 'cell', 'hint']);
    expect(order.at(-1)).toMatchObject({ layer: 'hint', index: 1, kind: 'guidance' });
  });

  it('keeps cleared feedback cells drawable for fly-out animation but does not draw hints on cleared cells', () => {
    const order = boardDrawOrder([
      { index: 1, cleared: true },
      { index: 2, cleared: false },
    ], {
      feedbackIndexes: [1],
      weakHint: { active: true, index: 1 },
      guidance: null,
    });

    expect(order).toEqual([
      { layer: 'cell', index: 1 },
      { layer: 'cell', index: 2 },
    ]);
  });
});
