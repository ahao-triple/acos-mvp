import { describe, expect, it } from 'vitest';

import { zhText } from '../i18n/zh';
import { cellPresentation } from '../render/cellPresentation';
import { createBoard } from '../core/board';
import type { LevelConfig } from '../assets/types';

function level(cells: LevelConfig['cells']): LevelConfig {
  return {
    id: 'zh-level',
    levelNo: 1,
    title: '中文关卡',
    subject: 'test',
    maskImage: 'mask.png',
    revealImage: 'reveal.png',
    thumbnail: 'thumb.png',
    board: { width: 2, height: 2, allowPan: false, allowZoom: false, initialZoom: 1 },
    moves: 10,
    cellsTarget: cells.length,
    mechanics: [],
    idleHintDelayMs: 5000,
    guidance: { introCue: 'none', weakHintEnabled: true, revealFocus: true },
    cells,
    artStatus: 'test',
  };
}

describe('Chinese localization', () => {
  it('provides Chinese labels for visible game chrome', () => {
    expect(zhText.title).toBe('点点画廊');
    expect(zhText.level(2)).toBe('第 2 关');
    expect(zhText.levelTitle(2, '星星奖章')).toBe('第 2 关 · 星星奖章');
    expect(zhText.moves(8)).toBe('8 步');
    expect(zhText.buttons.levels).toBe('关卡');
    expect(zhText.tools.freeze).toBe('冻结');
    expect(zhText.results.winTitle).toBe('完成');
    expect(zhText.guidance.tap).toBe('点击');
  });

  it('uses Chinese labels for special cell overlays', () => {
    const board = createBoard(level([
      { index: 0, direction: 0 },
      { index: 3, direction: 2, kind: 'locked', unlockGroup: 1 },
    ]));

    expect(cellPresentation(board, board.cellsByIndex.get(3)!)).toMatchObject({ label: '锁定' });
  });
});
